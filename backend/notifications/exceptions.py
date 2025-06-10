class NotificationError(Exception):
    """Base exception for notification-related errors"""
    pass


class NotificationServiceError(NotificationError):
    """Exception raised by notification service"""
    pass


class InvalidNotificationTypeError(NotificationError):
    """Exception raised for invalid notification types"""
    pass


class WebSocketError(NotificationError):
    """Exception raised for WebSocket-related errors"""
    pass


class VendorNotFoundError(NotificationError):
    """Exception raised when vendor is not found"""
    pass


class NotificationNotFoundError(NotificationError):
    """Exception raised when notification is not found"""
    pass