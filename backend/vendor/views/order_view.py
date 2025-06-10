# Create a new file: vendor/views/order_view.py

from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse
from django.views import View
from ..models import Order, OrderItem, Vendor, Table
from django.core.serializers import serialize
from django.utils import timezone
from notifications.facade import notification_facade
from notifications.utils import send_order_notification
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
                    'items': items_data
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
                menu_item_id = item_data.get('menu_item_id')
                quantity = item_data.get('quantity', 1)
                
                OrderItem.objects.create(
                    order=order,
                    menu_item_id=menu_item_id,
                    quantity=quantity
                )
            
            # Send notification for new order
            try:
                send_order_notification(vendor, order, 'order')
                logger.info(f"Sent new order notification for order {order.id}")
            except Exception as e:
                logger.error(f"Failed to send order notification for order {order.id}: {e}")
            
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
            vendor = request.user
            order = get_object_or_404(Order, id=order_id, vendor=vendor)
            
            new_status = request.data.get('status')
            old_status = order.status
            
            if new_status and new_status != old_status:
                order.status = new_status
                order.save()
                
                # Send notification for status update
                try:
                    send_order_notification(vendor, order, 'order')
                    logger.info(f"Sent order status update notification for order {order.id}: {old_status} -> {new_status}")
                except Exception as e:
                    logger.error(f"Failed to send order status notification for order {order.id}: {e}")
                
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
                "order_id": order.id,
                "invoice_no": order.invoice_no,
                "timestamp": order.created_at.isoformat(),
                "status": order.status,
                "payment_status": order.payment_status,
                "table_name": table_name,
                "table_id": order.table.id if order.table else None,
                "qr_code": str(order.table.qr_code) if order.table else order.table_identifier,
                "total_amount": float(order.total_amount),
                "transaction_id": order.transaction_id,
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