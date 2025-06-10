from django.contrib import admin
from .models import Notification, NotificationPreference, NotificationType


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'vendor', 'notification_type', 'read', 'created_at']
    list_filter = ['notification_type', 'read', 'created_at']
    search_fields = ['title', 'message', 'vendor__restaurant_name']
    readonly_fields = ['created_at', 'read_at']
    ordering = ['-created_at']


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ['vendor', 'email_notifications', 'websocket_notifications', 'new_order_notifications']
    list_filter = ['email_notifications', 'websocket_notifications', 'new_order_notifications']
    search_fields = ['vendor__restaurant_name']


@admin.register(NotificationType)
class NotificationTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'display_name', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'display_name']
