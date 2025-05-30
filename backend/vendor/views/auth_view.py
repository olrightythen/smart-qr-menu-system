# vendors/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from django.conf import settings
import logging
import os
from PIL import Image
from io import BytesIO

# Set up logger
logger = logging.getLogger(__name__)

class VendorRegisterView(APIView):
    def post(self, request):
        data = request.data
        
        # Check if email already exists
        try:
            # First validate that all required fields are present
            required_fields = ["email", "password", "restaurant_name", "location"]
            for field in required_fields:
                if field not in data or not data[field]:
                    return Response(
                        {"error": f"{field} is required"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Check for existing email
            if get_user_model().objects.filter(email=data["email"]).exists():
                return Response(
                    {"error": "An account with this email already exists"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the new user
            user = get_user_model().objects.create_user(
                username=data["username"],
                email=data["email"],
                password=data["password"],
                restaurant_name=data["restaurant_name"],
                owner_name=data.get("owner_name", ""),  # Optional field
                phone=data.get("phone", ""),  # Optional field
                location=data["location"],
                description=data.get("description", ""),  # Optional field
                opening_time=data.get("opening_time", None),  # Optional field
                closing_time=data.get("closing_time", None),  # Optional field
            )
            
            return Response(
                {"message": "Vendor registered successfully"}, 
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        

class VendorLoginView(APIView):
    def post(self, request):
        data = request.data
        try:
            user = get_user_model().objects.get(email=data["email"])
            if user.check_password(data["password"]):
                token, created = Token.objects.get_or_create(user=user)
                user_data = {
                    "id": user.id,
                    "email": user.email,
                    "name": user.owner_name,
                    "restaurant_name": user.restaurant_name,
                }
                return Response(
                    {"token": token.key, "user": user_data},
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {"error": "Invalid email or password"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        except get_user_model().DoesNotExist:
            return Response(
                {"error": "User does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )


