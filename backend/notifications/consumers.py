import json
import logging
import uuid
from typing import Optional
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token
from vendor.models import Vendor

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for handling notifications"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vendor_id: Optional[int] = None
        self.vendor: Optional[Vendor] = None
        self.vendor_group_name: Optional[str] = None
        self.user = None
        self.is_customer = False
        self.table_id = None
        logger.info(f"[NotificationConsumer] Instantiated")
    
    async def connect(self):
        """Handle WebSocket connection"""
        try:
            logger.info(f"[NotificationConsumer] Connect method called")
            # Check URL pattern type
            url_route = self.scope['url_route']
            logger.info(f"[NotificationConsumer] URL route: {url_route}")
            
            # Handle order-specific endpoint with vendor_id and table_id pattern
            if 'table_id' in url_route.get('kwargs', {}):
                logger.info(f"[NotificationConsumer] Detected table_id in kwargs, calling _handle_order_connect")
                await self._handle_order_connect()
                return
            
            logger.info(f"[NotificationConsumer] No table_id in kwargs, proceeding with standard vendor connection")
                
            # Handle standard vendor notifications endpoint (original logic)
            self.vendor_id = self.scope['url_route']['kwargs']['vendor_id']
            self.vendor_group_name = f'vendor_{self.vendor_id}'
            
            # Check if this is a customer connection
            query_string = self.scope.get('query_string', b'').decode()
            self.is_customer = 'customer=true' in query_string
            
            logger.info(f"WebSocket connection attempt for vendor {self.vendor_id} (customer: {self.is_customer})")
            
            if self.is_customer:
                # For customers, we don't need authentication
                await self.accept()
                
                # Join vendor group to receive updates about this vendor
                await self.channel_layer.group_add(
                    self.vendor_group_name,
                    self.channel_name
                )
                
                # Send connection confirmation
                await self.send(text_data=self.json_dumps_with_uuid({
                    'type': 'connection_established',
                    'message': 'Connected to vendor notifications as customer',
                    'vendor_id': int(self.vendor_id),
                    'timestamp': self.get_timestamp()
                }))
                
                logger.info(f"Customer WebSocket successfully connected for vendor {self.vendor_id}")
                return
                
            # For vendors, authenticate via token
            user = await self.get_user_from_token()
            if not user or user.is_anonymous:
                logger.warning(f"Unauthenticated WebSocket connection attempt for vendor {self.vendor_id}")
                await self.close(code=4001)
                return
            
            # Verify user matches vendor_id
            if str(user.id) != str(self.vendor_id):
                logger.warning(f"User {user.id} attempted to connect to vendor {self.vendor_id} notifications")
                await self.close(code=4003)  # Forbidden
                return
            
            self.user = user
            
            # Accept the connection first
            await self.accept()
            logger.info(f"WebSocket connection accepted for vendor {self.vendor_id}")
            
            # Join vendor group
            await self.channel_layer.group_add(
                self.vendor_group_name,
                self.channel_name
            )
            
            # Send connection confirmation
            await self.send(text_data=self.json_dumps_with_uuid({
                'type': 'connection_established',
                'message': 'Connected to notifications',
                'vendor_id': int(self.vendor_id),
                'timestamp': self.get_timestamp()
            }))
            
            logger.info(f"WebSocket successfully connected for vendor {self.vendor_id}")
            
        except Exception as e:
            logger.error(f"WebSocket connection error for vendor {getattr(self, 'vendor_id', 'unknown')}: {str(e)}")
            logger.exception("Full traceback:")
            await self.close(code=4002)

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            # Leave vendor group
            if hasattr(self, 'vendor_group_name') and self.vendor_group_name:
                await self.channel_layer.group_discard(
                    self.vendor_group_name,
                    self.channel_name
                )
            
            # Leave order-specific channel
            if hasattr(self, 'order_channel_name') and self.order_channel_name:
                await self.channel_layer.group_discard(
                    self.order_channel_name,
                    self.channel_name
                )
            
            # Leave any other order-specific groups we might have joined
            if hasattr(self, 'vendor_id') and hasattr(self, 'table_id'):
                try:
                    from vendor.models import Order
                    orders = await database_sync_to_async(
                        lambda: list(Order.objects.filter(
                            vendor_id=self.vendor_id, 
                            table_identifier=self.table_id
                        ).values_list('id', flat=True))
                    )()
                    
                    for order_id in orders:
                        order_specific_channel = f'order_{order_id}'
                        await self.channel_layer.group_discard(
                            order_specific_channel,
                            self.channel_name
                        )
                except Exception as e:
                    logger.error(f"Error leaving order-specific channels: {e}")
            
            logger.info(f"WebSocket disconnected for vendor {getattr(self, 'vendor_id', 'unknown')} (customer: {getattr(self, 'is_customer', False)}) with code {close_code}")
        except Exception as e:
            logger.error(f"Error during WebSocket disconnect: {e}")

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            logger.debug(f"Received WebSocket message type: {message_type}")
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp'),
                    'server_timestamp': self.get_timestamp(),
                    'vendor_id': int(self.vendor_id)
                }))
                
            elif message_type == 'mark_notification_read' and not self.is_customer:
                notification_id = data.get('notification_id')
                if notification_id:
                    success = await self.mark_notification_read(notification_id)
                    await self.send(text_data=json.dumps({
                        'type': 'notification_read_response',
                        'notification_id': notification_id,
                        'success': success,
                        'timestamp': self.get_timestamp()
                    }))
                else:
                    logger.warning("mark_notification_read called without notification_id")
                    
            else:
                logger.warning(f"Unknown message type received: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}',
                    'timestamp': self.get_timestamp()
                }))
                    
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received in WebSocket: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format',
                'timestamp': self.get_timestamp()
            }))
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Internal server error',
                'timestamp': self.get_timestamp()
            }))

    async def vendor_notification(self, event):
        """Send notification to WebSocket"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'vendor_notification',
                'data': event['data'],
                'timestamp': self.get_timestamp()
            }))
            logger.debug(f"Sent notification to vendor {self.vendor_id}")
        except Exception as e:
            logger.error(f"Error sending notification via WebSocket: {e}")
    
    async def order_status(self, event):
        """Handle order status updates for vendor and customers"""
        try:
            # Get key data for logging
            data = event.get('data', {})
            order_id = data.get('id', 'unknown')
            status = data.get('status', 'unknown')
            
            # Log detailed information about the message
            logger.info(f"Processing order_status message for order {order_id}, status: {status}")
            logger.info(f"Consumer context: vendor_id: {self.vendor_id}, table_id: {getattr(self, 'table_id', 'N/A')}, is_customer: {self.is_customer}")
            
            # Format the message based on the data
            message = {
                'type': 'order_status',
                'data': data,
                'timestamp': self.get_timestamp()
            }
            
            # Send the message using our custom JSON serializer
            await self.send(text_data=self.json_dumps_with_uuid(message))
            logger.info(f"Sent order_status update to {'customer' if self.is_customer else 'vendor'} "
                        f"for order {order_id}, status: {status}, vendor: {self.vendor_id}")
        except Exception as e:
            logger.error(f"Error sending order_status update via WebSocket: {e}")
            logger.exception("Full traceback:")

    async def order_status_update(self, event):
        """Handle order status updates for specific order channel"""
        try:
            # Get key data for logging
            data = event.get('data', {})
            order_id = data.get('id', 'unknown')
            status = data.get('status', 'unknown')
            
            # Log detailed information about the message
            logger.info(f"Processing order_status_update message for order {order_id}, status: {status}")
            logger.info(f"Consumer context: vendor_id: {getattr(self, 'vendor_id', 'N/A')}, table_id: {getattr(self, 'table_id', 'N/A')}, is_customer: {getattr(self, 'is_customer', False)}")
            
            # Format the message based on the data
            message = {
                'type': 'order_status_update',
                'data': data,
                'timestamp': self.get_timestamp()
            }
            
            # Send the message using our custom JSON serializer
            await self.send(text_data=self.json_dumps_with_uuid(message))
            logger.info(f"Sent order_status_update to {'customer' if self.is_customer else 'vendor'} "
                        f"for order {order_id}, status: {status}")
        except Exception as e:
            logger.error(f"Error sending order_status_update via WebSocket: {e}")
            logger.exception("Full traceback:")

    async def _handle_order_connect(self):
        """Handle WebSocket connection for order-specific channel"""
        try:
            # Debug: log the full scope
            logger.info(f"WebSocket scope: {self.scope}")
            logger.info(f"URL route: {self.scope.get('url_route', {})}")
            
            # Extract vendor_id and table_id from URL
            url_kwargs = self.scope['url_route']['kwargs']
            self.vendor_id = url_kwargs.get('vendor_id')
            self.table_id = url_kwargs.get('table_id')
            
            logger.info(f"WebSocket order connection attempt for vendor {self.vendor_id} (type: {type(self.vendor_id)}), table {self.table_id} (type: {type(self.table_id)})")
            logger.info(f"URL kwargs: {url_kwargs}")
            
            # Validate vendor_id and table_id
            if self.vendor_id is None or self.table_id is None:
                logger.error(f"Invalid vendor_id or table_id: vendor_id={self.vendor_id}, table_id={self.table_id}")
                await self.accept()
                await self.send(text_data=self.json_dumps_with_uuid({
                    'type': 'error',
                    'message': 'Invalid vendor or table identifier',
                    'timestamp': self.get_timestamp()
                }))
                await self.close(code=4003)
                return
            
            # Convert vendor_id to int if it's a string
            try:
                self.vendor_id = int(self.vendor_id)
            except (ValueError, TypeError):
                logger.error(f"Invalid vendor_id format: {self.vendor_id}")
                await self.accept()
                await self.send(text_data=self.json_dumps_with_uuid({
                    'type': 'error',
                    'message': 'Invalid vendor ID format',
                    'timestamp': self.get_timestamp()
                }))
                await self.close(code=4003)
                return
            
            # Accept the connection
            await self.accept()
            
            # Join vendor group to receive all updates for this vendor
            self.vendor_group_name = f'vendor_{self.vendor_id}'
            await self.channel_layer.group_add(
                self.vendor_group_name,
                self.channel_name
            )
            
            # Join table-specific order channel - this is crucial for real-time updates
            self.order_channel_name = f'order_{self.vendor_id}_{self.table_id}'
            await self.channel_layer.group_add(
                self.order_channel_name,
                self.channel_name
            )
            
            # Also join all individual order channels for orders from this table
            # This will be used by the order_utils.py to send updates
            try:
                from vendor.models import Order
                orders = await database_sync_to_async(
                    lambda: list(Order.objects.filter(
                        vendor_id=self.vendor_id, 
                        table_identifier=self.table_id
                    ).values_list('id', flat=True))
                )()
                
                if not orders:
                    logger.info(f"No existing orders found for vendor {self.vendor_id}, table {self.table_id}")
                
                for order_id in orders:
                    order_specific_channel = f'order_{order_id}'
                    await self.channel_layer.group_add(
                        order_specific_channel,
                        self.channel_name
                    )
                    logger.info(f"Joined order-specific channel: {order_specific_channel}")
            except Exception as e:
                logger.error(f"Error joining order-specific channels: {e}")
                logger.exception("Full traceback:")
                # Continue despite error - we'll at least get vendor-level updates
            
            # Send connection confirmation
            await self.send(text_data=self.json_dumps_with_uuid({
                'type': 'connection_established',
                'message': 'Connected to order updates',
                'vendor_id': self.vendor_id,
                'table_id': self.table_id,
                'timestamp': self.get_timestamp()
            }))
            
            # Mark as customer connection
            self.is_customer = True
            
            logger.info(f"Order WebSocket successfully connected for vendor {self.vendor_id}, table {self.table_id}")
            
        except Exception as e:
            logger.error(f"Order WebSocket connection error: {str(e)}")
            logger.exception("Full traceback:")
            try:
                await self.accept()
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Failed to establish WebSocket connection',
                    'timestamp': self.get_timestamp() if hasattr(self, 'get_timestamp') else None
                }))
                await self.close(code=4002)
            except Exception as close_error:
                logger.error(f"Error closing WebSocket after connection error: {close_error}")

    @database_sync_to_async
    def get_user_from_token(self):
        """Get user from token in query string"""
        try:
            query_string = self.scope.get('query_string', b'').decode()
            token_param = None
            
            # Parse query parameters
            for param in query_string.split('&'):
                if param.startswith('token='):
                    token_param = param.split('=')[1]
                    break
            
            if not token_param:
                logger.warning("No token provided in WebSocket connection")
                return AnonymousUser()
            
            # Get user from token
            token = Token.objects.select_related('user').get(key=token_param)
            logger.info(f"WebSocket authentication successful for user {token.user.id}")
            return token.user
            
        except Token.DoesNotExist:
            logger.warning(f"Invalid token provided in WebSocket connection: {token_param}")
            return AnonymousUser()
        except Exception as e:
            logger.error(f"Error authenticating WebSocket user: {e}")
            return AnonymousUser()

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        """Mark notification as read"""
        try:
            from notifications.models import Notification
            
            # Filter by notification ID and vendor to ensure ownership
            notification = Notification.objects.filter(
                id=notification_id, 
                vendor=self.user
            ).first()
            
            if not notification:
                logger.warning(f"Notification {notification_id} not found for vendor {self.user.id}")
                return False
                
            if not notification.read:
                notification.mark_as_read()
                logger.info(f"Notification {notification_id} marked as read via WebSocket for vendor {self.user.id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error marking notification {notification_id} as read: {e}")
            return False
    
    def get_timestamp(self):
        """Get current timestamp in milliseconds"""
        import time
        return int(time.time() * 1000)
        
    def json_dumps_with_uuid(self, data):
        """Custom JSON dumps that handles UUID objects"""
        class UUIDEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, uuid.UUID):
                    return str(obj)
                return super().default(obj)
        
        return json.dumps(data, cls=UUIDEncoder)