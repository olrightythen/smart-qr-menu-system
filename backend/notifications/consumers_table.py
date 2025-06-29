import json
import logging
import time
import uuid
from decimal import Decimal
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

class TableOrderConsumer(AsyncWebsocketConsumer):
    """Consumer for handling table-specific order tracking"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vendor_id = None
        self.table_identifier = None
        self.vendor_group_name = None
        self.order_channel_name = None
        self.specific_order_channels = []
        logger.info(f"[TableOrderConsumer] Instantiated")
        
    async def connect(self):
        """Handle WebSocket connection for table-specific order tracking"""
        try:
            # Extract vendor_id and table_identifier from URL
            url_kwargs = self.scope['url_route']['kwargs']
            self.vendor_id = url_kwargs.get('vendor_id')
            self.table_identifier = url_kwargs.get('table_identifier')
            
            logger.info(f"[TableOrderConsumer] WebSocket connection attempt for vendor {self.vendor_id}, table {self.table_identifier}")
            
            # Accept the connection first to prevent client timeouts
            await self.accept()
            
            # Validate vendor_id and table_identifier
            if not self.vendor_id or not self.table_identifier:
                logger.error(f"[TableOrderConsumer] Invalid vendor_id or table_identifier: {self.vendor_id}, {self.table_identifier}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Invalid vendor or table identifier',
                    'timestamp': int(time.time() * 1000)
                }))
                await self.close(code=4003)
                return
            
            # Join vendor group to receive all updates for this vendor
            self.vendor_group_name = f'vendor_{self.vendor_id}'
            await self.channel_layer.group_add(
                self.vendor_group_name,
                self.channel_name
            )
            logger.info(f"[TableOrderConsumer] Joined vendor group: {self.vendor_group_name}")
            
            # Join table-specific order channel - this is crucial for real-time updates
            self.order_channel_name = f'order_{self.vendor_id}_{self.table_identifier}'
            await self.channel_layer.group_add(
                self.order_channel_name,
                self.channel_name
            )
            logger.info(f"[TableOrderConsumer] Joined order channel: {self.order_channel_name}")
            
            # Get related orders and join their specific channels
            await self.join_order_specific_channels()
            
            # Send connection confirmation
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': 'Connected to order updates',
                'vendor_id': self.vendor_id,
                'table_identifier': self.table_identifier,
                'timestamp': int(time.time() * 1000)
            }))
            
            logger.info(f"[TableOrderConsumer] WebSocket successfully connected for vendor {self.vendor_id}, table {self.table_identifier}")
            
        except Exception as e:
            logger.error(f"[TableOrderConsumer] WebSocket connection error: {str(e)}")
            logger.exception("[TableOrderConsumer] Full traceback:")
            try:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Failed to establish WebSocket connection',
                    'timestamp': int(time.time() * 1000)
                }))
                await self.close(code=4002)
            except Exception as close_error:
                logger.error(f"[TableOrderConsumer] Error closing WebSocket after connection error: {close_error}")
                
    @database_sync_to_async
    def get_related_orders(self):
        """Get orders related to this table"""
        try:
            from vendor.models import Order
            orders = list(Order.objects.filter(
                vendor_id=self.vendor_id,
                table_identifier=self.table_identifier
            ).values_list('id', flat=True))
            return orders
        except Exception as e:
            logger.error(f"[TableOrderConsumer] Error fetching related orders: {e}")
            return []
            
    async def join_order_specific_channels(self):
        """Join channels for specific orders related to this table"""
        try:
            orders = await self.get_related_orders()
            
            if not orders:
                logger.info(f"[TableOrderConsumer] No existing orders found for vendor {self.vendor_id}, table {self.table_id}")
                return
                
            for order_id in orders:
                order_specific_channel = f'order_{order_id}'
                await self.channel_layer.group_add(
                    order_specific_channel,
                    self.channel_name
                )
                self.specific_order_channels.append(order_specific_channel)
                logger.info(f"[TableOrderConsumer] Joined order-specific channel: {order_specific_channel}")
                
        except Exception as e:
            logger.error(f"[TableOrderConsumer] Error joining order-specific channels: {e}")
            logger.exception("[TableOrderConsumer] Full traceback:")
            # Continue despite error - we'll at least get vendor-level updates
            
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            # Leave vendor group
            if self.vendor_group_name:
                await self.channel_layer.group_discard(
                    self.vendor_group_name,
                    self.channel_name
                )
                
            # Leave order channel
            if self.order_channel_name:
                await self.channel_layer.group_discard(
                    self.order_channel_name,
                    self.channel_name
                )
                
            # Leave specific order channels
            for channel in self.specific_order_channels:
                await self.channel_layer.group_discard(
                    channel,
                    self.channel_name
                )
                
            logger.info(f"[TableOrderConsumer] WebSocket disconnected for vendor {self.vendor_id}, table {self.table_id} with code {close_code}")
        except Exception as e:
            logger.error(f"[TableOrderConsumer] Error during WebSocket disconnect: {e}")
            
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            logger.debug(f"[TableOrderConsumer] Received WebSocket message type: {message_type}")
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp'),
                    'server_timestamp': int(time.time() * 1000),
                    'vendor_id': self.vendor_id
                }))
            else:
                logger.warning(f"[TableOrderConsumer] Unknown message type received: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}',
                    'timestamp': int(time.time() * 1000)
                }))
                    
        except json.JSONDecodeError as e:
            logger.error(f"[TableOrderConsumer] Invalid JSON received in WebSocket: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format',
                'timestamp': int(time.time() * 1000)
            }))
        except Exception as e:
            logger.error(f"[TableOrderConsumer] Error handling WebSocket message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Internal server error',
                'timestamp': int(time.time() * 1000)
            }))
    
    # Message handlers for different message types
    async def order_status(self, event):
        """Forward order status update to client"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'order_status',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"[TableOrderConsumer] Error sending order_status: {e}")
            
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
        """Forward order status update to client"""
        try:
            # Serialize data to handle UUIDs, Decimals, etc.
            serialized_data = self.serialize_for_json(event['data'])
            
            await self.send(text_data=json.dumps({
                'type': 'order_status_update',
                'data': serialized_data
            }))
        except Exception as e:
            logger.error(f"[TableOrderConsumer] Error sending order_status_update: {e}")
            logger.exception("[TableOrderConsumer] Full traceback:")
