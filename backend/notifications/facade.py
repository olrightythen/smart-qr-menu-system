from django.contrib.auth import get_user_model
from .services import NotificationService

User = get_user_model()


class NotificationFacade:
    """Simple facade for notification services"""
    
    def __init__(self):
        self.notification_service = NotificationService()
    
    def send_new_order_notification(self, vendor: User, order):
        """Send notification for new order"""
        return self.notification_service.send_new_order_notification(vendor, order)
    
    def send_order_status_update(self, vendor: User, order, old_status: str, new_status: str):
        """Send notification for order status update"""
        return self.notification_service.send_order_status_update(vendor, order, old_status, new_status)
    
    def send_payment_received_notification(self, vendor: User, order, amount: float, payment_method: str = 'eSewa'):
        """Send notification for successful payment"""
        return self.notification_service.send_payment_received_notification(vendor, order, amount, payment_method)
    
    def send_payment_failed_notification(self, vendor: User, order, reason: str = 'Unknown'):
        """Send notification for failed payment"""
        return self.notification_service.send_payment_failed_notification(vendor, order, reason)
    
    def send_system_notification(self, vendor: User, title: str, message: str, data: dict = None):
        """Send system notification"""
        return self.notification_service.create_notification(vendor, title, message, 'system', data)
    
    def create_vendor_notification(self, vendor: User, title: str, message: str, notification_type: str = 'system', data: dict = None):
        """Create a vendor notification"""
        return self.notification_service.create_notification(vendor, title, message, notification_type, data)
    
    def mark_as_read(self, notification_id: int, vendor: User):
        """Mark notification as read"""
        return self.notification_service.mark_as_read(notification_id, vendor)
    
    def get_vendor_notifications(self, vendor: User, limit: int = 50):
        """Get notifications for a vendor"""
        return self.notification_service.get_vendor_notifications(vendor, limit)
    
    def get_unread_count(self, vendor: User):
        """Get count of unread notifications for a vendor"""
        return self.notification_service.get_unread_count(vendor)


# Create a singleton instance
notification_facade = NotificationFacade()