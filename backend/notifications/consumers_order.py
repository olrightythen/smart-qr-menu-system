from .consumers import NotificationConsumer
import json
import logging
import time
import uuid
from decimal import Decimal
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

class OrderTrackingConsumer(AsyncWebsocketConsumer):
    """Consumer for tracking specific orders"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.order_id = None
        self.order_group_name = None
        self.vendor_id = None
        self.table_identifier = None
        
    async def connect(self):
        """Handle WebSocket connection for order tracking"""
        try:
            # Extract order_id from URL
            self.order_id = self.scope['url_route']['kwargs']['order_id']
            self.order_group_name = f'order_{self.order_id}'
            
            logger.info(f"[OrderTrackingConsumer] WebSocket connection attempt for order {self.order_id}")
            
            # Accept the connection first
            await self.accept()
            
            # Get order details to find vendor and table information
            try:
                order_info = await self.get_order_info(self.order_id)
                if order_info:
                    self.vendor_id = order_info['vendor_id']
                    self.table_identifier = order_info['table_identifier']
                    
                    # Join vendor group for vendor-level updates
                    vendor_group = f'vendor_{self.vendor_id}'
                    await self.channel_layer.group_add(vendor_group, self.channel_name)
                    logger.info(f"[OrderTrackingConsumer] Joined vendor group: {vendor_group}")
                    
                    # Join table-specific group for table-level updates
                    if self.table_identifier:
                        table_group = f'order_{self.vendor_id}_{self.table_identifier}'
                        await self.channel_layer.group_add(table_group, self.channel_name)
                        logger.info(f"[OrderTrackingConsumer] Joined table group: {table_group}")
                else:
                    logger.warning(f"[OrderTrackingConsumer] Could not get order info for order {self.order_id}")
            except Exception as e:
                logger.error(f"[OrderTrackingConsumer] Error getting order info: {e}")
                # Continue without vendor/table groups
            
            # Join order-specific group
            await self.channel_layer.group_add(
                self.order_group_name,
                self.channel_name
            )
            logger.info(f"[OrderTrackingConsumer] Joined order group: {self.order_group_name}")
            
            # Send connection confirmation
            try:
                await self.send(text_data=json.dumps({
                    'type': 'connection_established',
                    'message': 'Connected to order tracking',
                    'order_id': self.order_id,
                    'timestamp': self.get_timestamp()
                }))
                logger.info(f"[OrderTrackingConsumer] Sent connection confirmation for order {self.order_id}")
            except Exception as e:
                logger.error(f"[OrderTrackingConsumer] Error sending connection confirmation: {e}")
            
            logger.info(f"[OrderTrackingConsumer] WebSocket successfully connected for order {self.order_id}")
            
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] WebSocket connection error for order {getattr(self, 'order_id', 'unknown')}: {str(e)}")
            logger.exception("[OrderTrackingConsumer] Full traceback:")
            try:
                await self.close(code=4002)
            except Exception as close_error:
                logger.error(f"[OrderTrackingConsumer] Error closing connection: {close_error}")
            
    @database_sync_to_async
    def get_order_info(self, order_id):
        """Get order information from database"""
        try:
            from vendor.models import Order
            logger.info(f"[OrderTrackingConsumer] Attempting to fetch order {order_id} from database")
            
            order = Order.objects.select_related('vendor').get(id=order_id)
            
            result = {
                'vendor_id': order.vendor.id,
                'table_identifier': getattr(order, 'table_identifier', None)
            }
            
            logger.info(f"[OrderTrackingConsumer] Successfully fetched order {order_id}: vendor_id={result['vendor_id']}, table_identifier={result['table_identifier']}")
            return result
            
        except Order.DoesNotExist:
            logger.error(f"[OrderTrackingConsumer] Order {order_id} does not exist in database")
            return None
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] Error getting order info for {order_id}: {e}")
            logger.exception("[OrderTrackingConsumer] Database query traceback:")
            return None
            
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            # Leave order group
            if hasattr(self, 'order_group_name') and self.order_group_name:
                await self.channel_layer.group_discard(
                    self.order_group_name,
                    self.channel_name
                )
                
            # Leave vendor group
            if hasattr(self, 'vendor_id') and self.vendor_id:
                vendor_group = f'vendor_{self.vendor_id}'
                await self.channel_layer.group_discard(vendor_group, self.channel_name)
                
            # Leave table group
            if hasattr(self, 'vendor_id') and hasattr(self, 'table_identifier') and self.table_identifier:
                table_group = f'order_{self.vendor_id}_{self.table_identifier}'
                await self.channel_layer.group_discard(table_group, self.channel_name)
                
            logger.info(f"[OrderTrackingConsumer] WebSocket disconnected for order {getattr(self, 'order_id', 'unknown')} with code {close_code}")
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] Error during WebSocket disconnect: {e}")
            
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            logger.debug(f"[OrderTrackingConsumer] Received raw data: {text_data}")
            data = json.loads(text_data)
            message_type = data.get('type')
            
            logger.debug(f"[OrderTrackingConsumer] Received WebSocket message type: {message_type}")
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp'),
                    'server_timestamp': self.get_timestamp(),
                    'order_id': self.order_id
                }))
                logger.debug(f"[OrderTrackingConsumer] Sent pong response for order {self.order_id}")
            else:
                logger.warning(f"[OrderTrackingConsumer] Unknown message type received: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}',
                    'timestamp': self.get_timestamp()
                }))
                    
        except json.JSONDecodeError as e:
            logger.error(f"[OrderTrackingConsumer] Invalid JSON received in WebSocket: {e}")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Invalid JSON format',
                    'timestamp': self.get_timestamp()
                }))
            except Exception as send_error:
                logger.error(f"[OrderTrackingConsumer] Error sending JSON error response: {send_error}")
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] Error handling WebSocket message: {e}")
            logger.exception("[OrderTrackingConsumer] Full traceback:")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Internal server error',
                    'timestamp': self.get_timestamp()
                }))
            except Exception as send_error:
                logger.error(f"[OrderTrackingConsumer] Error sending error response: {send_error}")
    
    # Message handlers for different message types
    async def order_status(self, event):
        """Forward order status update to client"""
        try:
            logger.info(f"[OrderTrackingConsumer] Received order_status event for order {self.order_id}")
            data = event['data']
            logger.debug(f"[OrderTrackingConsumer] Event data: {data}")
            
            # Only send updates relevant to this order
            if data.get('id') == int(self.order_id):
                logger.info(f"[OrderTrackingConsumer] Order ID matches, sending update to client for order {self.order_id}")
                
                # Serialize data to handle UUIDs, Decimals, etc.
                serialized_data = self.serialize_for_json(data)
                
                await self.send(text_data=json.dumps({
                    'type': 'order_update',
                    'data': serialized_data
                }))
                logger.info(f"[OrderTrackingConsumer] Successfully sent order status update for order {self.order_id}")
            else:
                logger.debug(f"[OrderTrackingConsumer] Order ID mismatch: received {data.get('id')}, expected {self.order_id}")
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] Error sending order_status: {e}")
            logger.exception("[OrderTrackingConsumer] Full traceback:")

    async def vendor_notification(self, event):
        """Handle vendor notifications that might be relevant to this order"""
        try:
            logger.info(f"[OrderTrackingConsumer] Received vendor_notification event for order {self.order_id}")
            data = event['data']
            logger.debug(f"[OrderTrackingConsumer] Vendor notification data: {data}")
            
            # Check if this notification is about our order
            if data.get('type') == 'order_status' and data.get('data', {}).get('order_id') == int(self.order_id):
                logger.info(f"[OrderTrackingConsumer] Vendor notification is about our order {self.order_id}")
                
                # Extract the order data from the notification
                order_data = data.get('data', {})
                serialized_data = self.serialize_for_json(order_data)
                
                await self.send(text_data=json.dumps({
                    'type': 'order_update',
                    'data': serialized_data
                }))
                logger.info(f"[OrderTrackingConsumer] Successfully sent vendor notification update for order {self.order_id}")
            else:
                logger.debug(f"[OrderTrackingConsumer] Vendor notification not relevant to order {self.order_id}")
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] Error handling vendor_notification: {e}")
            logger.exception("[OrderTrackingConsumer] Full traceback:")
            
    def serialize_for_json(self, data):
        """Convert data to JSON-serializable format"""
        if isinstance(data, dict):
            return {key: self.serialize_for_json(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self.serialize_for_json(item) for item in data]
        elif isinstance(data, uuid.UUID):
            return str(data)
        elif isinstance(data, Decimal):
            return float(data)
        elif isinstance(data, datetime):
            return data.isoformat()
        else:
            return data
            
    async def order_status_update(self, event):
        """Handle order status updates"""
        try:
            logger.info(f"[OrderTrackingConsumer] Received order_status_update event for order {self.order_id}")
            data = event['data']
            logger.debug(f"[OrderTrackingConsumer] Event data: {data}")
            
            # Only send updates relevant to this order
            if data.get('id') == int(self.order_id):
                logger.info(f"[OrderTrackingConsumer] Order ID matches, sending update to client for order {self.order_id}")
                
                # Serialize data to handle UUIDs, Decimals, etc.
                serialized_data = self.serialize_for_json(data)
                
                await self.send(text_data=json.dumps({
                    'type': 'order_update',
                    'data': serialized_data
                }))
                logger.info(f"[OrderTrackingConsumer] Successfully sent order status update for order {self.order_id}")
            else:
                logger.debug(f"[OrderTrackingConsumer] Order ID mismatch: received {data.get('id')}, expected {self.order_id}")
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] Error sending order status update via WebSocket: {e}")
            logger.exception("[OrderTrackingConsumer] Full traceback:")
            
    def get_timestamp(self):
        """Get current timestamp in milliseconds"""
        try:
            return int(time.time() * 1000)
        except Exception as e:
            logger.error(f"[OrderTrackingConsumer] Error getting timestamp: {e}")
            return 0
