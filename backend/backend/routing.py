from django.urls import path
from notifications.consumers import NotificationConsumer

websocket_urlpatterns = [
    path('ws/notifications/<int:vendor_id>/', NotificationConsumer.as_asgi()),
]