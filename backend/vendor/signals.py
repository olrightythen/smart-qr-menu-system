from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Order
from notifications.facade import notification_facade
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Order)
def order_created_notification(sender, instance, created, **kwargs):
    """Send notification when a new order is created"""
    # This signal is now disabled because notifications are handled in CreateOrderView
    # to avoid duplicate notifications. Do not re-enable without checking for duplicates.
    pass

@receiver(pre_save, sender=Order)
def order_status_changed_notification(sender, instance, **kwargs):
    """Send notification when order status changes"""
    if instance.pk:  # Only for existing orders
        try:
            # Get the old instance from database
            old_instance = Order.objects.get(pk=instance.pk)
            
            # Check if status changed
            if old_instance.status != instance.status:
                # Store old status in instance for use in post_save
                instance._old_status = old_instance.status
        except Order.DoesNotExist:
            pass

@receiver(post_save, sender=Order)
def order_status_updated_notification(sender, instance, created, **kwargs):
    """Send notification when order status is updated"""
    if not created and hasattr(instance, '_old_status'):
        try:
            # Send notification
            notification_facade.send_order_status_update(
                instance.vendor, 
                instance, 
                instance._old_status, 
                instance.status
            )
            logger.info(f"Status update notification sent for order {instance.id}")
            
            # Also send real-time WebSocket update specifically for order tracking
            from notifications.order_utils import send_order_update
            result = send_order_update(instance.id)
            logger.info(f"WebSocket order update sent for order {instance.id}, result: {result}")
            
        except Exception as e:
            logger.error(f"Failed to send status update notification for order {instance.id}: {e}")
            logger.exception("Full signal error traceback:")