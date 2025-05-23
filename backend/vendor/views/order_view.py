# Create a new file: vendor/views/order_view.py

from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse
from django.views import View
from ..models import Order, OrderItem, Vendor
from django.core.serializers import serialize
from django.utils import timezone
import json
import logging

logger = logging.getLogger(__name__)

class OrderListView(APIView):
    """API endpoint to list vendor's orders"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id):
        """Get all orders for a vendor"""
        try:
            # Check authorization
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get all orders for this vendor
            orders = Order.objects.filter(vendor=vendor).order_by('-created_at')
            
            orders_data = []
            for order in orders:
                # Get items for this order
                items = order.items.all()
                
                items_data = [{
                    'id': item.id,
                    'name': item.menu_item.name if item.menu_item else "Unknown Item",
                    'price': str(item.price),
                    'quantity': item.quantity,
                } for item in items]
                
                # Format time elapsed
                time_elapsed = self._get_time_elapsed(order.created_at)
                
                orders_data.append({
                    'id': order.id,
                    'order_id': f"ORD{order.id:03d}",  # Format like ORD001
                    'status': order.status,
                    'payment_status': order.payment_status,
                    'payment_method': order.payment_method,
                    'total_amount': str(order.total_amount),
                    'table_no': order.table_no,
                    'invoice_no': order.invoice_no,
                    'created_at': order.created_at.isoformat(),
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
        """Update the status of an order"""
        try:
            order = get_object_or_404(Order, id=order_id)
            
            # Check authorization
            if request.user.id != order.vendor.id and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get the new status
            new_status = request.data.get('status')
            if not new_status or new_status not in [status[0] for status in Order.STATUS_CHOICES]:
                return Response({
                    'error': 'Invalid status',
                    'valid_statuses': [status[0] for status in Order.STATUS_CHOICES]
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update the status
            order.status = new_status
            order.save()
            
            return Response({
                'id': order.id,
                'status': order.status,
                'message': 'Order status updated successfully'
            })
            
        except Exception as e:
            logger.error(f"Error updating order status: {e}")
            return Response({
                'error': 'Failed to update order status',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class OrderDetailsView(View):
    def get(self, request, order_id=None):
        try:
            # If order_id is provided in the URL
            if order_id:
                order = Order.objects.get(id=order_id)
            # Otherwise check for invoice_no in query params
            else:
                invoice_no = request.GET.get('invoice_no')
                if not invoice_no:
                    return JsonResponse({"error": "Order ID or invoice number is required"}, status=400)
                order = Order.objects.get(invoice_no=invoice_no)
                
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
            
            response_data = {
                "order_id": order.id,
                "invoice_no": order.invoice_no,
                "timestamp": order.created_at.isoformat(),
                "status": order.status,
                "payment_status": order.payment_status,
                "table_no": order.table_no,
                "total_amount": float(order.total_amount),
                "transaction_id": order.transaction_id,
                "items": items_data,
                "vendor": vendor_data
            }
            
            return JsonResponse(response_data)
            
        except Order.DoesNotExist:
            return JsonResponse({"error": "Order not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)