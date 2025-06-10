from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from django.contrib.auth import get_user_model

User = get_user_model()


class NotificationServiceInterface(ABC):
    """Abstract interface for notification services"""
    
    @abstractmethod
    def create_notification(self, vendor: User, notification_type: str, 
                          title: str, message: str, data: Dict[str, Any] = None) -> Any:
        pass
    
    @abstractmethod
    def send_notification(self, notification: Any) -> bool:
        pass
    
    @abstractmethod
    def get_vendor_notifications(self, vendor: User, filters: Dict[str, Any] = None) -> List[Any]:
        pass


class WebSocketManagerInterface(ABC):
    """Abstract interface for WebSocket management"""
    
    @abstractmethod
    def send_to_vendor(self, vendor_id: int, data: Dict[str, Any]) -> bool:
        pass
    
    @abstractmethod
    def add_vendor_to_group(self, vendor_id: int, channel_name: str) -> None:
        pass
    
    @abstractmethod
    def remove_vendor_from_group(self, vendor_id: int, channel_name: str) -> None:
        pass


class NotificationFactoryInterface(ABC):
    """Abstract factory for creating different types of notifications"""
    
    @abstractmethod
    def create_order_notification(self, vendor: User, order: Any, 
                                notification_type: str = 'new_order') -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def create_payment_notification(self, vendor: User, order: Any, 
                                  payment_status: str) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def create_system_notification(self, vendor: User, title: str, 
                                 message: str, data: Dict[str, Any] = None) -> Dict[str, Any]:
        pass