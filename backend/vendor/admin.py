from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import Vendor, MenuItem, Order, OrderItem, Table

# Helper function to check if model has a field
def model_has_field(model, field_name):
    try:
        model._meta.get_field(field_name)
        return True
    except:
        return False

@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('email', 'restaurant_name', 'owner_name', 'phone', 'is_active', 'date_joined')
    list_filter = ('is_active', 'date_joined', 'is_staff')
    search_fields = ('email', 'restaurant_name', 'owner_name', 'phone', 'location')
    readonly_fields = ('date_joined', 'last_login')
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Restaurant Info', {'fields': ('restaurant_name', 'owner_name', 'phone', 'location', 'description')}),
        ('Business Hours', {'fields': ('opening_time', 'closing_time')}),
        ('Media', {'fields': ('logo',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    ordering = ('-date_joined',)

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'vendor_name', 'is_available')
    list_filter = ('category', 'is_available', 'vendor')
    search_fields = ('name', 'description', 'category', 'vendor__restaurant_name')
    readonly_fields = ('created_at',)  # Only include fields that exist on the model
    actions = ['make_available', 'make_unavailable']
    list_editable = ('is_available', 'price')
    
    def vendor_name(self, obj):
        return obj.vendor.restaurant_name if hasattr(obj.vendor, 'restaurant_name') else obj.vendor.email
    vendor_name.short_description = "Restaurant"
    vendor_name.admin_order_field = "vendor__restaurant_name"
    
    def make_available(self, request, queryset):
        updated = queryset.update(is_available=True)
        self.message_user(request, f"{updated} menu items marked as available.")
    make_available.short_description = "Mark selected items as available"
    
    def make_unavailable(self, request, queryset):
        updated = queryset.update(is_available=False)
        self.message_user(request, f"{updated} menu items marked as unavailable.")
    make_unavailable.short_description = "Mark selected items as unavailable"
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('vendor')

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['menu_item', 'quantity', 'price']
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('invoice_no', 'vendor_name', 'table_identifier', 'total_amount', 'status', 
                   'payment_status', 'payment_method', 'created_at')
    list_filter = ('status', 'payment_status', 'payment_method', 'created_at')
    search_fields = ('invoice_no', 'vendor__restaurant_name', 'table_identifier', 'transaction_id')
    
    # Only include fields that exist on your model
    readonly_fields = tuple(f for f in ['invoice_no', 'transaction_id', 'created_at', 'total_amount'] 
                           if model_has_field(Order, f))
    
    fieldsets = (
        (None, {'fields': ('vendor', 'table_identifier', 'invoice_no')}),
        ('Order Details', {'fields': ('status', 'total_amount')}),
        ('Payment Information', {'fields': ('payment_status', 'payment_method', 'transaction_id')}),
        ('Timestamps', {'fields': tuple(f for f in ['created_at', 'updated_at'] 
                                      if model_has_field(Order, f))}),
    )
    inlines = [OrderItemInline]
    actions = ['mark_as_confirmed', 'mark_as_completed', 'mark_as_cancelled', 'mark_as_paid']
    
    def vendor_name(self, obj):
        return obj.vendor.restaurant_name if hasattr(obj.vendor, 'restaurant_name') else obj.vendor.email
    vendor_name.short_description = "Restaurant"
    vendor_name.admin_order_field = "vendor__restaurant_name"
    
    def mark_as_confirmed(self, request, queryset):
        updated = queryset.update(status='confirmed', updated_at=timezone.now()) if model_has_field(Order, 'updated_at') else queryset.update(status='confirmed')
        self.message_user(request, f"{updated} orders marked as confirmed.")
    mark_as_confirmed.short_description = "Mark selected orders as confirmed"
    
    def mark_as_completed(self, request, queryset):
        updated = queryset.update(status='completed', updated_at=timezone.now()) if model_has_field(Order, 'updated_at') else queryset.update(status='completed')
        self.message_user(request, f"{updated} orders marked as completed.")
    mark_as_completed.short_description = "Mark selected orders as completed"
    
    def mark_as_cancelled(self, request, queryset):
        updated = queryset.update(status='cancelled', updated_at=timezone.now()) if model_has_field(Order, 'updated_at') else queryset.update(status='cancelled')
        self.message_user(request, f"{updated} orders marked as cancelled.")
    mark_as_cancelled.short_description = "Mark selected orders as cancelled"
    
    def mark_as_paid(self, request, queryset):
        updated = queryset.update(payment_status='paid', updated_at=timezone.now()) if model_has_field(Order, 'updated_at') else queryset.update(payment_status='paid')
        self.message_user(request, f"{updated} orders marked as paid.")
    mark_as_paid.short_description = "Mark selected orders as paid"
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('vendor')

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order_invoice', 'menu_item_name', 'quantity', 'price')
    list_filter = ('order__status', 'order__created_at')
    search_fields = ('order__invoice_no', 'menu_item__name')
    readonly_fields = ('order', 'menu_item', 'quantity', 'price')
    
    def order_invoice(self, obj):
        return obj.order.invoice_no if hasattr(obj.order, 'invoice_no') else f"Order #{obj.order.id}"
    order_invoice.short_description = "Order"
    order_invoice.admin_order_field = "order__invoice_no"
    
    def menu_item_name(self, obj):
        # Add a check for None before accessing the name attribute
        if obj.menu_item is None:
            return "Deleted Item"
        return obj.menu_item.name
    menu_item_name.short_description = "Menu Item"
    menu_item_name.admin_order_field = "menu_item__name"
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('order', 'menu_item')

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor_name', 'qr_code_display', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at', 'vendor')
    search_fields = ('name', 'vendor__restaurant_name', 'vendor__email')
    
    # Only include fields that exist on your model
    readonly_fields = tuple(f for f in ['qr_code', 'created_at', 'updated_at'] 
                           if model_has_field(Table, f)) + ('qr_code_image',)
    
    actions = ['regenerate_qr_codes', 'activate_tables', 'deactivate_tables']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('vendor')
    
    def vendor_name(self, obj):
        return obj.vendor.restaurant_name if hasattr(obj.vendor, 'restaurant_name') else obj.vendor.email
    vendor_name.short_description = "Vendor"
    vendor_name.admin_order_field = "vendor__restaurant_name"
    
    def qr_code_display(self, obj):
        if hasattr(obj, 'qr_code'):
            return str(obj.qr_code)[:8] + "..." if obj.qr_code else "-"
        return "-"
    qr_code_display.short_description = "QR Code"
    
    def qr_code_image(self, obj):
        if not hasattr(obj, 'qr_code') or not obj.qr_code:
            return "No QR Code generated"
        
        qr_url = f"/menu/{obj.vendor.id}/{obj.id}"
        return format_html(
            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={}" width="150" height="150"/><br>'
            '<a href="{}" target="_blank">View QR Link</a>', 
            qr_url, qr_url
        )
    qr_code_image.short_description = "QR Code Preview"
    
    def regenerate_qr_codes(self, request, queryset):
        count = 0
        for table in queryset:
            if hasattr(table, 'regenerate_qr_code'):
                table.regenerate_qr_code()
                count += 1
        self.message_user(request, f"Successfully regenerated QR codes for {count} tables.")
    regenerate_qr_codes.short_description = "Regenerate QR codes for selected tables"
    
    def activate_tables(self, request, queryset):
        if model_has_field(Table, 'is_active'):
            updated = queryset.update(is_active=True)
            self.message_user(request, f"Successfully activated {updated} tables.")
    activate_tables.short_description = "Activate selected tables"
    
    def deactivate_tables(self, request, queryset):
        if model_has_field(Table, 'is_active'):
            updated = queryset.update(is_active=False)
            self.message_user(request, f"Successfully deactivated {updated} tables.")
    deactivate_tables.short_description = "Deactivate selected tables"

