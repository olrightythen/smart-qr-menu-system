from django.db import models
from django.utils import timezone
from vendor.models import Vendor
import json


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('order', 'New Order'),
        ('payment', 'Payment Received'),
        ('review', 'New Review'),
        ('system', 'System Message'),
        ('test', 'Test Notification'),
    ]
    
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='system')  # Changed from 'type'
    title = models.CharField(max_length=200)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['vendor', '-created_at']),
            models.Index(fields=['vendor', 'read']),
        ]
    
    def __str__(self):
        return f"{self.vendor.business_name} - {self.title}"
    
    def mark_as_read(self):
        if not self.read:
            self.read = True
            self.read_at = timezone.now()
            self.save(update_fields=['read', 'read_at'])
    
    @property
    def type(self):
        """Alias for notification_type for backward compatibility"""
        return self.notification_type


class NotificationPreference(models.Model):
    """User preferences for notifications"""
    vendor = models.OneToOneField(Vendor, on_delete=models.CASCADE, related_name='notification_preferences')
    email_notifications = models.BooleanField(default=True)
    websocket_notifications = models.BooleanField(default=True)
    new_order_notifications = models.BooleanField(default=True)
    payment_notifications = models.BooleanField(default=True)
    system_notifications = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Notification preferences for {self.vendor.restaurant_name}"


class NotificationType(models.Model):
    """Different types of notifications available in the system"""
    name = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.display_name
    
    class Meta:
        ordering = ['display_name']
