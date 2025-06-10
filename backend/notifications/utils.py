import json
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.utils import timezone
from .models import Notification

logger = logging.getLogger(__name__)


def create_notification(vendor, notification_type, title, message, data=None):
    """
    Create a notification and send it via WebSocket
    """
    try:
        # Create the notification in the database - use notification_type instead of type
        notification = Notification.objects.create(
            vendor=vendor,
            notification_type=notification_type,  # Changed from type=notification_type
            title=title,
            message=message,
            data=data or {}
        )
        
        logger.info(f"Created notification {notification.id} for vendor {vendor.id}")
        
        # Send via WebSocket
        send_notification_to_vendor(vendor.id, {
            'id': notification.id,
            'type': notification.notification_type,  # Use notification_type field
            'title': notification.title,
            'message': notification.message,
            'read': notification.read,
            'created_at': notification.created_at.isoformat(),
            'data': notification.data
        })
        
        return notification
        
    except Exception as e:
        logger.error(f"Error creating notification for vendor {vendor.id}: {e}")
        logger.exception("Full traceback:")  # This will show the full error
        return None


def send_notification_to_vendor(vendor_id, notification_data):
    """
    Send notification to vendor via WebSocket
    """
    try:
        channel_layer = get_channel_layer()
        group_name = f'vendor_{vendor_id}'
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'vendor_notification',
                'data': notification_data
            }
        )
        
        logger.info(f"Sent WebSocket notification to vendor {vendor_id}")
        
    except Exception as e:
        logger.error(f"Error sending WebSocket notification to vendor {vendor_id}: {e}")


def send_order_notification(vendor, order, notification_type='order'):
    """
    Send an order-related notification to a vendor
    """
    try:
        # Determine title and message based on order status
        if order.status == 'pending':
            title = "New Order Received"
            message = f"Order #{order.id} has been placed for ${order.total_amount}"
        elif order.status == 'confirmed':
            title = "Order Confirmed"
            message = f"Order #{order.id} has been confirmed"
        elif order.status == 'preparing':
            title = "Order Being Prepared"
            message = f"Order #{order.id} is now being prepared"
        elif order.status == 'ready':
            title = "Order Ready"
            message = f"Order #{order.id} is ready for pickup/delivery"
        elif order.status == 'completed':
            title = "Order Completed"
            message = f"Order #{order.id} has been completed"
        elif order.status == 'cancelled':
            title = "Order Cancelled"
            message = f"Order #{order.id} has been cancelled"
        else:
            title = "Order Update"
            message = f"Order #{order.id} status updated to {order.status}"
        
        # Prepare order data
        order_data = {
            'order_id': order.id,
            'customer_name': getattr(order, 'customer_name', 'Unknown'),
            'total_amount': str(order.total_amount),
            'status': order.status,
            'created_at': order.created_at.isoformat(),
            'table_number': getattr(order, 'table_number', None),
        }
        
        # Create and send notification
        notification = create_notification(
            vendor=vendor,
            notification_type=notification_type,
            title=title,
            message=message,
            data=order_data
        )
        
        logger.info(f"Sent order notification for order {order.id} to vendor {vendor.id}")
        return notification
        
    except Exception as e:
        logger.error(f"Error sending order notification for order {getattr(order, 'id', 'unknown')} to vendor {getattr(vendor, 'id', 'unknown')}: {e}")
        return None


def send_payment_notification(vendor, payment, order=None):
    """
    Send a payment-related notification to a vendor
    """
    try:
        title = "Payment Received"
        message = f"Payment of ${payment.amount} received"
        
        if order:
            message += f" for Order #{order.id}"
        
        payment_data = {
            'payment_id': payment.id,
            'amount': str(payment.amount),
            'payment_method': getattr(payment, 'payment_method', 'Unknown'),
            'status': getattr(payment, 'status', 'completed'),
            'order_id': order.id if order else None,
        }
        
        notification = create_notification(
            vendor=vendor,
            notification_type='payment',
            title=title,
            message=message,
            data=payment_data
        )
        
        logger.info(f"Sent payment notification for payment {payment.id} to vendor {vendor.id}")
        return notification
        
    except Exception as e:
        logger.error(f"Error sending payment notification: {e}")
        return None


def send_review_notification(vendor, review):
    """
    Send a review-related notification to a vendor
    """
    try:
        rating_stars = "⭐" * int(review.rating)
        title = "New Review Received"
        message = f"New {review.rating}-star review: \"{review.comment[:50]}{'...' if len(review.comment) > 50 else ''}\""
        
        review_data = {
            'review_id': review.id,
            'rating': review.rating,
            'comment': review.comment,
            'customer_name': getattr(review, 'customer_name', 'Anonymous'),
            'order_id': getattr(review, 'order_id', None),
        }
        
        notification = create_notification(
            vendor=vendor,
            notification_type='review',
            title=title,
            message=message,
            data=review_data
        )
        
        logger.info(f"Sent review notification for review {review.id} to vendor {vendor.id}")
        return notification
        
    except Exception as e:
        logger.error(f"Error sending review notification: {e}")
        return None


def send_system_notification(vendor, title, message, data=None):
    """
    Send a system notification to a vendor
    """
    try:
        notification = create_notification(
            vendor=vendor,
            notification_type='system',
            title=title,
            message=message,
            data=data or {}
        )
        
        logger.info(f"Sent system notification to vendor {vendor.id}")
        return notification
        
    except Exception as e:
        logger.error(f"Error sending system notification: {e}")
        return None


def bulk_notify_vendors(vendor_ids, title, message, notification_type='system', data=None):
    """
    Send a notification to multiple vendors
    """
    try:
        from vendor.models import Vendor
        vendors = Vendor.objects.filter(id__in=vendor_ids)
        notifications = []
        
        for vendor in vendors:
            notification = create_notification(
                vendor=vendor,
                notification_type=notification_type,
                title=title,
                message=message,
                data=data or {}
            )
            if notification:
                notifications.append(notification)
        
        logger.info(f"Sent bulk notification to {len(notifications)} vendors")
        return notifications
        
    except Exception as e:
        logger.error(f"Error sending bulk notification: {e}")
        return []