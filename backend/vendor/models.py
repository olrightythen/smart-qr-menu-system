# vendors/models.py
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

class VendorManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        return self.create_user(username, email, password, **extra_fields)

class Vendor(AbstractUser):
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
