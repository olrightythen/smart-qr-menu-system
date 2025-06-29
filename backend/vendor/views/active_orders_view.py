from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from vendor.models import Vendor, Order
import logging

logger = logging.getLogger(__name__)

class ActiveOrdersView(APIView):
    """API endpoint to get active orders for a table"""
    
    def get(self, request, vendor_id):
        """Get active orders for a table"""
        try:
            # Get vendor
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get table identifier from query params
            table_identifier = request.query_params.get('table_identifier')
            
            if not table_identifier:
                return Response({
                    'error': 'Missing table_identifier parameter'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get active orders for this table
            active_statuses = ['pending', 'accepted', 'preparing', 'ready']
            active_orders = Order.objects.filter(
                vendor=vendor,
                table_identifier=table_identifier,
                status__in=active_statuses
            ).order_by('-created_at')
            
            # Format orders
            orders_data = []
            for order in active_orders:
                # Get items for this order
                items = order.items.all().select_related('menu_item')
                
                items_data = [{
                    'id': item.id,
                    'name': item.menu_item.name if item.menu_item else "Deleted Item",
                    'price': str(item.price),
                    'quantity': item.quantity,
                } for item in items]
                
                orders_data.append({
                    'id': order.id,
                    'status': order.status,
                    'payment_status': order.payment_status,
                    'total_amount': str(order.total_amount),
                    'table_identifier': order.table_identifier,
                    'vendor_id': vendor.id,
                    'created_at': order.created_at.isoformat(),
                    'items': items_data
                })
            
            return Response({
                'orders': orders_data,
                'count': len(orders_data)
            })
            
        except Exception as e:
            logger.error(f"Error fetching active orders: {e}")
            return Response({
                'error': 'Failed to fetch active orders',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
