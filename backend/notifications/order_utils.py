from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)

def send_order_update(order_id, order_data=None):
    """
    Send an order update to all clients tracking this order
    
    Args:
        order_id: The ID of the order to update
        order_data: Optional pre-formatted order data. If not provided, it will be generated.
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        from vendor.models import Order
        
        # If order_data is not provided, generate it
        if not order_data:
            # Get the order
            try:
                order = Order.objects.select_related('vendor', 'table').get(id=order_id)
            except Order.DoesNotExist:
                logger.error(f"Order {order_id} not found for WebSocket update")
                return False
                
            # Get items for this order
            order_items = order.items.all().select_related('menu_item')
            
            # Format items
            items_data = []
            for item in order_items:
                menu_item_name = item.menu_item.name if item.menu_item else "Unknown Item"
                items_data.append({
                    "name": menu_item_name,
                    "quantity": item.quantity,
                    "price": float(item.price)
                })
            
            # If no items were found, log a warning
            if not items_data:
                logger.warning(f"No items found for order {order_id} in WebSocket update")
            
            # Ensure items_data is always an array
            if not isinstance(items_data, list):
                logger.error(f"items_data is not a list for order {order_id}: {type(items_data)}")
                items_data = []
            
            # Format restaurant info
            restaurant_data = {
                "name": order.vendor.restaurant_name or order.vendor.username or "Restaurant",
                "phone": getattr(order.vendor, 'phone', None) if getattr(order.vendor, 'phone', None) else None,
                "contact": getattr(order.vendor, 'phone', None) if getattr(order.vendor, 'phone', None) else None
            }
            
            # Get table name if available
            table_name = "Table"  # Default fallback
            if order.table and order.table.name:
                table_name = order.table.name
            elif order.table_identifier:
                table_name = order.table_identifier
            # If no table info available, keep default "Table"
            
            # Get table identifier
            table_identifier = None
            if hasattr(order, 'table_identifier') and order.table_identifier:
                table_identifier = order.table_identifier
            elif order.table and order.table.qr_code:
                table_identifier = order.table.qr_code
                
            # Format minimal update data - only essential status changes
            order_data = {
                "id": order.id,
                "status": order.status,
                "updatedAt": order.updated_at.isoformat() if hasattr(order, 'updated_at') else timezone.now().isoformat(),
                # Add timestamp for debugging
                "server_timestamp": timezone.now().isoformat(),
                "message": f"Order {order.id} status is now {order.status}",
                # Include vendor and table info for proper channel routing
                "vendor_id": order.vendor_id,
                "table_identifier": table_identifier,
                # Include delivery issue fields for real-time updates
                "delivery_issue_reported": getattr(order, 'delivery_issue_reported', False),
                "issue_report_timestamp": order.issue_report_timestamp.isoformat() if getattr(order, 'issue_report_timestamp', None) else None,
                "issue_description": getattr(order, 'issue_description', None),
                "issue_resolved": getattr(order, 'issue_resolved', False),
                "issue_resolution_timestamp": order.issue_resolution_timestamp.isoformat() if getattr(order, 'issue_resolution_timestamp', None) else None,
                "resolution_message": getattr(order, 'resolution_message', None),
                # Include customer verification fields for real-time updates
                "customer_verified": getattr(order, 'customer_verified', False),
                "verification_timestamp": order.verification_timestamp.isoformat() if getattr(order, 'verification_timestamp', None) else None,
            }
        
        channel_layer = get_channel_layer()
        
        # Make sure the order_id is an integer
        order_id = int(order_id)
        
        # Log what we're about to send
        logger.info(f"Sending WebSocket update for order {order_id} with status {order_data['status']}")
        
        # Debug the channel names we're going to use
        if "vendor_id" in order_data and "table_identifier" in order_data:
            vendor_id = order_data["vendor_id"]
            table_id = order_data["table_identifier"]
            order_specific_channel = f'order_{order_id}'
            vendor_channel = f'vendor_{vendor_id}'
            table_channel = f'order_{vendor_id}_{table_id}'
            
            logger.info(f"Will attempt to send to channels: {order_specific_channel}, {vendor_channel}, {table_channel}")
        
        # Send update to order-specific channel group
        try:
            async_to_sync(channel_layer.group_send)(
                f'order_{order_id}',
                {
                    'type': 'order_status_update',
                    'data': order_data
                }
            )
            logger.info(f"Sent order-specific update for order {order_id}")
        except Exception as e:
            logger.error(f"Error sending order-specific update: {e}")
            logger.exception("Full traceback:")
        
        # Send to vendor channel
        if "vendor_id" in order_data:
            vendor_id = order_data["vendor_id"]
            
            try:
                # This goes to the vendor dashboard
                async_to_sync(channel_layer.group_send)(
                    f'vendor_{vendor_id}',
                    {
                        'type': 'order_status',
                        'data': order_data
                    }
                )
                logger.info(f"Sent update to vendor channel for vendor {vendor_id}")
                
                # If we have table identifier info, send to the table-specific channel
                if "table_identifier" in order_data and order_data["table_identifier"]:
                    table_id = order_data["table_identifier"]
                    
                    # Important: This is the key channel format that connects to customer devices
                    order_channel = f'order_{vendor_id}_{table_id}'
                    
                    try:
                        async_to_sync(channel_layer.group_send)(
                            order_channel,
                            {
                                'type': 'order_status',
                                'data': order_data
                            }
                        )
                        logger.info(f"Sent update to table-specific channel {order_channel}")
                    except Exception as e:
                        logger.error(f"Error sending to table-specific channel {order_channel}: {e}")
                        logger.exception("Full traceback:")
                        
                    # Try an alternative format as a fallback (just in case)
                    alt_order_channel = f'order-{vendor_id}-{table_id}'
                    try:
                        async_to_sync(channel_layer.group_send)(
                            alt_order_channel,
                            {
                                'type': 'order_status',
                                'data': order_data
                            }
                        )
                        logger.info(f"Sent update to alternative table channel {alt_order_channel}")
                    except Exception as e:
                        logger.error(f"Error sending to alternative channel {alt_order_channel}: {e}")
                
            except Exception as e:
                logger.error(f"Error sending to vendor channel: {e}")
                logger.exception("Full traceback:")
        else:
            logger.warning(f"Could not send vendor update for order {order_id}: missing vendor_id in order_data")
        
        return True
        
    except Exception as e:
        logger.error(f"Error sending order update for {order_id}: {e}")
        logger.exception("Full traceback:")  # Log the full exception
        return False
