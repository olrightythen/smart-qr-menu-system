# vendors/models.py
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.timezone import now
from django.conf import settings
import uuid

class VendorManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")

        email = self.normalize_email(email)

        if self.model.objects.filter(email=email).exists():
            raise ValidationError("A user with this email already exists.")

        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(username, email, password, **extra_fields)

class Vendor(AbstractUser):
    email = models.EmailField(unique=True)
    restaurant_name = models.CharField(max_length=100)
    owner_name = models.CharField(max_length=100, blank=True, null=True)  # New field
    phone = models.CharField(max_length=20, blank=True, null=True)  # New field
    location = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)  # New field
    opening_time = models.TimeField(null=True, blank=True)  # New field
    closing_time = models.TimeField(null=True, blank=True)  # New field
    logo = models.ImageField(upload_to='vendor_logos/', blank=True, null=True)  # New field

    objects = VendorManager()

    def __str__(self):
        return self.restaurant_name
    

class MenuItem(models.Model):
    vendor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='menu_items')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    category = models.CharField(max_length=50)
    image = models.ImageField(upload_to='menu_items/', blank=True, null=True)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Add this field if you want to track updates
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        
    def __str__(self):
        return self.name

class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('confirmed', 'Confirmed'),
        ('rejected', 'Rejected'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready for Pickup'),
        ('delivered', 'Delivered'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='orders')
    table = models.ForeignKey('Table', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    table_identifier = models.CharField(max_length=100, null=True, blank=True)  # Keep for backward compatibility
    invoice_no = models.CharField(max_length=100, unique=True, default="INV-000000")
    transaction_id = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(default=now)
    updated_at = models.DateTimeField(auto_now=True)
    payment_status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ], default='pending')
    payment_method = models.CharField(max_length=20, choices=[
        ('esewa', 'E-Sewa'),
        ('cash', 'Cash'),
    ], default='cash')
    
    # Customer verification fields
    customer_verified = models.BooleanField(default=False, help_text="Whether customer has verified receiving the order")
    verification_timestamp = models.DateTimeField(null=True, blank=True, help_text="When customer verified the order")
    delivery_issue_reported = models.BooleanField(default=False, help_text="Whether customer reported not receiving the order")
    issue_report_timestamp = models.DateTimeField(null=True, blank=True, help_text="When the delivery issue was reported")
    issue_description = models.TextField(blank=True, null=True, help_text="Description of the delivery issue")
    
    # Issue resolution fields
    issue_resolved = models.BooleanField(default=False, help_text="Whether vendor has resolved the delivery issue")
    issue_resolution_timestamp = models.DateTimeField(null=True, blank=True, help_text="When the delivery issue was resolved")
    resolution_message = models.TextField(blank=True, null=True, help_text="Vendor's message about how the issue was resolved")

    def __str__(self):
        return f"Order #{self.id} - {self.vendor.restaurant_name}"
        
    class Meta:
        ordering = ['-created_at']

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey('MenuItem', on_delete=models.SET_NULL, null=True, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=8, decimal_places=2)  # item price at time of order

    def __str__(self):
        menu_item_name = self.menu_item.name if self.menu_item else "Unknown Item"
        return f"{self.quantity}x {menu_item_name} in Order #{self.order.id}"

class Table(models.Model):
    """
    Model representing a restaurant table with QR code
    """
    vendor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='tables',
        help_text="The vendor/restaurant owner this table belongs to"
    )
    name = models.CharField(
        max_length=100,
        help_text="Name or number of the table (e.g., 'Table 1', 'Patio 3')"
    )
    qr_code = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text="Unique identifier for the QR code"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this table is active and its QR code can be used"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = "Table"
        verbose_name_plural = "Tables"
        unique_together = [['vendor', 'name']]  # Prevent duplicate table names for the same vendor
    
    def __str__(self):
        return f"{self.vendor.restaurant_name or self.vendor.email} - {self.name}"
    
    def regenerate_qr_code(self):
        """Generate a new unique QR code identifier for this table"""
        self.qr_code = uuid.uuid4()
        self.save(update_fields=['qr_code', 'updated_at'])
        return self.qr_code
    
    @property
    def qr_string(self):
        """Return the QR code as a string"""
        return str(self.qr_code)
    
    @property
    def vendor_name(self):
        """Return the vendor's restaurant name or email if no restaurant name is set"""
        return self.vendor.restaurant_name or self.vendor.email



