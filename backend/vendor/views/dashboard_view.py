from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from django.contrib.auth import get_user_model
from ..models import Order, MenuItem
import logging
from django.shortcuts import get_object_or_404
from decimal import Decimal

# Set up logger
logger = logging.getLogger(__name__)

class DashboardStatsView(APIView):
    """
    API endpoint to get dashboard statistics
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id):
        """Get dashboard statistics for a vendor"""
        try:
            # Check authorization
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                logger.warning(f"Unauthorized access attempt to dashboard stats for vendor {vendor_id} by user {request.user.id}")
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get user/vendor - using get_object_or_404 for better error handling
            Vendor = get_user_model()
            try:
                vendor = Vendor.objects.get(id=vendor_id)
                logger.info(f"Retrieved vendor: {vendor.id} ({vendor.email})")
            except Vendor.DoesNotExist:
                logger.error(f"Vendor with ID {vendor_id} not found")
                return Response({'error': 'Vendor not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Get total orders with error handling
            try:
                total_orders = Order.objects.filter(vendor=vendor).count()
                logger.info(f"Total orders for vendor {vendor_id}: {total_orders}")
            except Exception as e:
                logger.error(f"Error counting orders: {str(e)}")
                total_orders = 0
            
            # Get active menu items with error handling
            try:
                active_items = MenuItem.objects.filter(
                    vendor=vendor,
                    is_available=True
                ).count()
                logger.info(f"Active items for vendor {vendor_id}: {active_items}")
            except Exception as e:
                logger.error(f"Error counting active items: {str(e)}")
                active_items = 0
            
            # Calculate total revenue with error handling
            try:
                revenue_data = Order.objects.filter(
                    vendor=vendor,
                    status='completed',
                    payment_status='paid'
                ).aggregate(total=Sum('total_amount'))
                
                total_revenue = revenue_data['total'] or Decimal('0.0')
                logger.info(f"Total revenue for vendor {vendor_id}: {total_revenue}")
            except Exception as e:
                logger.error(f"Error calculating revenue: {str(e)}")
                total_revenue = Decimal('0.0')
            
            # Calculate unique customers with error handling
            try:
                # First try with both table_no and table_qr
                if hasattr(Order, 'table_no') and hasattr(Order, 'table_qr'):
                    unique_tables = Order.objects.filter(vendor=vendor).values('table_no', 'table_qr').distinct().count()
                # Fallback to just table_no if table_qr doesn't exist
                elif hasattr(Order, 'table_no'):
                    unique_tables = Order.objects.filter(vendor=vendor).values('table_no').exclude(table_no=None).distinct().count()
                else:
                    unique_tables = 0
                
                # Estimate customers as tables * 2 or minimum 1
                total_customers = max(unique_tables * 2, 1)
                logger.info(f"Estimated customers for vendor {vendor_id}: {total_customers} (based on {unique_tables} tables)")
            except Exception as e:
                logger.error(f"Error calculating customers: {str(e)}")
                total_customers = 1
            
            # Return all statistics
            response_data = {
                'total_orders': total_orders,
                'active_items': active_items,
                'total_customers': total_customers,
                'total_revenue': float(total_revenue)
            }
            
            logger.info(f"Successfully retrieved dashboard stats for vendor {vendor_id}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Unhandled error in DashboardStatsView: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An unexpected error occurred. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )