from django.urls import path
from .views.auth_view import VendorRegisterView, VendorLoginView
from .views.menu_view import CreateMenuView, MenuItemListView, MenuItemDetailView, ToggleMenuItemAvailabilityView
from .views.menu_view import PublicMenuView
from .views.payment_view import EsewaPaymentVerifyView, EsewaInitiatePaymentView
from .views.order_view import OrderListView, OrderStatusUpdateView, OrderDetailsView
from .views.table_view import TableListView, TableCreateView, TableDeleteView, TableRegenerateQRView
from .views.table_view import TableToggleAvailabilityView, TableRenameView, PublicTableStatusView
# Import other views
from .views.dashboard_view import (
    DashboardStatsView, 
    SalesReportView, 
    PaymentSummaryView,
    VendorProfileView,
    VendorProfileUpdateView
)
from .views.algorithm_view import MenuRecommendationsView, MenuSearchView, MenuSortView

urlpatterns = [
    # Vendor Authentication URLs
    path('vendor/login/', VendorLoginView.as_view(), name='vendor-login'),
    path('vendor/register/', VendorRegisterView.as_view(), name='vendor-register'),

    # Vendor Profile URLs
    path('vendor/<int:vendor_id>/', VendorProfileView.as_view(), name='vendor-profile'),
    path('vendor/<int:vendor_id>/update/', VendorProfileUpdateView.as_view(), name='vendor-profile-update'),

    # Vendor Menu URLs
    path('menu/create/<int:vendor_id>/', CreateMenuView.as_view(), name='create-menu'),
    path('menu/list/<int:vendor_id>/', MenuItemListView.as_view(), name='list_menu'),
    path('menu/item/<int:item_id>/', MenuItemDetailView.as_view(), name='menu_item_detail'),
    path('menu/toggle/<int:item_id>/', ToggleMenuItemAvailabilityView.as_view(), name='toggle_menu_item'),
    path('public-menu/<int:vendor_id>/', PublicMenuView.as_view(), name='public_menu'),

    # Order URLs
    path('orders/<int:vendor_id>/', OrderListView.as_view(), name='order_list'),
    path('orders/<int:order_id>/status/', OrderStatusUpdateView.as_view(), name='order_status_update'),
    path('order/<int:order_id>/', OrderDetailsView.as_view(), name='order_details'),
    path('order/', OrderDetailsView.as_view(), name='order_details_by_invoice'),

    # Table endpoints
    path('vendor/<int:vendor_id>/tables/', TableListView.as_view(), name='table-list'),
    path('vendor/<int:vendor_id>/tables/add/', TableCreateView.as_view(), name='table-create'),
    path('vendor/<int:vendor_id>/tables/<int:table_id>/delete/', TableDeleteView.as_view(), name='table-delete'),
    path('vendor/<int:vendor_id>/tables/<int:table_id>/regenerate-qr/', TableRegenerateQRView.as_view(), name='table-regenerate-qr'),
    path('vendor/<int:vendor_id>/tables/<int:table_id>/toggle-availability/', TableToggleAvailabilityView.as_view(), name='table-toggle-availability'),
    path('vendor/<int:vendor_id>/tables/<int:table_id>/rename/', TableRenameView.as_view(), name='table-rename'),
    
    # Public table status endpoint (updated to use qr_code identifier)
    path('public-table/<int:vendor_id>/<str:table_identifier>/', PublicTableStatusView.as_view(), name='public-table-status'),

    # Payment URLs
    path('initiate-payment/', EsewaInitiatePaymentView.as_view(), name='initiate_payment'),
    path('verify-payment/', EsewaPaymentVerifyView.as_view(), name='verify_payment'),

    # Add the dashboard stats endpoint
    path('vendor/<int:vendor_id>/dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('vendor/<int:vendor_id>/sales-report/', SalesReportView.as_view(), name='sales-report'),
    path('vendor/<int:vendor_id>/payment-summary/', PaymentSummaryView.as_view(), name='payment-summary'),

    # Menu algorithm endpoints
    path('menu/<int:vendor_id>/recommendations/', MenuRecommendationsView.as_view(), name='menu-recommendations'),
    path('menu/<int:vendor_id>/search/', MenuSearchView.as_view(), name='menu-search'),
    path('menu/<int:vendor_id>/sort/', MenuSortView.as_view(), name='menu-sort'),
]
