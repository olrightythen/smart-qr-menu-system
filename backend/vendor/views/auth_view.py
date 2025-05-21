# vendors/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..models import Vendor, MenuItem
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model

# -----------------------
# Menu Views
# -----------------------

class MenuItemCreateView(APIView):
    def post(self, request):
        data = request.data
        try:
            for item_data in data['items']:
                MenuItem.objects.create(
                    name=item_data.get('name', ''),
                    price=item_data.get('price', 0),
                    description=item_data.get('description', ''),
                    category=item_data.get('category', ''),
                    image_url=item_data.get('imageUrl', ''),
                )
            return Response({"message": "Menu items created successfully"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MenuItemListView(APIView):
    def get(self, request):
        try:
            menu_items = MenuItem.objects.all()
            data = [
                {
                    "id": item.id,
                    "name": item.name,
                    "price": str(item.price),
                    "description": item.description,
                    "category": item.category,
                    "imageUrl": item.image_url,
                }
                for item in menu_items
            ]
            return Response({"items": data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# -----------------------
# Vendor Views
# -----------------------

class VendorRegisterView(APIView):
    def post(self, request):
        data = request.data
        try:
            user = get_user_model().objects.create_user(
                username=data["username"],
                email=data["email"],
                password=data["password"],
                restaurant_name=data["restaurant_name"],
                owner_name=data["owner_name"],
                phone=data["phone"],
                location=data["location"],
                description=data["description"],
                opening_time=data["opening_time"],
                closing_time=data["closing_time"],
            )
            return Response({"message": "Vendor registered successfully"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


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
