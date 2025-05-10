from ..views.auth_view import VendorRegisterView, VendorLoginView
from django.urls import path

urlpatterns = [
    path('login/', VendorLoginView.as_view(), name='vendor-login'),
    path('register/', VendorRegisterView.as_view(), name='vendor-register'),
]
