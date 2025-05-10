# vendors/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..models import Vendor
from django.contrib.auth import get_user_model

class VendorRegisterView(APIView):
    def post(self, request):
        data = request.data
        try:
            user = get_user_model().objects.create_user(
                username=data["username"],
                email=data["email"],
                password=data["password"],
                restaurant_name=data["restaurant_name"],
                location=data["location"],
            )
            return Response({"message": "Vendor registered successfully"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        # login using email and password
class VendorLoginView(APIView):
    def post(self, request):
        data = request.data
        try:
            user = get_user_model().objects.get(email=data["email"])
            if user.check_password(data["password"]):
                return Response({"message": "Login successful"}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid password"}, status=status.HTTP_400_BAD_REQUEST)
        except get_user_model().DoesNotExist:
            return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)
        
class VendorProfileView(APIView):
    def get(self, request):
        user = request.user
        if user.is_authenticated:
            profile_data = {
                "username": user.username,
                "email": user.email,
                "restaurant_name": user.restaurant_name,
                "location": user.location,
            }
            return Response(profile_data, status=status.HTTP_200_OK)
        else:
            return Response({"error": "User not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
