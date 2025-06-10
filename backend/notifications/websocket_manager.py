import json
import logging
from typing import Dict, Any, Optional
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .interfaces import WebSocketManagerInterface
from .exceptions import WebSocketError

logger = logging.getLogger(__name__)


class WebSocketManager(WebSocketManagerInterface):
    """Concrete implementation of WebSocket management"""
    
    def __init__(self):
        self.channel_layer = get_channel_layer()
        if not self.channel_layer:
            raise WebSocketError("Channel layer not configured")
    
    def _get_vendor_group_name(self, vendor_id: int) -> str:
        """Generate vendor group name"""
        return f'vendor_{vendor_id}'
    
    def send_to_vendor(self, vendor_id: int, data: Dict[str, Any]) -> bool:
        """Send data to specific vendor via WebSocket"""
        try:
            vendor_group_name = self._get_vendor_group_name(vendor_id)
            
            message = {
                'type': 'vendor_notification',
                'data': data
            }
            
            async_to_sync(self.channel_layer.group_send)(
                vendor_group_name,
                message
            )
            
            logger.debug(f"Message sent to vendor {vendor_id}: {data.get('type', 'unknown')}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending WebSocket message to vendor {vendor_id}: {e}")
            return False
    
    def add_vendor_to_group(self, vendor_id: int, channel_name: str) -> None:
        """Add vendor to WebSocket group"""
        try:
            vendor_group_name = self._get_vendor_group_name(vendor_id)
            async_to_sync(self.channel_layer.group_add)(
                vendor_group_name,
                channel_name
            )
            logger.info(f"Vendor {vendor_id} added to group {vendor_group_name}")
        except Exception as e:
            logger.error(f"Error adding vendor {vendor_id} to group: {e}")
            raise WebSocketError(f"Failed to add vendor to group: {e}")
    
    def remove_vendor_from_group(self, vendor_id: int, channel_name: str) -> None:
        """Remove vendor from WebSocket group"""
        try:
            vendor_group_name = self._get_vendor_group_name(vendor_id)
            async_to_sync(self.channel_layer.group_discard)(
                vendor_group_name,
                channel_name
            )
            logger.info(f"Vendor {vendor_id} removed from group {vendor_group_name}")
        except Exception as e:
            logger.error(f"Error removing vendor {vendor_id} from group: {e}")
            raise WebSocketError(f"Failed to remove vendor from group: {e}")
    
    def send_system_message(self, vendor_id: int, message: str, message_type: str = 'info') -> bool:
        """Send system message to vendor"""
        data = {
            'type': 'system_message',
            'message': message,
            'message_type': message_type,
            'timestamp': json.dumps({}, default=str)  # Current timestamp
        }
        
        return self.send_to_vendor(vendor_id, data)


class MockWebSocketManager(WebSocketManagerInterface):
    """Mock WebSocket manager for testing"""
    
    def __init__(self):
        self.sent_messages = []
        self.groups = {}
    
    def send_to_vendor(self, vendor_id: int, data: Dict[str, Any]) -> bool:
        """Mock send to vendor"""
        self.sent_messages.append({
            'vendor_id': vendor_id,
            'data': data
        })
        return True
    
    def add_vendor_to_group(self, vendor_id: int, channel_name: str) -> None:
        """Mock add to group"""
        if vendor_id not in self.groups:
            self.groups[vendor_id] = []
        self.groups[vendor_id].append(channel_name)
    
    def remove_vendor_from_group(self, vendor_id: int, channel_name: str) -> None:
        """Mock remove from group"""
        if vendor_id in self.groups and channel_name in self.groups[vendor_id]:
            self.groups[vendor_id].remove(channel_name)
    
    def get_sent_messages(self) -> list:
        """Get all sent messages for testing"""
        return self.sent_messages
    
    def clear_sent_messages(self) -> None:
        """Clear sent messages for testing"""
        self.sent_messages = []