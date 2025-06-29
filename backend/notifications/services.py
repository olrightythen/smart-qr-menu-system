import json
import uuid
from typing import Dict, Any, Optional
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
import logging

logger = logging.getLogger(__name__)

# Custom JSON encoder to handle UUID objects
class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            # Convert UUID objects to strings
            return str(obj)
        return super().default(obj)


class NotificationService:
    """Simple notification service with WebSocket support"""
    
    def __init__(self):
        self.channel_layer = get_channel_layer()
    
    def create_notification(self, vendor, title: str, message: str, notification_type: str = 'system', data: dict = None):
        """Create a notification with WebSocket support"""
        try:
            # Use a json dump with our custom UUID encoder to ensure complex objects are properly serialized
            data_json = data or {}
            
            # Convert any potential complex data types to strings for database storage
            if isinstance(data_json, dict):
                for key, value in data_json.items():
                    if isinstance(value, (dict, list)):
                        data_json[key] = json.dumps(value, cls=UUIDEncoder)
            
            notification = Notification.objects.create(
                vendor=vendor,
                title=title,
                message=message,
                notification_type=notification_type,
                data=data_json
            )
            
            # Send WebSocket notification
            self._send_websocket_notification(vendor, notification)
            
            logger.info(f"Notification created: {title} for {vendor.restaurant_name}")
            return notification
            
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return None
    
    def _send_websocket_notification(self, vendor, notification: Notification):
        """Send notification via WebSocket"""
        if not self.channel_layer:
            logger.warning("Channel layer not configured - WebSocket notifications disabled")
            return
        
        try:
            group_name = f'vendor_{vendor.id}'
            
            # Format data correctly for frontend consumption
            # This ensures a flat structure that's easy to work with in the frontend
            notification_data = {
                'id': notification.id,
                'title': notification.title,
                'message': notification.message,
                'type': notification.notification_type,
                'read': notification.read,
                'timestamp': notification.created_at.isoformat(),
                'data': notification.data or {}
            }
            
            # Parse any serialized JSON fields in notification.data before sending
            if notification_data['data']:
                data_copy = dict(notification_data['data'])
                for key, value in data_copy.items():
                    if key == 'items' and not isinstance(value, list):
                        # Ensure items is always an array
                        if isinstance(value, str) and (value.startswith('[') or value.startswith('{')):
                            try:
                                parsed_value = json.loads(value)
                                if isinstance(parsed_value, list):
                                    notification_data['data'][key] = parsed_value
                                    logger.info(f"Parsed items JSON string into array before sending WebSocket notification")
                                else:
                                    notification_data['data'][key] = []
                                    logger.warning(f"Items field was not an array after parsing, defaulting to empty array")
                            except json.JSONDecodeError:
                                notification_data['data'][key] = []
                                logger.warning(f"Failed to parse items JSON string, defaulting to empty array")
                        else:
                            notification_data['data'][key] = []
                            logger.warning(f"Items field was not an array or JSON string, defaulting to empty array")
                    elif isinstance(value, str) and (value.startswith('[') or value.startswith('{')):
                        try:
                            # Attempt to parse the string as JSON
                            notification_data['data'][key] = json.loads(value)
                            logger.info(f"Parsed JSON string field '{key}' before sending WebSocket notification")
                        except json.JSONDecodeError:
                            # If it's not valid JSON, keep it as a string
                            pass
            
            # Log what we're sending
            logger.info(f"Sending WebSocket notification: {notification.notification_type} to vendor {vendor.id}")
            logger.debug(f"Notification data: {notification_data}")
            
            # Send the message via the channel layer
            async_to_sync(self.channel_layer.group_send)(
                group_name,
                {
                    'type': 'vendor_notification',
                    'data': notification_data
                }
            )
            
        except Exception as e:
            logger.error(f"Error sending WebSocket notification: {e}")
            logger.exception("Full traceback:")
    
    def send_new_order_notification(self, vendor, order):
        """Send new order notification"""
        # Handle both order object and order_id
        order_id = order.id if hasattr(order, 'id') else order
        
        # Get order items if available
        order_items = []
        if hasattr(order, 'items'):
            try:
                # Use select_related to efficiently fetch related menu_item data
                items = order.items.all().select_related('menu_item')
                
                # If items queryset is empty but we have an order object, try refreshing
                if items.count() == 0 and hasattr(order, 'refresh_from_db'):
                    order.refresh_from_db()
                    items = order.items.all().select_related('menu_item')
                    logger.info(f"Refreshed order and found {items.count()} items for order #{order_id}")
                
                # Log items being processed
                logger.info(f"Processing {items.count()} items for order #{order_id}")
                
                for item in items:
                    # Safely access menu_item attributes
                    menu_item = item.menu_item
                    if menu_item:
                        item_data = {
                            "name": menu_item.name,
                            "quantity": item.quantity,
                            "price": str(item.price),
                            "item_id": menu_item.id
                        }
                        order_items.append(item_data)
                        logger.info(f"Added item: {item_data}")
                    else:
                        # Include minimal information if menu_item is None
                        item_data = {
                            "name": "Item",
                            "quantity": item.quantity,
                            "price": str(item.price)
                        }
                        order_items.append(item_data)
                        logger.info(f"Added generic item: {item_data}")
                
                # Log the items being included
                logger.info(f"Including {len(order_items)} items in order notification for order #{order_id}")
                logger.debug(f"Order items data: {order_items}")
            except Exception as e:
                logger.error(f"Error getting order items for notification: {e}")
                logger.exception("Full traceback:")
        else:
            # If we only have the order ID, try to fetch the items
            logger.info(f"No items attribute found, fetching items by ID for order #{order_id}")
            order_items = self._get_order_items_by_id(order_id)
            
            # If items array is still empty, make one more attempt with a delay
            if len(order_items) == 0:
                import time
                logger.info(f"First attempt found no items, waiting 0.5s and trying again for order #{order_id}")
                time.sleep(0.5)  # Short delay to allow transaction to complete
                order_items = self._get_order_items_by_id(order_id)
        
        # Create order data for notification
        order_data = {'order_id': order_id}
        
        # Add additional data if available
        if hasattr(order, 'total_amount'):
            order_data['total_amount'] = str(order.total_amount)
        elif isinstance(order, int):
            # If order is just an ID, try to get the total amount
            try:
                from vendor.models import Order
                order_obj = Order.objects.filter(id=order_id).first()
                if order_obj:
                    order_data['total_amount'] = str(order_obj.total_amount)
            except Exception as e:
                logger.error(f"Error getting order total for notification: {e}")
        
        if hasattr(order, 'table') and order.table:
            order_data['table_name'] = order.table.name
        elif isinstance(order, int):
            # If order is just an ID, try to get the table name
            try:
                from vendor.models import Order
                order_obj = Order.objects.filter(id=order_id).first()
                if order_obj and order_obj.table:
                    order_data['table_name'] = order_obj.table.name
            except Exception as e:
                logger.error(f"Error getting table name for notification: {e}")
        
        # Always include the items array, even if empty
        # This ensures the frontend doesn't show "Item details not available"
        order_data['items'] = order_items
        
        # Log final data being sent
        logger.info(f"Final order data for notification: {order_data}")
        
        # Create the notification
        notification = self.create_notification(
            vendor=vendor,
            title=f"New Order #{order_id}",
            message=f"You have received a new order",
            notification_type='new_order',
            data=order_data
        )
        
        # Send WebSocket update for the order
        try:
            from notifications.order_utils import send_order_update
            send_order_update(order_id)
            logger.info(f"Sent WebSocket order update for order #{order_id}")
        except Exception as e:
            logger.error(f"Error sending WebSocket order update for order #{order_id}: {e}")
            logger.exception("Full traceback:")
            
        return notification
    
    def send_payment_notification(self, vendor, order_id, amount):
        """Send payment notification"""
        return self.create_notification(
            vendor=vendor,
            title=f"Payment Received",
            message=f"Payment of Rs. {amount} received for order #{order_id}",
            notification_type='payment',
            data={'order_id': order_id, 'amount': amount}
        )
    
    def send_order_status_update(self, vendor, order, old_status, new_status):
        """Send order status update notification"""
        # Handle both order object and order_id
        order_id = order.id if hasattr(order, 'id') else order
        
        # Create message based on status change
        status_messages = {
            'pending': 'is pending approval',
            'accepted': 'has been accepted',
            'rejected': 'has been rejected',
            'preparing': 'is being prepared',
            'ready': 'is ready for pickup',
            'completed': 'has been completed',
            'cancelled': 'has been cancelled'
        }
        
        message = f"Order #{order_id} {status_messages.get(new_status, f'status changed to {new_status}')}"
        title = f"Order #{order_id} Update"
        
        # Create order data for notification
        order_data = {
            'order_id': order_id,
            'old_status': old_status,
            'new_status': new_status
        }
        
        # Add additional data if available
        if hasattr(order, 'total_amount'):
            order_data['total_amount'] = str(order.total_amount)
        elif isinstance(order, int):
            # If order is just an ID, try to get the total amount
            try:
                from vendor.models import Order
                order_obj = Order.objects.filter(id=order_id).first()
                if order_obj:
                    order_data['total_amount'] = str(order_obj.total_amount)
            except Exception as e:
                logger.error(f"Error getting order total for status update notification: {e}")
            
        # Include order items if this is an order object with items
        if hasattr(order, 'items'):
            try:
                items = order.items.all().select_related('menu_item')
                order_items = []
                
                # Log items being processed
                logger.info(f"Processing {items.count()} items for order status update #{order_id}")
                
                for item in items:
                    menu_item = item.menu_item
                    if menu_item:
                        item_data = {
                            "name": menu_item.name,
                            "quantity": item.quantity,
                            "price": str(item.price),
                            "item_id": menu_item.id
                        }
                        order_items.append(item_data)
                        logger.info(f"Added item to status update: {item_data}")
                    else:
                        item_data = {
                            "name": "Item",
                            "quantity": item.quantity,
                            "price": str(item.price)
                        }
                        order_items.append(item_data)
                        logger.info(f"Added generic item to status update: {item_data}")
                
                order_data['items'] = order_items
                logger.info(f"Including {len(order_items)} items in status update for order #{order_id}")
            except Exception as e:
                logger.error(f"Error getting order items for status update notification: {e}")
                logger.exception("Full traceback:")
        else:
            # If we only have the order ID, try to fetch the items
            logger.info(f"No items attribute found, fetching items by ID for status update order #{order_id}")
            order_data['items'] = self._get_order_items_by_id(order_id)
        
        # Log final order data
        logger.info(f"Final order data for status update notification: {order_data}")
        
        # Create and send the notification
        return self.create_notification(
            vendor=vendor,
            title=title,
            message=message,
            notification_type='order_status',
            data=order_data
        )
    
    def _get_order_items_by_id(self, order_id):
        """Helper method to fetch order items when we only have an order ID"""
        try:
            from vendor.models import Order, OrderItem
            from django.db import transaction
            
            # Get the order with a small delay to ensure transaction completion
            with transaction.atomic():
                order = Order.objects.filter(id=order_id).first()
                if not order:
                    logger.warning(f"Order #{order_id} not found when fetching items")
                    return []
                    
                # Get the order items
                items = OrderItem.objects.filter(order_id=order_id).select_related('menu_item')
                
                # Log the raw order items query result
                logger.info(f"Raw order items count for order #{order_id}: {items.count()}")
                for idx, item in enumerate(items):
                    logger.info(f"Item {idx+1}: menu_item={item.menu_item}, quantity={item.quantity}, price={item.price}")
                
                # Format the items
                order_items = []
            for item in items:
                menu_item = item.menu_item
                if menu_item:
                    order_items.append({
                        "name": menu_item.name,
                        "quantity": item.quantity,
                        "price": str(item.price),
                        "item_id": menu_item.id
                    })
                    logger.info(f"Added item with menu_item.name={menu_item.name} to order_items")
                else:
                    order_items.append({
                        "name": "Item",
                        "quantity": item.quantity,
                        "price": str(item.price)
                    })
                    logger.info(f"Added generic item (menu_item is None) to order_items")
            
            logger.info(f"Fetched {len(order_items)} items for order #{order_id}")
            logger.info(f"Formatted order_items: {order_items}")
            return order_items
        except Exception as e:
            logger.error(f"Error fetching order items for order #{order_id}: {e}")
            logger.exception("Full traceback:")
            return []