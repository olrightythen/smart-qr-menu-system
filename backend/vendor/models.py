# vendors/models.py
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models

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

    objects = VendorManager()

    def __str__(self):
        return self.restaurant_name
    

class MenuItem(models.Model):
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    image = models.ImageField(upload_to='menu_items/', blank=True, null=True)
    category = models.CharField(max_length=50)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='vendor_orders')
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ], default='pending')
    payment_method = models.CharField(max_length=20, choices=[
        ('esewa', 'E-Sewa'),
        ('cash', 'Cash'),
    ], default='cash')

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=8, decimal_places=2)  # item price at time of order



