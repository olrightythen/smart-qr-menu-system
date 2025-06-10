from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Notification
import logging

logger = logging.getLogger(__name__)


class NotificationListView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            vendor = request.user
            logger.info(f"Fetching notifications for vendor: {vendor.id}")
            
            # Build the base queryset with all filters BEFORE slicing
            base_queryset = Notification.objects.filter(vendor=vendor).order_by('-created_at')
            
            # Count unread notifications from the base queryset
            unread_count = base_queryset.filter(read=False).count()
            
            # Get total count before slicing
            total_count = base_queryset.count()
            
            # Now slice to get only the first 50 notifications
            notifications = base_queryset[:50]
            
            notifications_data = []
            for notification in notifications:
                notifications_data.append({
                    'id': notification.id,
                    'type': notification.notification_type,
                    'title': notification.title,
                    'message': notification.message,
                    'read': notification.read,
                    'created_at': notification.created_at.isoformat(),
                    'data': notification.data
                })
            
            response_data = {
                'notifications': notifications_data,
                'count': len(notifications_data),
                'total_count': total_count,
                'unread_count': unread_count
            }
            
            logger.info(f"Successfully fetched {len(notifications_data)} notifications for vendor {vendor.id}")
            return Response(response_data)
            
        except Exception as e:
            logger.error(f"Error fetching notifications for vendor {getattr(request.user, 'id', 'unknown')}: {e}")
            logger.exception("Full traceback:")
            
            return Response({
                'error': 'Failed to fetch notifications',
                'details': str(e),
                'notifications': [],
                'count': 0,
                'total_count': 0,
                'unread_count': 0
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NotificationDetailView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, notification_id):
        """Mark notification as read"""
        try:
            vendor = request.user
            notification = get_object_or_404(Notification, id=notification_id, vendor=vendor)
            
            if not notification.read:
                notification.mark_as_read()
                logger.info(f"Notification {notification_id} marked as read for vendor {vendor.id}")
            
            return Response({
                'id': notification.id,
                'read': notification.read,
                'message': 'Notification marked as read successfully'
            })
            
        except Notification.DoesNotExist:
            logger.warning(f"Notification {notification_id} not found for vendor {request.user.id}")
            return Response({
                'error': 'Notification not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error marking notification {notification_id} as read: {e}")
            return Response({
                'error': 'Failed to mark notification as read',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, notification_id):
        """Delete notification"""
        try:
            vendor = request.user
            notification = get_object_or_404(Notification, id=notification_id, vendor=vendor)
            notification.delete()
            logger.info(f"Notification {notification_id} deleted for vendor {vendor.id}")
            
            return Response({
                'message': 'Notification deleted successfully'
            }, status=status.HTTP_204_NO_CONTENT)
            
        except Notification.DoesNotExist:
            logger.warning(f"Notification {notification_id} not found for vendor {request.user.id}")
            return Response({
                'error': 'Notification not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deleting notification {notification_id}: {e}")
            return Response({
                'error': 'Failed to delete notification',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NotificationBulkActionsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            vendor = request.user
            action = request.data.get('action')
            notification_ids = request.data.get('notification_ids', [])
            
            if action == 'mark_all_read':
                # Mark all notifications as read
                updated_count = Notification.objects.filter(
                    vendor=vendor, read=False
                ).update(read=True)
                
                logger.info(f"Marked {updated_count} notifications as read for vendor {vendor.id}")
                return Response({
                    'message': f'Marked {updated_count} notifications as read',
                    'updated_count': updated_count
                })
                
            elif action == 'mark_selected_read':
                # Mark selected notifications as read
                updated_count = Notification.objects.filter(
                    vendor=vendor, id__in=notification_ids, read=False
                ).update(read=True)
                
                logger.info(f"Marked {updated_count} selected notifications as read for vendor {vendor.id}")
                return Response({
                    'message': f'Marked {updated_count} notifications as read',
                    'updated_count': updated_count
                })
                
            elif action == 'delete_selected':
                # Delete selected notifications
                deleted_count, _ = Notification.objects.filter(
                    vendor=vendor, id__in=notification_ids
                ).delete()
                
                logger.info(f"Deleted {deleted_count} selected notifications for vendor {vendor.id}")
                return Response({
                    'message': f'Deleted {deleted_count} notifications',
                    'deleted_count': deleted_count
                })
                
            else:
                return Response({
                    'error': 'Invalid action'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error performing bulk action for vendor {request.user.id}: {e}")
            return Response({
                'error': 'Failed to perform bulk action',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
