import json
import logging
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
    
    async def connect(self):
        """Handle WebSocket connection"""
        try:
            # Extract vendor_id from URL
            self.vendor_id = self.scope['url_route']['kwargs']['vendor_id']
            self.vendor_group_name = f'vendor_{self.vendor_id}'
            
            logger.info(f"WebSocket connection attempt for vendor {self.vendor_id}")
            
            # Authenticate user via token
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
            await self.send(text_data=json.dumps({
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
            
            logger.info(f"WebSocket disconnected for vendor {getattr(self, 'vendor_id', 'unknown')} with code {close_code}")
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
                
            elif message_type == 'mark_notification_read':
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