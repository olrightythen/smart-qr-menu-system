from django.urls import path, re_path
from notifications.consumers import NotificationConsumer
from notifications.consumers_order import OrderTrackingConsumer
from notifications.consumers_table import TableOrderConsumer

websocket_urlpatterns = [
    # Order tracking and notifications
    path('ws/track-order/<int:order_id>/', OrderTrackingConsumer.as_asgi()),
    path('ws/table/<int:vendor_id>/<str:table_identifier>/', TableOrderConsumer.as_asgi()),
    
    # Order-specific endpoint - must come before vendor notifications
    re_path(r'^ws/order/(?P<vendor_id>\d+)_(?P<table_id>[^/]+)/$', NotificationConsumer.as_asgi()),
    
    # Vendor notifications - must come last
    path('ws/notifications/<int:vendor_id>/', NotificationConsumer.as_asgi()),
]