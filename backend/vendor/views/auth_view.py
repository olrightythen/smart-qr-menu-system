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


class VendorDetailView(APIView):
    """
    Get vendor details by ID
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id):
        try:
            logger.info(f"Fetching vendor with ID: {vendor_id}")
            
            # Check if the requesting user has permission to access this vendor's data
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                logger.warning(f"Permission denied: User {request.user.id} tried to access vendor {vendor_id}")
                return Response(
                    {"error": "You do not have permission to access this data"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            logger.info(f"Retrieving user object for vendor ID: {vendor_id}")    
            user = get_user_model().objects.get(id=vendor_id)
            logger.info(f"User found: {user.email}")
            
            # Build user data carefully to avoid attribute errors
            user_data = {
                "id": user.id,
                "email": user.email,
            }
            
            # Add each field individually with explicit logging
            fields_to_check = ['restaurant_name', 'owner_name', 'phone', 'location', 
                              'description', 'opening_time', 'closing_time']
            
            for field in fields_to_check:
                try:
                    if hasattr(user, field):
                        value = getattr(user, field)
                        user_data[field] = value
                        logger.debug(f"Added field {field}: {value}")
                    else:
                        user_data[field] = ""
                        logger.debug(f"Field {field} not found on user model")
                except Exception as field_error:
                    logger.error(f"Error accessing field {field}: {str(field_error)}")
                    user_data[field] = ""
            
            # Handle logo separately to avoid errors
            try:
                logger.info("Checking for logo field")
                if hasattr(user, 'logo') and user.logo:
                    user_data["logo"] = user.logo.url
                    logger.info(f"Logo found: {user.logo.url}")
                else:
                    user_data["logo"] = None
                    logger.info("No logo available")
            except Exception as logo_error:
                logger.error(f"Error accessing logo: {str(logo_error)}")
                user_data["logo"] = None
            
            logger.info("Successfully prepared vendor data for response")
            return Response(user_data, status=status.HTTP_200_OK)
            
        except get_user_model().DoesNotExist:
            logger.warning(f"Vendor with ID {vendor_id} not found")
            return Response(
                {"error": "Vendor not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            # Log the full error for debugging
            logger.error(f"Error in VendorDetailView: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while retrieving vendor data"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VendorUpdateView(APIView):
    """
    Update vendor details including logo
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def put(self, request, vendor_id):
        try:
            # Check if the requesting user has permission to update this vendor's data
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to update this data"},
                    status=status.HTTP_403_FORBIDDEN
                )
                
            user = get_user_model().objects.get(id=vendor_id)
            
            # Process logo file if provided
            if 'logo' in request.FILES:
                logo_file = request.FILES['logo']
                
                 # Validate file type
                valid_extensions = ['.jpg', '.jpeg', '.png', '.gif']
                ext = os.path.splitext(logo_file.name)[1].lower()
                
                if ext not in valid_extensions:
                    return Response(
                        {"error": "Unsupported file type. Please upload a JPEG, PNG, or GIF image."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Validate file size (max 5MB)
                if logo_file.size > 5 * 1024 * 1024:  # 5MB
                    return Response(
                        {"error": "File size should be less than 5MB"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                
                # Delete old logo if exists
                if user.logo:
                    try:
                        if os.path.isfile(user.logo.path):
                            os.remove(user.logo.path)
                    except Exception as delete_error:
                        logger.error(f"Error deleting old logo: {str(delete_error)}")
                
                # Simply assign the uploaded file
                user.logo = logo_file
            
            # Process regular form fields
            if 'restaurant_name' in request.data and hasattr(user, 'restaurant_name'):
                user.restaurant_name = request.data['restaurant_name']
            if 'owner_name' in request.data and hasattr(user, 'owner_name'):
                user.owner_name = request.data['owner_name']
            if 'email' in request.data:
                # Check if the email is already in use by another account
                if get_user_model().objects.exclude(id=vendor_id).filter(email=request.data['email']).exists():
                    return Response(
                        {"error": "This email is already in use by another account"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                user.email = request.data['email']
            if 'phone' in request.data and hasattr(user, 'phone'):
                user.phone = request.data['phone']
            if 'location' in request.data and hasattr(user, 'location'):
                user.location = request.data['location']
            if 'description' in request.data and hasattr(user, 'description'):
                user.description = request.data['description']
            if 'opening_time' in request.data and hasattr(user, 'opening_time'):
                user.opening_time = request.data['opening_time']
            if 'closing_time' in request.data and hasattr(user, 'closing_time'):
                user.closing_time = request.data['closing_time']
            
            # Save the user
            user.save()
            
            # Prepare response data
            response_data = {
                "message": "Vendor details updated successfully"
            }
            
            # Include logo URL in response if available
            if user.logo:
                response_data["logo"] = request.build_absolute_uri(user.logo.url)
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except get_user_model().DoesNotExist:
            return Response(
                {"error": "Vendor not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in VendorUpdateView: {str(e)}", exc_info=True)
            return Response(
                {"error": f"An error occurred while updating vendor data: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

