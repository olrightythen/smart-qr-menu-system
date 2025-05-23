from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from rest_framework.authentication import TokenAuthentication
import logging
from ..models import Table  # Import Table from models.py instead of defining it here
from django.conf import settings

# Set up logger
logger = logging.getLogger(__name__)

class TableListView(APIView):
    """
    List all tables for a vendor
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id):
        try:
            # Check if the requesting user has permission to access this vendor's data
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to access this data"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get all tables for this vendor
            tables = Table.objects.filter(vendor_id=vendor_id)
            
            tables_data = []
            for table in tables:
                tables_data.append({
                    "id": table.id,
                    "name": table.name,
                    "qr_code": table.qr_string,  # Use the property from your model
                    "created_at": table.created_at,
                })
            
            return Response({"tables": tables_data}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in TableListView: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while retrieving tables"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TableCreateView(APIView):
    """
    Create a new table for a vendor
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, vendor_id):
        try:
            # Check if the requesting user has permission
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to perform this action"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the table name from request data
            name = request.data.get('name')
            if not name:
                return Response(
                    {"error": "Table name is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the table - using the model from models.py
            table = Table(
                vendor_id=vendor_id,
                name=name
            )
            table.save()
            
            # Return the newly created table
            return Response({
                "message": "Table created successfully",
                "table": {
                    "id": table.id,
                    "name": table.name,
                    "qr_code": table.qr_string,
                    "created_at": table.created_at,
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error in TableCreateView: {str(e)}", exc_info=True)
            return Response(
                {"error": f"An error occurred while creating the table: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TableDeleteView(APIView):
    """
    Delete a table
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, vendor_id, table_id):
        try:
            # Check if the requesting user has permission
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to perform this action"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the table
            table = Table.objects.get(id=table_id, vendor_id=vendor_id)
            
            # Delete the table
            table.delete()
            
            return Response(
                {"message": "Table deleted successfully"},
                status=status.HTTP_200_OK
            )
            
        except Table.DoesNotExist:
            return Response(
                {"error": "Table not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in TableDeleteView: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while deleting the table"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TableRegenerateQRView(APIView):
    """
    Regenerate a table's QR code
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def put(self, request, vendor_id, table_id):
        try:
            # Check if the requesting user has permission
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to perform this action"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the table
            table = Table.objects.get(id=table_id, vendor_id=vendor_id)
            
            # Generate a new QR code using the method from your model
            table.regenerate_qr_code()
            
            return Response({
                "message": "QR code regenerated successfully",
                "qr_code": table.qr_string
            }, status=status.HTTP_200_OK)
            
        except Table.DoesNotExist:
            return Response(
                {"error": "Table not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in TableRegenerateQRView: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while regenerating the QR code"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )