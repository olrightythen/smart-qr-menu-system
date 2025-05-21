from ..views.auth_view import VendorRegisterView, VendorLoginView, MenuItemCreateView, MenuItemListView
from django.urls import path

urlpatterns = [
    path('login/', VendorLoginView.as_view(), name='vendor-login'),
    path('register/', VendorRegisterView.as_view(), name='vendor-register'),
    path('dashboard/create-menu/', MenuItemCreateView.as_view(), name='create-menu-item'),
    path('dashboard/manage-menu/', MenuItemListView.as_view(), name='menu-items-list')
]
