from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDate, Extract
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta
from decimal import Decimal
import calendar
import logging
import os

from ..models import Order, MenuItem

logger = logging.getLogger(__name__)

class VendorProfileView(APIView):
    """
    Get vendor details by ID - using the same approach as VendorDetailView
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id):
        try:
            logger.info(f"Fetching vendor with ID: {vendor_id}")
            
            # Check if the requesting user has permission to access this vendor's data
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                logger.warning(f"Permission denied: User {request.user.id} tried to access vendor {vendor_id}")
                return Response(
                    {"error": "You do not have permission to access this data"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            logger.info(f"Retrieving user object for vendor ID: {vendor_id}")    
            user = get_user_model().objects.get(id=vendor_id)
            logger.info(f"User found: {user.email}")
            
            # Build user data carefully to avoid attribute errors
            user_data = {
                "id": user.id,
                "email": user.email,
            }
            
            # Add each field individually with explicit logging
            fields_to_check = ['restaurant_name', 'owner_name', 'phone', 'location', 
                              'description', 'opening_time', 'closing_time']
            
            for field in fields_to_check:
                try:
                    if hasattr(user, field):
                        value = getattr(user, field)
                        user_data[field] = value
                        logger.debug(f"Added field {field}: {value}")
                    else:
                        user_data[field] = ""
                        logger.debug(f"Field {field} not found on user model")
                except Exception as field_error:
                    logger.error(f"Error accessing field {field}: {str(field_error)}")
                    user_data[field] = ""
            
            # Handle logo separately to avoid errors - SAME AS WORKING VERSION
            try:
                logger.info("Checking for logo field")
                if hasattr(user, 'logo') and user.logo:
                    user_data["logo"] = request.build_absolute_uri(user.logo.url)
                    logger.info(f"Logo found: {user.logo.url}")
                else:
                    user_data["logo"] = None
                    logger.info("No logo available")
            except Exception as logo_error:
                logger.error(f"Error accessing logo: {str(logo_error)}")
                user_data["logo"] = None
            
            logger.info("Successfully prepared vendor data for response")
            return Response(user_data, status=status.HTTP_200_OK)
            
        except get_user_model().DoesNotExist:
            logger.warning(f"Vendor with ID {vendor_id} not found")
            return Response(
                {"error": "Vendor not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            # Log the full error for debugging
            logger.error(f"Error in VendorProfileView: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while retrieving vendor data"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VendorProfileUpdateView(APIView):
    """
    Update vendor details - using the same approach as VendorUpdateView
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def put(self, request, vendor_id):
        try:
            # Check if the requesting user has permission to update this vendor's data
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to update this data"},
                    status=status.HTTP_403_FORBIDDEN
                )
                
            user = get_user_model().objects.get(id=vendor_id)
            
            # Process logo file if provided - SAME AS WORKING VERSION
            if 'logo' in request.FILES:
                logo_file = request.FILES['logo']
                
                 # Validate file type
                valid_extensions = ['.jpg', '.jpeg', '.png', '.gif']
                ext = os.path.splitext(logo_file.name)[1].lower()
                
                if ext not in valid_extensions:
                    return Response(
                        {"error": "Unsupported file type. Please upload a JPEG, PNG, or GIF image."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Validate file size (max 5MB)
                if logo_file.size > 5 * 1024 * 1024:  # 5MB
                    return Response(
                        {"error": "File size should be less than 5MB"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                
                # Delete old logo if exists
                if user.logo:
                    try:
                        if os.path.isfile(user.logo.path):
                            os.remove(user.logo.path)
                    except Exception as delete_error:
                        logger.error(f"Error deleting old logo: {str(delete_error)}")
                
                # Simply assign the uploaded file
                user.logo = logo_file
            
            # Process regular form fields - SAME AS WORKING VERSION
            if 'restaurant_name' in request.data and hasattr(user, 'restaurant_name'):
                user.restaurant_name = request.data['restaurant_name']
            if 'owner_name' in request.data and hasattr(user, 'owner_name'):
                user.owner_name = request.data['owner_name']
            if 'email' in request.data:
                # Check if the email is already in use by another account
                if get_user_model().objects.exclude(id=vendor_id).filter(email=request.data['email']).exists():
                    return Response(
                        {"error": "This email is already in use by another account"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                user.email = request.data['email']
            if 'phone' in request.data and hasattr(user, 'phone'):
                user.phone = request.data['phone']
            if 'location' in request.data and hasattr(user, 'location'):
                user.location = request.data['location']
            if 'description' in request.data and hasattr(user, 'description'):
                user.description = request.data['description']
            if 'opening_time' in request.data and hasattr(user, 'opening_time'):
                user.opening_time = request.data['opening_time']
            if 'closing_time' in request.data and hasattr(user, 'closing_time'):
                user.closing_time = request.data['closing_time']
            
            # Save the user
            user.save()
            
            # Clear relevant caches
            cache_keys = [
                f"dashboard_stats_{vendor_id}",
                f"vendor_profile_{vendor_id}"
            ]
            for cache_key in cache_keys:
                cache.delete(cache_key)
            
            # Prepare response data - SAME AS WORKING VERSION
            response_data = {
                "message": "Vendor details updated successfully"
            }
            
            # Include logo URL in response if available
            if user.logo:
                response_data["logo"] = request.build_absolute_uri(user.logo.url)
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except get_user_model().DoesNotExist:
            return Response(
                {"error": "Vendor not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in VendorProfileUpdateView: {str(e)}", exc_info=True)
            return Response(
                {"error": f"An error occurred while updating vendor data: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

class SalesReportView(APIView):
    """
    API endpoint for sales reports with flexible timeframes
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    VALID_TIMEFRAMES = ['day', 'week', 'month']
    
    def get(self, request, vendor_id):
        try:
            # Validate vendor access
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            vendor = get_object_or_404(get_user_model(), id=vendor_id)
            timeframe = request.query_params.get('timeframe', 'week')
            
            if timeframe not in self.VALID_TIMEFRAMES:
                return Response(
                    {'error': f'Invalid timeframe. Must be one of: {", ".join(self.VALID_TIMEFRAMES)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate report (don't use cache for debugging)
            report_data = self._generate_sales_report(vendor_id, timeframe)
            
            logger.info(f"Generated sales report for vendor {vendor_id}, timeframe {timeframe}: {report_data}")
            
            return Response(report_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating sales report for vendor {vendor_id}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to generate sales report'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_date_ranges(self, timeframe):
        """Calculate current and previous period date ranges"""
        now = timezone.now()
        logger.info(f"Current time: {now}")
        
        if timeframe == 'day':
            # Today
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            # Yesterday
            prev_start = start_date - timedelta(days=1)
            prev_end = prev_start.replace(hour=23, minute=59, second=59, microsecond=999999)
            
        elif timeframe == 'week':
            # This week (Monday to Sunday)
            days_since_monday = now.weekday()
            start_date = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            # Previous week
            prev_start = start_date - timedelta(weeks=1)
            prev_end = start_date - timedelta(seconds=1)
            
        else:  # month
            # This month
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            # Previous month
            if start_date.month == 1:
                prev_start = start_date.replace(year=start_date.year-1, month=12, day=1)
                # Get last day of previous year's December
                prev_end = start_date.replace(year=start_date.year-1, month=12, day=31, hour=23, minute=59, second=59)
            else:
                prev_start = start_date.replace(month=start_date.month-1, day=1)
                # Get last day of previous month
                import calendar
                last_day = calendar.monthrange(start_date.year, start_date.month-1)[1]
                prev_end = start_date.replace(month=start_date.month-1, day=last_day, hour=23, minute=59, second=59)
        
        logger.info(f"Date ranges for {timeframe}: Current ({start_date} to {end_date}), Previous ({prev_start} to {prev_end})")
        return start_date, end_date, prev_start, prev_end
    
    def _generate_sales_report(self, vendor_id, timeframe):
        """Generate comprehensive sales report"""
        start_date, end_date, prev_start, prev_end = self._get_date_ranges(timeframe)
        
        # Base queryset - only paid orders
        base_queryset = Order.objects.filter(
            vendor_id=vendor_id,
            payment_status='paid'
        )
        
        logger.info(f"Base queryset count: {base_queryset.count()}")
        
        # Current period statistics
        current_orders = base_queryset.filter(
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        
        logger.info(f"Current period orders count: {current_orders.count()}")
        
        current_stats = current_orders.aggregate(
            total_orders=Count('id'),
            total_revenue=Sum('total_amount'),
            avg_order_value=Avg('total_amount')
        )
        
        # Handle None values from aggregate
        current_stats['total_revenue'] = float(current_stats['total_revenue'] or 0)
        current_stats['avg_order_value'] = float(current_stats['avg_order_value'] or 0)
        
        # Previous period statistics
        prev_orders = base_queryset.filter(
            created_at__gte=prev_start,
            created_at__lte=prev_end
        )
        
        logger.info(f"Previous period orders count: {prev_orders.count()}")
        
        prev_stats = prev_orders.aggregate(
            total_orders=Count('id'),
            total_revenue=Sum('total_amount'),
            avg_order_value=Avg('total_amount')
        )
        
        # Handle None values from aggregate
        prev_stats['total_revenue'] = float(prev_stats['total_revenue'] or 0)
        prev_stats['avg_order_value'] = float(prev_stats['avg_order_value'] or 0)
        
        # Daily breakdown
        daily_breakdown = self._get_daily_breakdown(base_queryset, start_date, end_date, timeframe)
        
        # Peak hour analysis
        peak_hour = self._get_peak_hour(base_queryset, start_date, end_date)
        
        # Calculate percentage changes
        changes = self._calculate_changes(current_stats, prev_stats)
        
        result = {
            **current_stats,
            'peak_hour': peak_hour,
            **changes,
            'daily_breakdown': daily_breakdown['breakdown'],
            'max_daily_revenue': daily_breakdown['max_revenue']
        }
        
        logger.info(f"Final report data: {result}")
        return result
    
    def _get_daily_breakdown(self, queryset, start_date, end_date, timeframe):
        """Get daily sales breakdown with proper date handling"""
        daily_data = queryset.filter(
            created_at__gte=start_date,
            created_at__lte=end_date
        ).extra(
            select={'order_date': 'DATE(created_at)'}
        ).values('order_date').annotate(
            orders=Count('id'),
            revenue=Sum('total_amount')
        ).order_by('-order_date')
        
        breakdown = []
        max_revenue = 0
        
        for item in daily_data:
            revenue = float(item['revenue'] or 0)
            max_revenue = max(max_revenue, revenue)
            
            # Format date based on timeframe
            if timeframe == 'day':
                # For day view, show hourly breakdown instead
                date_str = f"{item['order_date']}"
            else:
                date_str = str(item['order_date'])
            
            breakdown.append({
                'date': date_str,
                'orders': item['orders'],
                'revenue': revenue
            })
        
        # If it's a day timeframe and we have no data, show hourly slots
        if timeframe == 'day' and not breakdown:
            # Create empty hourly slots for today
            from datetime import datetime
            today = start_date.date()
            breakdown = [{
                'date': str(today),
                'orders': 0,
                'revenue': 0
            }]
        
        return {'breakdown': breakdown, 'max_revenue': max_revenue}
    
    def _get_peak_hour(self, queryset, start_date, end_date):
        """Get peak sales hour"""
        try:
            peak_data = queryset.filter(
                created_at__gte=start_date,
                created_at__lte=end_date
            ).extra(
                select={'hour': 'HOUR(created_at)'}
            ).values('hour').annotate(
                order_count=Count('id')
            ).order_by('-order_count').first()
            
            if peak_data and peak_data['hour'] is not None:
                return f"{peak_data['hour']:02d}:00"
            return None
        except Exception as e:
            logger.error(f"Error getting peak hour: {str(e)}")
            return None
    
    def _calculate_changes(self, current, previous):
        """Calculate percentage changes between periods"""
        def calc_change(curr, prev):
            if prev == 0:
                return 100 if curr > 0 else 0
            return round(((curr - prev) / prev) * 100, 2)
        
        return {
            'revenue_change': calc_change(current['total_revenue'], previous['total_revenue']),
            'orders_change': calc_change(current['total_orders'], previous['total_orders']),
            'avg_order_change': calc_change(current['avg_order_value'], previous['avg_order_value'])
        }


class PaymentSummaryView(APIView):
    """
    API endpoint for comprehensive payment analytics
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id):
        try:
            vendor = get_object_or_404(get_user_model(), id=vendor_id)
            
            # Check cache
            cache_key = f"payment_summary_{vendor_id}"
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data, status=status.HTTP_200_OK)
            
            # Generate payment summary
            summary_data = self._generate_payment_summary(vendor_id)
            
            # Cache for 5 minutes
            cache.set(cache_key, summary_data, 300)
            
            return Response(summary_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error generating payment summary for vendor {vendor_id}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to generate payment summary'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _generate_payment_summary(self, vendor_id):
        """Generate comprehensive payment summary"""
        # Payment status breakdown
        status_data = Order.objects.filter(
            vendor_id=vendor_id
        ).values('payment_status').annotate(
            count=Count('id'),
            amount=Sum('total_amount') or 0
        )
        
        # Process status data
        status_summary = {}
        total_transactions = 0
        successful_transactions = 0
        
        for item in status_data:
            status_name = item['payment_status']
            count = item['count']
            amount = float(item['amount'])
            
            status_summary[status_name] = {'count': count, 'amount': amount}
            total_transactions += count
            
            if status_name == 'paid':
                successful_transactions += count
        
        # Calculate success rate
        success_rate = round(
            (successful_transactions / total_transactions * 100) if total_transactions > 0 else 0,
            1
        )
        
        # Recent transactions
        recent_transactions = self._get_recent_transactions(vendor_id)
        
        # Payment methods breakdown
        payment_methods = self._get_payment_methods_summary(vendor_id)
        
        return {
            'successful_payments': status_summary.get('paid', {}).get('amount', 0),
            'successful_count': status_summary.get('paid', {}).get('count', 0),
            'failed_payments': status_summary.get('failed', {}).get('amount', 0),
            'failed_count': status_summary.get('failed', {}).get('count', 0),
            'pending_payments': status_summary.get('pending', {}).get('amount', 0),
            'pending_count': status_summary.get('pending', {}).get('count', 0),
            'success_rate': success_rate,
            'recent_transactions': recent_transactions,
            'payment_methods': payment_methods
        }
    
    def _get_recent_transactions(self, vendor_id, limit=10):
        """Get recent transactions with essential details"""
        recent_orders = Order.objects.filter(
            vendor_id=vendor_id
        ).select_related().order_by('-created_at')[:limit]
        
        return [
            {
                'invoice_no': order.invoice_no,
                'amount': float(order.total_amount),
                'status': order.payment_status,
                'created_at': order.created_at.isoformat()
            }
            for order in recent_orders
        ]
    
    def _get_payment_methods_summary(self, vendor_id):
        """Get payment methods breakdown for successful payments"""
        methods_data = Order.objects.filter(
            vendor_id=vendor_id,
            payment_status='paid'
        ).values('payment_method').annotate(
            count=Count('id'),
            amount=Sum('total_amount') or 0
        )
        
        return {
            (item['payment_method'] or 'unknown'): {
                'count': item['count'],
                'amount': float(item['amount'])
            }
            for item in methods_data
        }

