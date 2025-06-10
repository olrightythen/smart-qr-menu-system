from typing import Dict, Any, Optional
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Simple notification service with WebSocket support"""
    
    def __init__(self):
        self.channel_layer = get_channel_layer()
    
    def create_notification(self, vendor, title: str, message: str, notification_type: str = 'system', data: dict = None):
        """Create a notification with WebSocket support"""
        try:
            notification = Notification.objects.create(
                vendor=vendor,
                title=title,
                message=message,
                notification_type=notification_type,
                data=data or {}
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
            
            async_to_sync(self.channel_layer.group_send)(
                group_name,
                {
                    'type': 'vendor_notification',
                    'data': {
                        'type': 'vendor_notification',
                        'data': {
                            'id': notification.id,
                            'title': notification.title,
                            'message': notification.message,
                            'type': notification.notification_type,
                            'read': notification.read,
                            'timestamp': notification.created_at.isoformat(),
                            'data': notification.data or {}
                        }
                    }
                }
            )
            
            logger.info(f"WebSocket notification sent to vendor {vendor.id}")
            
        except Exception as e:
            logger.error(f"Error sending WebSocket notification: {e}")
    
    def send_new_order_notification(self, vendor, order_id):
        """Send new order notification"""
        return self.create_notification(
            vendor=vendor,
            title=f"New Order #{order_id}",
            message=f"You have received a new order",
            notification_type='new_order',
            data={'order_id': order_id}
        )
    
    def send_payment_notification(self, vendor, order_id, amount):
        """Send payment notification"""
        return self.create_notification(
            vendor=vendor,
            title=f"Payment Received",
            message=f"Payment of Rs. {amount} received for order #{order_id}",
            notification_type='payment',
            data={'order_id': order_id, 'amount': amount}
        )
    
    def mark_as_read(self, notification_id: int, vendor):
        """Mark notification as read"""
        try:
            notification = Notification.objects.get(id=notification_id, vendor=vendor)
            notification.mark_as_read()
            return True
        except Notification.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"Error marking notification as read: {e}")
            return False
    
    def get_vendor_notifications(self, vendor, limit: int = 50):
        """Get notifications for a vendor"""
        return Notification.objects.filter(vendor=vendor).order_by('-created_at')[:limit]
    
    def get_unread_count(self, vendor):
        """Get count of unread notifications for a vendor"""
        return Notification.objects.filter(vendor=vendor, read=False).count()