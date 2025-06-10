from abc import ABC, abstractmethod
from typing import Dict, Any
from django.contrib.auth import get_user_model
from .interfaces import NotificationFactoryInterface
from .models import NotificationType

User = get_user_model()


class BaseNotificationFactory(ABC):
    """Abstract base factory for notifications"""
    
    @abstractmethod
    def create_notification_data(self, *args, **kwargs) -> Dict[str, Any]:
        pass


class OrderNotificationFactory(BaseNotificationFactory, NotificationFactoryInterface):
    """Factory for creating order-related notifications"""
    
    def create_order_notification(self, vendor: User, order: Any, 
                                notification_type: str = 'new_order') -> Dict[str, Any]:
        """Create order notification data"""
        if notification_type == NotificationType.NEW_ORDER:
            return self._create_new_order_data(vendor, order)
        elif notification_type == NotificationType.ORDER_STATUS:
            return self._create_order_status_data(vendor, order)
        else:
            raise ValueError(f"Invalid order notification type: {notification_type}")
    
    def create_payment_notification(self, vendor: User, order: Any, 
                                  payment_status: str) -> Dict[str, Any]:
        """Create payment notification data"""
        return {
            'vendor': vendor,
            'notification_type': NotificationType.PAYMENT,
            'title': f"Payment Update - Order #{order.order_id}",
            'message': f"Payment {payment_status} for order #{order.order_id}",
            'data': {
                'order_id': order.order_id,
                'payment_status': payment_status,
                'amount': str(order.total_amount)
            }
        }
    
    def create_system_notification(self, vendor: User, title: str, 
                                 message: str, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create system notification data"""
        return {
            'vendor': vendor,
            'notification_type': NotificationType.SYSTEM,
            'title': title,
            'message': message,
            'data': data or {}
        }
    
    def _create_new_order_data(self, vendor: User, order: Any) -> Dict[str, Any]:
        """Create new order notification data"""
        return {
            'vendor': vendor,
            'notification_type': NotificationType.NEW_ORDER,
            'title': f"New Order #{order.order_id}",
            'message': f"New order received from table {getattr(order, 'table_name', 'Unknown')}",
            'data': {
                'order_id': order.order_id,
                'table_name': getattr(order, 'table_name', 'Unknown'),
                'total_amount': str(order.total_amount),
                'items': self._extract_order_items(order)
            }
        }
    
    def _create_order_status_data(self, vendor: User, order: Any) -> Dict[str, Any]:
        """Create order status notification data"""
        return {
            'vendor': vendor,
            'notification_type': NotificationType.ORDER_STATUS,
            'title': f"Order #{order.order_id} Status Updated",
            'message': f"Order status changed to {order.status}",
            'data': {
                'order_id': order.order_id,
                'status': order.status,
                'table_name': getattr(order, 'table_name', 'Unknown')
            }
        }
    
    def _extract_order_items(self, order: Any) -> list:
        """Extract order items data"""
        if not hasattr(order, 'items'):
            return []
        
        return [
            {
                'name': item.item.name,
                'quantity': item.quantity,
                'price': str(item.price)
            }
            for item in order.items.all()
        ]
    
    def create_notification_data(self, *args, **kwargs) -> Dict[str, Any]:
        """Implementation of abstract method"""
        notification_type = kwargs.get('notification_type')
        if notification_type in [NotificationType.NEW_ORDER, NotificationType.ORDER_STATUS]:
            return self.create_order_notification(*args, **kwargs)
        elif notification_type == NotificationType.PAYMENT:
            return self.create_payment_notification(*args, **kwargs)
        elif notification_type == NotificationType.SYSTEM:
            return self.create_system_notification(*args, **kwargs)
        else:
            raise ValueError(f"Unknown notification type: {notification_type}")