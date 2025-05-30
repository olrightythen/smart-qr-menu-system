from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from rest_framework.authentication import TokenAuthentication
import logging
from ..models import Table
from django.conf import settings
from django.shortcuts import get_object_or_404

# Set up logger
logger = logging.getLogger(__name__)

class PublicTableStatusView(APIView):
    """
    Public endpoint to check table availability without authentication
    """
    authentication_classes = []  # No authentication required
    permission_classes = []      # No permissions required
    
    def get(self, request, vendor_id, table_identifier):
        try:
            logger.info(f"PublicTableStatusView called with vendor_id: {vendor_id}, table_identifier: {table_identifier}")
            
            # Validate inputs
            if not vendor_id or not table_identifier:
                logger.error(f"Missing required parameters: vendor_id={vendor_id}, table_identifier={table_identifier}")
                return Response(
                    {"error": "Missing required parameters"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Try to convert vendor_id to int
            try:
                vendor_id = int(vendor_id)
            except (ValueError, TypeError):
                logger.error(f"Invalid vendor_id format: {vendor_id}")
                return Response(
                    {"error": "Invalid vendor ID"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Only try to find by qr_code - no fallback
            logger.info(f"Searching for table with qr_code: {table_identifier} for vendor: {vendor_id}")
            
            table = Table.objects.filter(
                vendor_id=vendor_id, 
                qr_code=table_identifier
            ).first()
            
            if not table:
                logger.warning(f"Table not found with qr_code: {table_identifier} for vendor: {vendor_id}")
                # Let's also check what tables exist for this vendor
                existing_tables = Table.objects.filter(vendor_id=vendor_id).values('id', 'name', 'qr_code')
                logger.info(f"Existing tables for vendor {vendor_id}: {list(existing_tables)}")
                
                return Response(
                    {"error": "Table not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            logger.info(f"Found table: {table.id} - {table.name}")
            
            # Check if table has is_active attribute
            is_active = True
            if hasattr(table, 'is_active'):
                is_active = table.is_active
            else:
                logger.warning(f"Table {table.id} does not have is_active attribute")
            
            response_data = {
                "table_id": table.id,
                "name": table.name,
                "qr_code": table.qr_code,
                "is_active": is_active,
                "vendor_id": table.vendor_id
            }
            
            logger.info(f"Returning table data: {response_data}")
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Unexpected error in PublicTableStatusView: {str(e)}", exc_info=True)
            return Response(
                {"error": f"An error occurred while checking table status: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
                    "qr_code": table.qr_code,  # Use qr_code field
                    "is_active": getattr(table, 'is_active', True),
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
                    "qr_code": table.qr_code,  # Return qr_code instead of qr_string
                    "created_at": table.created_at,
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error in TableCreateView: {str(e)}", exc_info=True)
            return Response(
                {"error": f"An error occurred while creating the table: {str(e)}"},
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
                "qr_code": table.qr_code  # Return the new qr_code
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

class TableToggleAvailabilityView(APIView):
    """
    Toggle table availability (active/inactive)
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def put(self, request, vendor_id, table_id):
        try:
            # Validate vendor access
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to perform this action"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the table
            table = get_object_or_404(Table, id=table_id, vendor_id=vendor_id)
            
            # Get the new status from request
            new_status = request.data.get('is_active', True)
            
            # Update table availability
            table.is_active = new_status
            table.save()

            return Response({
                "message": "Table availability updated successfully",
                "table": {
                    "id": table.id,
                    "name": table.name,
                    "is_active": table.is_active
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in TableToggleAvailabilityView: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while updating table availability"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TableRenameView(APIView):
    """
    Rename a table
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def put(self, request, vendor_id, table_id):
        try:
            # Validate vendor access
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to perform this action"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the table
            table = get_object_or_404(Table, id=table_id, vendor_id=vendor_id)
            
            # Get the new name from request
            new_name = request.data.get('name')
            if not new_name:
                return Response(
                    {"error": "Table name is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update table name
            table.name = new_name
            table.save()

            return Response({
                "message": "Table renamed successfully",
                "table": {
                    "id": table.id,
                    "name": table.name,
                    "qr_code": table.qr_code
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in TableRenameView: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while renaming the table"},
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