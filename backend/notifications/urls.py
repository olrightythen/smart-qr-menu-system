from django.urls import path
from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification-list'),
    path('<int:notification_id>/', views.NotificationDetailView.as_view(), name='notification-detail'),
    path('bulk-actions/', views.NotificationBulkActionsView.as_view(), name='notification-bulk-actions'),
]