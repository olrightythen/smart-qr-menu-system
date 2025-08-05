# Create a new file: vendor/views/order_view.py

from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from ..models import Order, OrderItem, Vendor, Table, MenuItem
from django.core.serializers import serialize
from django.utils import timezone
from notifications.facade import notification_facade
from notifications.utils import send_order_notification
from notifications.order_utils import send_order_update
import json
import logging

logger = logging.getLogger(__name__)

class OrderListView(APIView):
    """API endpoint to list vendor's orders"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id=None):
        """Get all orders for a vendor"""
        try:
            # If vendor_id is provided, use it (for admin access)
            # Otherwise use the authenticated user's ID
            if vendor_id:
                # Check authorization
                if request.user.id != int(vendor_id) and not request.user.is_staff:
                    return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
                target_vendor_id = vendor_id
            else:
                target_vendor_id = request.user.id
            
            vendor = get_object_or_404(Vendor, id=target_vendor_id)
            
            # Get all orders for this vendor with related table data
            orders = Order.objects.filter(vendor=vendor).select_related('table').order_by('-created_at')
            
            orders_data = []
            for order in orders:
                # Get items for this order
                items = order.items.all().select_related('menu_item')
                
                items_data = [{
                    'id': item.id,
                    'name': item.menu_item.name if item.menu_item else "Deleted Item",
                    'price': str(item.price),
                    'quantity': item.quantity,
                } for item in items]
                
                # Format time elapsed
                time_elapsed = self._get_time_elapsed(order.created_at)
                
                # Enhanced table name resolution using table ID as primary reference
                table_name = self._resolve_table_name(order, vendor)
                
                orders_data.append({
                    'id': order.id,
                    'order_id': f"ORD{order.id:03d}",
                    'status': order.status,
                    'payment_status': order.payment_status,
                    'payment_method': order.payment_method,
                    'total_amount': str(order.total_amount),
                    'table_name': table_name,
                    'table_id': order.table.id if order.table else None,  # Include table ID
                    'qr_code': str(order.table.qr_code) if order.table else order.table_identifier,  # Current QR or stored identifier
                    'invoice_no': order.invoice_no,
                    'created_at': order.created_at.isoformat(),
                    'timestamp': order.created_at.isoformat(),
                    'time_elapsed': time_elapsed,
                    'items': items_data,
                    # Customer verification and delivery issue fields
                    'customer_verified': getattr(order, 'customer_verified', False),
                    'verification_timestamp': order.verification_timestamp.isoformat() if getattr(order, 'verification_timestamp', None) else None,
                    'delivery_issue_reported': getattr(order, 'delivery_issue_reported', False),
                    'issue_report_timestamp': order.issue_report_timestamp.isoformat() if getattr(order, 'issue_report_timestamp', None) else None,
                    'issue_description': getattr(order, 'issue_description', None),
                })
            
            return Response({
                'orders': orders_data,
                'count': len(orders_data)
            })
            
        except Exception as e:
            logger.error(f"Error fetching orders: {e}")
            return Response({
                'error': 'Failed to fetch orders',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _resolve_table_name(self, order, vendor):
        """Table name resolution prioritizing table ID over identifier"""
        try:
            # PRIORITY 1: Use the linked table if it exists (table ID is the primary reference)
            if order.table and order.table.id:
                # Refresh table data to get current name (in case it was renamed)
                try:
                    current_table = Table.objects.get(id=order.table.id, vendor=vendor)
                    # Update the order's table reference if needed (this handles renamed tables)
                    if order.table.name != current_table.name or order.table.qr_code != current_table.qr_code:
                        order.table = current_table
                        order.save(update_fields=['table'])
                        logger.info(f"Updated table reference for order {order.id} to current table data")
                    return current_table.name
                except Table.DoesNotExist:
                    # Table was deleted - keep the order but note the issue
                    logger.warning(f"Table ID {order.table.id} no longer exists for order {order.id}")
                    return f"Deleted Table (was: {order.table.name})"
            
            # PRIORITY 2: Try to find table by stored identifier (fallback for orders without table ID)
            if hasattr(order, 'table_identifier') and order.table_identifier:
                table_identifier = order.table_identifier
                
                try:
                    # Try to find by current QR code
                    matching_table = Table.objects.get(
                        vendor=vendor, 
                        qr_code=table_identifier,
                        is_active=True
                    )
                    # Link the order to this table for future efficiency
                    order.table = matching_table
                    order.save(update_fields=['table'])
                    logger.info(f"Linked order {order.id} to table {matching_table.id} via QR code lookup")
                    return matching_table.name
                    
                except Table.DoesNotExist:
                    # QR code doesn't match any current table
                    # This could be because the QR was regenerated or table was deleted
                    logger.warning(f"QR code '{table_identifier}' not found for vendor {vendor.id} in order {order.id}")
                    
                    # Try to find by table name as a last resort (less reliable but better than nothing)
                    possible_tables = Table.objects.filter(
                        vendor=vendor,
                        name__icontains=table_identifier.replace('QR', '').replace('_', ' ').strip()
                    )
                    
                    if possible_tables.exists():
                        best_match = possible_tables.first()
                        logger.info(f"Found possible table match by name pattern for order {order.id}: {best_match.name}")
                        return f"{best_match.name} (QR changed)"
                    
                    # Return the stored identifier as-is
                    return f"Table {table_identifier} (QR outdated)"
            
            # PRIORITY 3: Final fallback
            if order.invoice_no:
                return f"Unknown Table (Invoice: {order.invoice_no})"
            
            return "Unknown Table"
            
        except Exception as e:
            logger.error(f"Error resolving table name for order {order.id}: {e}")
            return "Unknown Table"
        
    def post(self, request):
        """Create a new order"""
        try:
            vendor_id = request.user.id
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Extract order data from request
            items_data = request.data.get('items', [])
            total_amount = request.data.get('total_amount', 0)
            table_identifier = request.data.get('table_identifier')  # QR code
            
            # Find table by QR code if provided
            table = None
            if table_identifier:
                try:
                    table = Table.objects.get(
                        vendor=vendor,
                        qr_code=table_identifier,
                        is_active=True
                    )
                    logger.info(f"Found table {table.name} (ID: {table.id}) for order creation")
                except Table.DoesNotExist:
                    logger.warning(f"Table with QR code '{table_identifier}' not found for vendor {vendor.id}")
            
            # Create a new order with table ID reference
            order = Order.objects.create(
                vendor=vendor,
                table=table,  # Primary reference by ID
                table_identifier=table_identifier,  # Store QR code for reference
                total_amount=total_amount,
                status='pending'
            )
            
            # Add order items
            for item_data in items_data:
                menu_item_id = item_data.get('id')
                quantity = item_data.get('quantity', 1)
                
                try:
                    menu_item = MenuItem.objects.get(id=menu_item_id)
                    OrderItem.objects.create(
                        order=order,
                        menu_item=menu_item,
                        quantity=quantity,
                        price=menu_item.price  # Use the current price
                    )
                except MenuItem.DoesNotExist:
                    logger.warning(f"Menu item {menu_item_id} not found when creating order {order.id}")
            
            # Send notification for new order
            try:
                from notifications.facade import notification_facade
                notification_facade.send_new_order_notification(vendor, order)
                logger.info(f"Sent new order notification for order {order.id}")
            except Exception as e:
                logger.error(f"Failed to send order notification for order {order.id}: {e}")
                logger.exception("Notification error details:")  # Log the full exception details
                
            # Send real-time update via WebSocket
            try:
                from notifications.order_utils import send_order_update
                send_order_update(order.id)
                logger.info(f"Sent WebSocket update for new order {order.id}")
            except Exception as e:
                logger.error(f"Failed to send WebSocket update for order {order.id}: {e}")
                logger.exception("WebSocket error details:")  # Log the full exception details
                logger.info(f"Sent WebSocket update for new order {order.id}")
            except Exception as e:
                logger.error(f"Failed to send WebSocket update for order {order.id}: {e}")
            
            return Response({
                'order_id': order.id,
                'table_id': table.id if table else None,
                'table_name': table.name if table else None,
                'message': 'Order created successfully'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating order: {e}")
            return Response({
                'error': 'Failed to create order'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _get_time_elapsed(self, created_at):
        """Calculate and format time elapsed since order creation"""
        now = timezone.now()
        diff = now - created_at
        
        minutes = int(diff.total_seconds() // 60)
        hours = minutes // 60
        days = hours // 24
        
        if days > 0:
            return f"{days} day{'s' if days > 1 else ''} ago"
        elif hours > 0:
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif minutes > 0:
            return f"{minutes} min{'s' if minutes > 1 else ''} ago"
        else:
            return "Just now"


class OrderStatusUpdateView(APIView):
    """API endpoint to update order status"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, order_id):
        """Update order status"""
        try:
            from ..models import Order  # Ensure Order is imported in the correct scope
            
            vendor = request.user
            order = get_object_or_404(Order, id=order_id, vendor=vendor)
            
            new_status = request.data.get('status')
            old_status = order.status
            
            if new_status and new_status != old_status:
                order.status = new_status
                order.save(update_fields=['status'])
                
                # Send notification for status update
                try:
                    from notifications.facade import notification_facade
                    
                    # Log to help debugging
                    logger.info(f"Sending order status update notification: Order #{order.id} status: {old_status} -> {new_status}")
                    
                    # Send notification through the facade
                    notification = notification_facade.send_order_status_update(vendor, order, old_status, new_status)
                    logger.info(f"Sent order status update notification for order {order.id}: {old_status} -> {new_status}")
                    
                    # Add notification ID to response for tracking
                    notification_id = getattr(notification, 'id', None)
                    if notification_id:
                        logger.info(f"Notification ID for order status update: {notification_id}")
                except Exception as e:
                    logger.error(f"Failed to send order status notification for order {order.id}: {e}")
                    logger.exception("Full notification error details:")
                
                # Send real-time update through WebSocket - enhanced logging and retrying
                try:
                    from notifications.order_utils import send_order_update
                    
                    # Log order details before sending update
                    logger.info(f"Order details before sending WebSocket update - ID: {order.id}, Status: {order.status}, "
                                f"Vendor ID: {order.vendor.id}, Table: {order.table.name if order.table else 'None'}, "
                                f"Table Identifier: {getattr(order, 'table_identifier', None)}")
                    
                    # Force a database refresh to ensure we're getting the most recent data
                    order.refresh_from_db()
                    
                    # Format complete order data to ensure all required fields are present
                    order_items = order.items.all().select_related('menu_item')
                    items_data = [{
                        "id": item.id,
                        "name": item.menu_item.name if item.menu_item else "Unknown Item",
                        "quantity": item.quantity,
                        "price": float(item.price)
                    } for item in order_items]
                    
                    # Create comprehensive order data
                    order_data = {
                        "id": order.id,
                        "status": order.status,
                        "vendor_id": order.vendor.id,
                        "table_identifier": getattr(order, 'table_identifier', None),
                        "qr_code": order.table.qr_code if order.table else None,
                        "table_name": order.table.name if order.table else None,
                        "items": items_data,
                        "total": float(order.total_amount),
                        "created_at": order.created_at.isoformat(),
                        "updated_at": timezone.now().isoformat(),
                        "server_timestamp": int(timezone.now().timestamp() * 1000),
                        "message": f"Order {order.id} status is now {order.status}"
                    }
                    
                    # Send the update with complete data
                    logger.info(f"Sending WebSocket update for order {order.id}, new status: {new_status}")
                    result = send_order_update(order.id, order_data)
                    logger.info(f"Sent WebSocket update for order {order.id}, result: {result}")
                    
                    # If the first attempt failed, try again after a short delay
                    if not result:
                        import time
                        time.sleep(0.5)  # 500ms delay
                        logger.info(f"Retrying WebSocket update for order {order.id}")
                        result = send_order_update(order.id, order_data)
                        logger.info(f"WebSocket update retry result: {result}")
                        
                    # If both attempts failed, try one last time with a direct channel layer approach
                    if not result:
                        logger.warning(f"Multiple WebSocket update failures for order {order.id}, trying with direct message")
                        from channels.layers import get_channel_layer
                        from asgiref.sync import async_to_sync
                        
                        channel_layer = get_channel_layer()
                        
                        # Send to vendor channel
                        vendor_channel = f'vendor_{order.vendor.id}'
                        logger.info(f"Sending direct order_status to vendor channel: {vendor_channel}")
                        async_to_sync(channel_layer.group_send)(
                            vendor_channel,
                            {
                                'type': 'order_status',
                                'data': order_data
                            }
                        )
                        logger.info(f"Sent direct update to vendor channel {vendor_channel} with status: {order.status}")
                        
                        # Send to order-specific channel if table identifier exists
                        if getattr(order, 'table_identifier', None):
                            order_channel = f'order_{order.vendor.id}_{order.table_identifier}'
                            logger.info(f"Sending direct order_status to table channel: {order_channel}")
                            async_to_sync(channel_layer.group_send)(
                                order_channel,
                                {
                                    'type': 'order_status',
                                    'data': order_data
                                }
                            )
                            logger.info(f"Sent direct update to table channel {order_channel}")
                        
                        # IMPORTANT: Send to order-specific tracking channel
                        order_specific_channel = f'order_{order.id}'
                        logger.info(f"Sending direct order_status_update to order-specific channel: {order_specific_channel}")
                        async_to_sync(channel_layer.group_send)(
                            order_specific_channel,
                            {
                                'type': 'order_status_update',
                                'data': order_data
                            }
                        )
                        logger.info(f"Sent direct update to order-specific channel {order_specific_channel}")
                        
                except Exception as e:
                    logger.error(f"Failed to send WebSocket update for order {order.id}: {e}")
                    logger.exception("Full traceback:")  # Log full exception for debugging
                
                return Response({
                    'id': order.id,
                    'status': order.status,
                    'message': f'Order status updated from {old_status} to {new_status}'
                })
            
            return Response({
                'id': order.id,
                'status': order.status,
                'message': 'No status change required'
            })
            
        except Exception as e:
            logger.error(f"Error updating order status: {e}")
            return Response({
                'error': 'Failed to update order status'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def patch(self, request, order_id):
        """Update order status - patch method"""
        return self.post(request, order_id)


class OrderDetailsView(View):
    """API endpoint to get order details"""
    
    def get(self, request, order_id=None):
        try:
            # If order_id is provided in the URL
            if order_id:
                order = Order.objects.select_related('table', 'vendor').get(id=order_id)
            # Otherwise check for invoice_no in query params
            else:
                invoice_no = request.GET.get('invoice_no')
                if not invoice_no:
                    return JsonResponse({"error": "Order ID or invoice number is required"}, status=400)
                order = Order.objects.select_related('table', 'vendor').get(invoice_no=invoice_no)
                
            # Get the order items
            order_items = order.items.all().select_related('menu_item')
            
            # Build response data
            items_data = []
            for item in order_items:
                menu_item_name = item.menu_item.name if item.menu_item else "Unknown Item"
                items_data.append({
                    "name": menu_item_name,
                    "quantity": item.quantity,
                    "price": float(item.price)
                })
            
            # Format vendor info
            vendor_data = {
                "id": order.vendor.id,
                "name": order.vendor.restaurant_name,
                "phone": order.vendor.phone or "N/A"
            }
            
            # Table name resolution using table ID as primary reference
            table_name = self._resolve_table_name_for_details(order)
            
            response_data = {
                "id": order.id,  # For frontend compatibility
                "order_id": order.id,
                "invoice_no": order.invoice_no,
                "timestamp": order.created_at.isoformat(),
                "created_at": order.created_at.isoformat(),  # For frontend compatibility
                "status": order.status,
                "payment_status": order.payment_status,
                "table_name": table_name,
                "table_id": order.table.id if order.table else None,
                "table_identifier": getattr(order, 'table_identifier', None),  # For frontend compatibility
                "qr_code": str(order.table.qr_code) if order.table else order.table_identifier,
                "total_amount": float(order.total_amount),
                "transaction_id": getattr(order, 'transaction_id', None),
                "vendor_id": order.vendor.id,  # For frontend compatibility
                "vendor_name": order.vendor.restaurant_name,  # For frontend compatibility
                "items": items_data,
                "vendor": vendor_data
            }
            
            return JsonResponse(response_data)
            
        except Order.DoesNotExist:
            return JsonResponse({"error": "Order not found"}, status=404)
        except Exception as e:
            logger.error(f"Error fetching order details: {e}")
            return JsonResponse({"error": str(e)}, status=500)
    
    def _resolve_table_name_for_details(self, order):
        """Resolve table name for order details view using table ID as primary reference"""
        try:
            # Primary: Use table ID if linked
            if order.table and order.table.id:
                try:
                    # Get current table data to ensure we have the latest name
                    current_table = Table.objects.get(id=order.table.id, vendor=order.vendor)
                    return current_table.name
                except Table.DoesNotExist:
                    return f"Deleted Table (was: {order.table.name})"
            
            # Fallback: Use stored identifier
            if hasattr(order, 'table_identifier') and order.table_identifier:
                return f"Table {order.table_identifier}"
            
            return "Unknown Table"
            
        except Exception as e:
            logger.error(f"Error resolving table name for order details {order.id}: {e}")
            return "Unknown Table"


class OrderCreationMixin:
    """Mixin to handle order creation notifications"""
    
    def send_new_order_notification(self, order):
        """Send notification when a new order is created"""
        try:
            notification_facade.send_new_order_notification(order.vendor, order)
            logger.info(f"New order notification sent for order {order.id}")
        except Exception as e:
            logger.error(f"Failed to send new order notification for order {order.id}: {e}")


class TrackOrderView(View):
    """API endpoint for customers to track an order"""
    
    def get(self, request):
        """Get order details for tracking"""
        try:
            # Get order_id from query parameters
            order_id = request.GET.get('order_id')
            
            if not order_id:
                return JsonResponse({"error": "Order ID is required"}, status=400)
            
            try:
                order = Order.objects.select_related('table', 'vendor').get(id=order_id)
            except Order.DoesNotExist:
                return JsonResponse({"error": "Order not found"}, status=404)
            
            # Get order items
            order_items = order.items.all().select_related('menu_item')
            
            # Format items data
            items_data = []
            for item in order_items:
                menu_item_name = item.menu_item.name if item.menu_item else "Unknown Item"
                items_data.append({
                    "id": item.id,
                    "name": menu_item_name,
                    "quantity": item.quantity,
                    "price": str(item.price)
                })
              # Calculate time elapsed
            time_elapsed = self._get_time_elapsed(order.created_at)
            
            # Get table name
            table_name = "Table"  # Default fallback
            if order.table and order.table.name:
                table_name = order.table.name
            elif order.table_identifier:
                table_name = order.table_identifier
            # If no table info available, keep default "Table"
            
            # Calculate estimated time based on status and time elapsed
            estimated_time = self._calculate_estimated_time(order.status, order.created_at)
            
            # Format response
            response_data = {
                "id": order.id,
                "order_id": order.id,
                "status": order.status,
                "total_amount": str(order.total_amount),
                "total": str(order.total_amount),
                "created_at": order.created_at.isoformat(),
                "timestamp": order.created_at.isoformat(),
                "updated_at": order.updated_at.isoformat(),
                "time_elapsed": time_elapsed,
                "estimated_time": estimated_time,
                "estimatedTime": estimated_time,
                "table_identifier": order.table_identifier,
                "table_name": table_name,
                "table_id": order.table.id if order.table else None,
                "vendor_id": order.vendor.id,
                "vendor_name": order.vendor.restaurant_name,
                "payment_status": order.payment_status,
                "items": items_data,
                "restaurant": {
                    "id": order.vendor.id,
                    "name": order.vendor.restaurant_name,
                    "phone": order.vendor.phone if hasattr(order.vendor, 'phone') and order.vendor.phone else None,
                    "contact": order.vendor.phone if hasattr(order.vendor, 'phone') and order.vendor.phone else None,
                }
            }
            
            return JsonResponse(response_data)
            
        except Exception as e:
            logger.error(f"Error tracking order: {e}")
            return JsonResponse({"error": str(e)}, status=500)
    
    def _get_time_elapsed(self, created_at):
        """Calculate and format time elapsed since order creation"""
        now = timezone.now()
        diff = now - created_at
        
        minutes = int(diff.total_seconds() // 60)
        hours = minutes // 60
        days = hours // 24
        
        if days > 0:
            return f"{days} day{'s' if days > 1 else ''} ago"
        elif hours > 0:
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif minutes > 0:
            return f"{minutes} min{'s' if minutes > 1 else ''} ago"
        else:
            return "Just now"
    
    def _calculate_estimated_time(self, status, created_at):
        """Calculate estimated time based on status and time elapsed"""
        # For completed/cancelled/rejected orders
        if status in ['completed', 'cancelled', 'rejected']:
            return status.capitalize()
        
        # For ready orders
        if status == 'ready':
            return "Ready now"
        
        # For active orders, calculate remaining time
        now = timezone.now()
        elapsed_minutes = int((now - created_at).total_seconds() // 60)
        
        # Base time estimates by status
        base_times = {
            'pending': 10,
            'accepted': 20,
            'confirmed': 20,
            'preparing': 15,
        }
        
        base_time = base_times.get(status, 20)
        remaining = max(0, base_time - elapsed_minutes)
        
        if remaining <= 0:
            return "Almost ready"
        elif remaining <= 5:
            return f"{remaining}-{remaining + 2} minutes"
        else:
            return f"{remaining}-{remaining + 5} minutes"


@method_decorator(csrf_exempt, name="dispatch")
class CreateOrderView(View):
    """API endpoint to create orders before payment"""
    
    def post(self, request):
        """Create a new order without payment"""
        try:
            data = json.loads(request.body)
            items = data.get("items", [])
            vendor_id = data.get("vendor_id")
            table_identifier = data.get("table_identifier")
            
            if not items:
                return JsonResponse({"error": "No items provided"}, status=400)
                
            if not vendor_id:
                return JsonResponse({"error": "Vendor ID required"}, status=400)
            
            # Get vendor
            try:
                vendor = Vendor.objects.get(id=vendor_id)
            except Vendor.DoesNotExist:
                return JsonResponse({"error": "Vendor not found"}, status=404)
            
            # Get table if identifier provided
            table = None
            table_name = "Table"
            if table_identifier:
                try:
                    table = Table.objects.get(vendor=vendor, qr_code=table_identifier)
                    table_name = table.name
                except Table.DoesNotExist:
                    table_name = table_identifier
            
            # Validate and get menu items
            item_ids = [item["id"] for item in items]
            menu_items = MenuItem.objects.filter(
                id__in=item_ids, 
                vendor=vendor, 
                is_available=True
            )
            
            if len(menu_items) != len(item_ids):
                return JsonResponse({"error": "Some items are not available"}, status=400)
            
            # Create menu items lookup
            menu_items_dict = {item.id: item for item in menu_items}
            
            # Calculate total
            total_amount = 0
            for item_data in items:
                menu_item = menu_items_dict[item_data["id"]]
                total_amount += float(menu_item.price) * item_data["quantity"]
            
            # Create order
            invoice_no = f"INV{int(timezone.now().timestamp())}"
            order = Order.objects.create(
                vendor=vendor,
                table=table,
                table_identifier=table_identifier,
                invoice_no=invoice_no,
                status="pending",  # Pending vendor acceptance
                payment_status="pending",
                total_amount=total_amount
            )
            
            # Create order items
            logger.info(f"Processing {len(items)} items for order #{order.id}")
            created_items = []
            
            for item_data in items:
                try:
                    menu_item = menu_items_dict[item_data["id"]]
                    order_item = OrderItem.objects.create(
                        order=order,
                        menu_item=menu_item,
                        quantity=item_data["quantity"],
                        price=menu_item.price
                    )
                    created_items.append({
                        "name": menu_item.name,
                        "quantity": item_data["quantity"],
                        "price": str(menu_item.price),
                        "item_id": menu_item.id
                    })
                    logger.info(f"Created order item: {menu_item.name} (x{item_data['quantity']}) for order #{order.id}")
                except Exception as e:
                    logger.error(f"Error creating order item for {item_data}: {e}")
            
            logger.info(f"Created {len(created_items)} order items for order #{order.id}")
            
            # Refresh the order to ensure it includes all items
            order.refresh_from_db()
            
            # Send notification to vendor about new order
            try:
                from notifications.facade import notification_facade
                
                # Send new order notification using the notification service
                notification = notification_facade.send_new_order_notification(vendor, order)
                logger.info(f"Sent new order notification for order {order.id}")
                
                # Send WebSocket update
                try:
                    from notifications.order_utils import send_order_update
                    send_order_update(order.id)
                    logger.info(f"Sent WebSocket update for order {order.id}")
                except Exception as e:
                    logger.error(f"Failed to send WebSocket update for order {order.id}: {e}")
                    logger.exception("WebSocket error details:")
            except Exception as e:
                logger.error(f"Failed to send new order notification: {e}")
            
            # Store order info in response for frontend to save in localStorage
            order_info = {
                "id": order.id,
                "status": order.status,
                "timestamp": order.created_at.isoformat(),
                "total": str(total_amount),
                "vendor_id": vendor.id,
                "table_identifier": table_identifier,
                "table_name": table_name
            }
            
            return JsonResponse({
                "success": True,
                "order": order_info,
                "message": "Order created successfully. Waiting for restaurant confirmation."
            })
            
        except Exception as e:
            logger.error(f"Error creating order: {e}")
            return JsonResponse({"error": str(e)}, status=500)

class OrderStatusView(APIView):
    """API endpoint to get order status"""
    
    def get(self, request, order_id):
        """Get order status"""
        try:
            from ..models import Order
            
            order = get_object_or_404(Order, id=order_id)
            
            # Get items for this order
            items = order.items.all().select_related('menu_item')
            
            items_data = [{
                'id': item.id,
                'name': item.menu_item.name if item.menu_item else "Deleted Item",
                'price': float(item.price),
                'quantity': item.quantity,
            } for item in items]
            
            # Enhanced table name resolution
            table_name = self._resolve_table_name(order)
            
            # Complete order information
            order_data = {
                'id': order.id,
                'order_id': order.id,  # For frontend compatibility
                'status': order.status,
                'payment_status': order.payment_status,
                'total_amount': str(order.total_amount),
                'created_at': order.created_at.isoformat(),
                'timestamp': order.created_at.isoformat(),  # For frontend compatibility
                'updated_at': order.updated_at.isoformat() if hasattr(order, 'updated_at') else None,
                'table_name': table_name,
                'table_id': order.table.id if order.table else None,
                'vendor_id': order.vendor.id,
                'vendor_name': order.vendor.name if hasattr(order.vendor, 'name') else "Restaurant",
                'table_identifier': getattr(order, 'table_identifier', None),
                'invoice_no': getattr(order, 'invoice_no', None),
                'transaction_id': getattr(order, 'transaction_id', None),
                'items': items_data,
            }
            
            return Response(order_data)
            
        except Exception as e:
            logger.error(f"Error fetching order status: {e}")
            return Response({
                'error': 'Failed to fetch order status'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _resolve_table_name(self, order):
        """Table name resolution for order status"""
        try:
            # Use the linked table if it exists
            if order.table and order.table.id:
                return order.table.name
            
            # Fallback to stored identifier
            if hasattr(order, 'table_identifier') and order.table_identifier:
                return f"Table {order.table_identifier}"
            
            # Final fallback
            return "Unknown Table"
            
        except Exception as e:
            logger.error(f"Error resolving table name for order {order.id}: {e}")
            return "Unknown Table"


@method_decorator(csrf_exempt, name="dispatch")
class OrderVerificationView(View):
    """API endpoint for customers to verify order completion"""
    
    def post(self, request, order_id):
        """Verify that customer has received their order"""
        try:
            # Parse JSON data
            data = json.loads(request.body.decode('utf-8'))
            
            # Get the order
            order = get_object_or_404(Order, id=order_id)
            
            # Validate that order is in delivered status
            if order.status != 'delivered':
                return JsonResponse({
                    'error': 'Order must be in delivered status to verify completion',
                    'current_status': order.status
                }, status=400)
            
            # Check if already verified
            if order.customer_verified:
                return JsonResponse({
                    'message': 'Order has already been verified',
                    'verification_timestamp': order.verification_timestamp.isoformat() if order.verification_timestamp else None
                })
            
            # Verify the order
            order.customer_verified = data.get('verified', True)
            order.verification_timestamp = timezone.now()
            order.status = 'completed'  # Move to completed status after verification
            order.save()
            
            # Send WebSocket update for status change
            try:
                send_order_update(order.id)
                logger.info(f"Sent WebSocket update for order {order.id} verification")
            except Exception as e:
                logger.error(f"Failed to send WebSocket update for order {order.id}: {e}")
            
            # Send notification to vendor
            try:
                notification_facade.create_vendor_notification(
                    vendor=order.vendor,
                    title="Order Verified",
                    message=f"Customer has verified receipt of Order #{order.id}",
                    notification_type="order_verified",
                    data={'order_id': order.id}
                )
                logger.info(f"Sent verification notification for order {order.id}")
            except Exception as e:
                logger.error(f"Failed to send verification notification for order {order.id}: {e}")
            
            return JsonResponse({
                'message': 'Order verification successful',
                'order_id': order.id,
                'status': order.status,
                'verified': order.customer_verified,
                'verification_timestamp': order.verification_timestamp.isoformat()
            })
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            logger.error(f"Error verifying order {order_id}: {e}")
            return JsonResponse({
                'error': 'Failed to verify order',
                'details': str(e)
            }, status=500)


@method_decorator(csrf_exempt, name="dispatch")
class OrderIssueReportView(View):
    """API endpoint for customers to report delivery issues"""
    
    def post(self, request, order_id):
        """Report that customer did not receive their order"""
        try:
            # Parse JSON data
            data = json.loads(request.body.decode('utf-8'))
            
            # Get the order
            order = get_object_or_404(Order, id=order_id)
            
            # Validate that order is in delivered status
            if order.status != 'delivered':
                return JsonResponse({
                    'error': 'Order must be in delivered status to report delivery issues',
                    'current_status': order.status
                }, status=400)
            
            # Check if issue already reported
            if order.delivery_issue_reported:
                return JsonResponse({
                    'message': 'Delivery issue has already been reported for this order',
                    'issue_report_timestamp': order.issue_report_timestamp.isoformat() if order.issue_report_timestamp else None
                })
            
            # Report the issue
            order.delivery_issue_reported = True
            order.issue_report_timestamp = timezone.now()
            order.issue_description = data.get('description', 'Customer reports not receiving the delivered order')
            order.save()
            
            # Send WebSocket update to vendor (status remains delivered but with issue flag)
            try:
                send_order_update(order.id)
                logger.info(f"Sent WebSocket update for order {order.id} issue report")
                
                # Also send a specific delivery issue notification to the customer's order tracking
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                
                channel_layer = get_channel_layer()
                
                # Send to order-specific channel for customer's order tracking page
                delivery_issue_data = {
                    'type': 'delivery_issue',
                    'data': {
                        'order_id': order.id,
                        'delivery_issue_reported': True,
                        'issue_report_timestamp': order.issue_report_timestamp.isoformat(),
                        'issue_description': order.issue_description,
                    }
                }
                
                async_to_sync(channel_layer.group_send)(
                    f'order_{order.id}',
                    {
                        'type': 'delivery_issue_update',
                        'data': delivery_issue_data
                    }
                )
                logger.info(f"Sent delivery issue notification to customer tracking for order {order.id}")
                
            except Exception as e:
                logger.error(f"Failed to send WebSocket update for order {order.id}: {e}")
            
            # Send urgent notification to vendor
            try:
                issue_type = data.get('issue_type', 'delivery_not_received')
                notification_facade.create_vendor_notification(
                    vendor=order.vendor,
                    title="⚠️ Delivery Issue Reported",
                    message=f"Customer reports delivery issue for Order #{order.id}: {order.issue_description}",
                    notification_type="delivery_issue",
                    data={
                        'order_id': order.id,
                        'issue_type': issue_type,
                        'urgency': 'high'
                    }
                )
                logger.info(f"Sent delivery issue notification for order {order.id}")
            except Exception as e:
                logger.error(f"Failed to send delivery issue notification for order {order.id}: {e}")
            
            return JsonResponse({
                'message': 'Delivery issue reported successfully. The restaurant has been notified.',
                'order_id': order.id,
                'issue_reported': order.delivery_issue_reported,
                'issue_report_timestamp': order.issue_report_timestamp.isoformat(),
                'issue_description': order.issue_description
            })
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            logger.error(f"Error reporting delivery issue for order {order_id}: {e}")
            return JsonResponse({
                'error': 'Failed to report delivery issue',
                'details': str(e)
            }, status=500)


class OrderIssueResolutionView(APIView):
    """API endpoint for vendors to mark delivery issues as resolved"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, order_id):
        """Mark delivery issue as resolved"""
        try:
            # Parse JSON data
            data = json.loads(request.body.decode('utf-8'))
            
            # Get the order
            order = get_object_or_404(Order, id=order_id)
            
            # Check if user is the vendor for this order
            if request.user.id != order.vendor_id:
                return JsonResponse({
                    'error': 'Unauthorized: You can only resolve issues for your own orders'
                }, status=403)
            
            # Validate that order has a reported delivery issue
            if not order.delivery_issue_reported:
                return JsonResponse({
                    'error': 'No delivery issue reported for this order',
                    'delivery_issue_reported': order.delivery_issue_reported
                }, status=400)
            
            # Check if issue already resolved
            if getattr(order, 'issue_resolved', False):
                return JsonResponse({
                    'message': 'Delivery issue has already been resolved for this order',
                    'issue_resolution_timestamp': getattr(order, 'issue_resolution_timestamp', None).isoformat() if getattr(order, 'issue_resolution_timestamp', None) else None
                })
            
            # Mark the issue as resolved
            order.issue_resolved = True
            order.issue_resolution_timestamp = timezone.now()
            order.resolution_message = data.get('resolution_message', 'Issue has been resolved by the restaurant')
            order.save()
            
            # Send WebSocket update to customer's order tracking
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                
                channel_layer = get_channel_layer()
                
                # Send to order-specific channel for customer's order tracking page
                resolution_data = {
                    'type': 'issue_resolution',
                    'data': {
                        'order_id': order.id,
                        'issue_resolved': True,
                        'resolution_timestamp': order.issue_resolution_timestamp.isoformat(),
                        'resolution_message': order.resolution_message,
                    }
                }
                
                async_to_sync(channel_layer.group_send)(
                    f'order_{order.id}',
                    {
                        'type': 'issue_resolution_update',
                        'data': resolution_data
                    }
                )
                logger.info(f"Sent issue resolution notification to customer tracking for order {order.id}")
                
                # Also send updated order status to vendor dashboard
                send_order_update(order.id)
                
            except Exception as e:
                logger.error(f"Failed to send WebSocket update for order {order.id} resolution: {e}")
            
            return JsonResponse({
                'message': 'Delivery issue marked as resolved. Customer has been notified.',
                'order_id': order.id,
                'issue_resolved': order.issue_resolved,
                'issue_resolution_timestamp': order.issue_resolution_timestamp.isoformat(),
                'resolution_message': order.resolution_message
            })
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        except Exception as e:
            logger.error(f"Error resolving delivery issue for order {order_id}: {e}")
            return JsonResponse({
                'error': 'Failed to resolve delivery issue',
                'details': str(e)
            }, status=500)