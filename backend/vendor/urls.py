from django.urls import path
from .views.auth_view import VendorRegisterView, VendorLoginView
from .views.payment_view import EsewaInitiatePaymentView
from .views.menu_view import CreateMenuView, MenuItemListView, MenuItemDetailView, ToggleMenuItemAvailabilityView

urlpatterns = [
    path('vendor/login/', VendorLoginView.as_view(), name='vendor-login'),
    path('vendor/register/', VendorRegisterView.as_view(), name='vendor-register'),
    path('initiate-payment/', EsewaInitiatePaymentView.as_view(), name='initiate-payment'),
    path('menu/create/<int:vendor_id>/', CreateMenuView.as_view(), name='create-menu'),
    path('menu/list/<int:vendor_id>/', MenuItemListView.as_view(), name='list_menu'),
    path('menu/item/<int:item_id>/', MenuItemDetailView.as_view(), name='menu_item_detail'),
    path('menu/toggle/<int:item_id>/', ToggleMenuItemAvailabilityView.as_view(), name='toggle_menu_item'),
]
