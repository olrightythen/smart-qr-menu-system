from django.urls import re_path
from . import consumers
from .consumers_order import OrderTrackingConsumer
from .consumers_table import TableOrderConsumer

websocket_urlpatterns = [
    re_path(r'ws/notifications/(?P<vendor_id>\d+)/$', consumers.NotificationConsumer.as_asgi()),
    re_path(r'ws/track-order/(?P<order_id>\d+)/$', OrderTrackingConsumer.as_asgi()),
    re_path(r'ws/table/(?P<vendor_id>\d+)/(?P<table_identifier>.+)/$', TableOrderConsumer.as_asgi()),
    re_path(r'ws/order/(?P<vendor_id>\d+)_(?P<table_id>.+)/$', consumers.NotificationConsumer.as_asgi()),
]