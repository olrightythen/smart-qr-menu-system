# vendors/views.py

from django.views import View
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.core.exceptions import ValidationError
from django.db import transaction
from decimal import Decimal, InvalidOperation
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from ..models import Vendor, MenuItem
from ..algorithms import RecommendationEngine
import json
import logging

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class CreateMenuView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request, vendor_id):
        try:
            # Verify the authenticated user is the vendor
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get vendor with error handling
            try:
                vendor = get_object_or_404(Vendor, id=vendor_id)
            except Vendor.DoesNotExist:
                return Response({'error': 'Vendor not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Parse menu items from form data
            menu_items_raw = request.data.get('menuItems')
            if not menu_items_raw:
                return Response({'error': 'No menuItems data provided'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                items_data = json.loads(menu_items_raw)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                return Response({'error': 'Invalid JSON in menuItems'}, status=status.HTTP_400_BAD_REQUEST)
            
            if not items_data or not isinstance(items_data, list):
                return Response({'error': 'menuItems must be a non-empty array'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate and prepare data
            validated_items = []
            validation_errors = []
            
            for index, item in enumerate(items_data):
                item_errors = []
                
                # Validate name
                name = item.get('name', '').strip() if item.get('name') else ''
                if not name:
                    item_errors.append('Name is required')
                elif len(name) > 200:  # Assuming max length
                    item_errors.append('Name too long (max 200 characters)')
                
                # Validate price
                price = None
                try:
                    price_input = item.get('price')
                    if price_input is None or price_input == '':
                        item_errors.append('Price is required')
                    else:
                        price = Decimal(str(price_input))
                        if price <= 0:
                            item_errors.append('Price must be greater than 0')
                        elif price > 99999.99:  # Reasonable upper limit
                            item_errors.append('Price too high (max 99999.99)')
                except (InvalidOperation, ValueError, TypeError):
                    item_errors.append('Invalid price format')
                
                # Validate category
                category = item.get('category', '').strip() if item.get('category') else ''
                if not category:
                    item_errors.append('Category is required')
                elif len(category) > 100:  # Assuming max length
                    item_errors.append('Category too long (max 100 characters)')
                
                # Validate description (optional)
                description = item.get('description', '').strip() if item.get('description') else ''
                if len(description) > 1000:  # Assuming max length
                    item_errors.append('Description too long (max 1000 characters)')
                
                # Get image file - look for it in request.FILES with the pattern image_X where X is the index
                image_key = f'image_{index}'
                image = request.FILES.get(image_key)
                
                # Store validated data
                if item_errors:
                    validation_errors.extend([f'Item {index + 1}: {error}' for error in item_errors])
                else:
                    validated_items.append({
                        'name': name,
                        'price': price,
                        'category': category,
                        'description': description,
                        'image': image,
                        'index': index
                    })
            
            # Return validation errors if any
            if validation_errors:
                return Response({
                    'error': 'Validation failed',
                    'details': validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create menu items in a transaction for data consistency
            created_items = []
            try:
                with transaction.atomic():
                    for item_data in validated_items:
                        menu_item = MenuItem.objects.create(
                            vendor=vendor,
                            name=item_data['name'],
                            price=item_data['price'],
                            description=item_data['description'],
                            category=item_data['category'],
                            image=item_data['image'],
                            is_available=True  # Default to available
                        )
                        
                        created_items.append({
                            'id': menu_item.id,
                            'name': menu_item.name,
                            'price': str(menu_item.price),
                            'description': menu_item.description,
                            'category': menu_item.category,
                            'image_url': request.build_absolute_uri(menu_item.image.url) if menu_item.image else None
                        })
                
                logger.info(f"Successfully created {len(created_items)} menu items for vendor {vendor_id}")
                
                return Response({
                    'message': 'Menu items created successfully',
                    'created_items': created_items,
                    'count': len(created_items)
                }, status=status.HTTP_201_CREATED)
                
            except ValidationError as e:
                logger.error(f"Model validation error: {e}")
                return Response({
                    'error': 'Database validation failed',
                    'details': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                logger.error(f"Database error during menu creation: {e}")
                return Response({
                    'error': 'Failed to save menu items',
                    'details': str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as e:
            logger.error(f"Unexpected error in CreateMenuView: {e}")
            return Response({
                'error': 'Internal server error',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get(self, request, vendor_id):
        """Get existing menu items for a vendor"""
        try:
            # Check authorization
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
                
            vendor = get_object_or_404(Vendor, id=vendor_id)
            menu_items = MenuItem.objects.filter(vendor=vendor).order_by('-created_at')
            
            items_data = [{
                'id': item.id,
                'name': item.name,
                'price': str(item.price),
                'description': item.description,
                'category': item.category,
                'image_url': request.build_absolute_uri(item.image.url) if item.image else None,
                'is_available': item.is_available,
                'created_at': item.created_at.isoformat() if hasattr(item, 'created_at') else None
            } for item in menu_items]
            
            return Response({
                'menu_items': items_data,
                'count': len(items_data)
            })
            
        except Exception as e:
            logger.error(f"Error fetching menu items: {e}")
            return Response({
                'error': 'Failed to fetch menu items',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MenuItemListView(APIView):
    """API endpoint to list menu items by category"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, vendor_id):
        """Get all menu items for a vendor, grouped by category"""
        try:
            # Check authorization
            if request.user.id != int(vendor_id) and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get all menu items for this vendor
            menu_items = MenuItem.objects.filter(vendor=vendor).order_by('category', 'name')
            
            # Group by category
            categories = {}
            for item in menu_items:
                category = item.category
                if category not in categories:
                    categories[category] = []
                
                # Add item to its category
                categories[category].append({
                    'id': item.id,
                    'name': item.name,
                    'price': str(item.price),
                    'description': item.description or '',
                    'category': item.category,
                    'image_url': request.build_absolute_uri(item.image.url) if item.image and hasattr(item.image, 'url') else None,
                    'is_available': item.is_available
                })
            
            # Format for response
            formatted_categories = [
                {
                    'name': category_name,
                    'items': items
                } for category_name, items in categories.items()
            ]
            
            return Response({
                'categories': formatted_categories,
                'total_items': menu_items.count()
            })
            
        except Exception as e:
            logger.error(f"Error fetching menu items: {e}")
            return Response({
                'error': 'Failed to fetch menu items',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MenuItemDetailView(APIView):
    """API endpoint for individual menu item operations"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def delete(self, request, item_id):
        """Delete a menu item"""
        try:
            menu_item = get_object_or_404(MenuItem, id=item_id)
            
            # Check authorization
            if request.user.id != menu_item.vendor.id and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            # Delete the item
            menu_item.delete()
            
            return Response({
                'message': 'Menu item deleted successfully'
            })
            
        except Exception as e:
            logger.error(f"Error deleting menu item: {e}")
            return Response({
                'error': 'Failed to delete menu item',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    def get(self, request, item_id):
        """Get details of a specific menu item"""
        try:
            menu_item = get_object_or_404(MenuItem, id=item_id)
            
            # Check authorization
            if request.user.id != menu_item.vendor.id and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            data = {
                'id': menu_item.id,
                'name': menu_item.name,
                'price': str(menu_item.price),
                'description': menu_item.description or '',
                'category': menu_item.category,
                'image_url': request.build_absolute_uri(menu_item.image.url) if menu_item.image and hasattr(menu_item.image, 'url') else None,
                'is_available': menu_item.is_available
            }
            
            return Response(data)
            
        except Exception as e:
            logger.error(f"Error fetching menu item: {e}")
            return Response({
                'error': 'Failed to fetch menu item',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def put(self, request, item_id):
        """Update a menu item"""
        try:
            menu_item = get_object_or_404(MenuItem, id=item_id)
            
            # Check authorization
            if request.user.id != menu_item.vendor.id and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            # Update fields
            if 'name' in request.data:
                menu_item.name = request.data['name']
            
            if 'price' in request.data:
                try:
                    menu_item.price = Decimal(str(request.data['price']))
                    if menu_item.price <= 0:
                        return Response({'error': 'Price must be greater than 0'}, 
                                       status=status.HTTP_400_BAD_REQUEST)
                except (InvalidOperation, ValueError):
                    return Response({'error': 'Invalid price format'}, 
                                   status=status.HTTP_400_BAD_REQUEST)
            
            if 'category' in request.data:
                menu_item.category = request.data['category']
            
            if 'description' in request.data:
                menu_item.description = request.data['description']
            
            if 'is_available' in request.data:
                # Convert string to boolean
                is_available = request.data['is_available']
                if isinstance(is_available, str):
                    menu_item.is_available = is_available.lower() == 'true'
                else:
                    menu_item.is_available = bool(is_available)
            
            # Update image if provided
            if 'image' in request.FILES:
                # Delete old image if exists
                if menu_item.image:
                    menu_item.image.delete(save=False)
                menu_item.image = request.FILES['image']
            
            # Save the changes
            menu_item.save()
            
            # Return updated data
            data = {
                'id': menu_item.id,
                'name': menu_item.name,
                'price': str(menu_item.price),
                'description': menu_item.description or '',
                'category': menu_item.category,
                'image_url': request.build_absolute_uri(menu_item.image.url) if menu_item.image and hasattr(menu_item.image, 'url') else None,
                'is_available': menu_item.is_available
            }
            
            return Response(data)
            
        except Exception as e:
            logger.error(f"Error updating menu item: {e}")
            return Response({
                'error': 'Failed to update menu item',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ToggleMenuItemAvailabilityView(APIView):
    """Toggle a menu item's availability status"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request, item_id):
        try:
            menu_item = get_object_or_404(MenuItem, id=item_id)
            
            # Check authorization
            if request.user.id != menu_item.vendor.id and not request.user.is_staff:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            # Toggle availability
            menu_item.is_available = not menu_item.is_available
            menu_item.save()
            
            return Response({
                'id': menu_item.id,
                'is_available': menu_item.is_available
            })
            
        except Exception as e:
            logger.error(f"Error toggling menu item availability: {e}")
            return Response({
                'error': 'Failed to update menu item',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class PublicMenuView(APIView):
    """API endpoint to fetch menu items for public access"""
    
    def get(self, request, vendor_id):
        """Get all menu items for a vendor, grouped by category"""
        try:
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get basic vendor info
            vendor_info = {
                'restaurant_name': vendor.restaurant_name,
                'location': vendor.location,
                'description': vendor.description,
                'opening_time': vendor.opening_time.strftime('%H:%M') if vendor.opening_time else None,
                'closing_time': vendor.closing_time.strftime('%H:%M') if vendor.closing_time else None,
            }
            
            # Get all menu items for this vendor
            menu_items = MenuItem.objects.filter(vendor=vendor).order_by('category', 'name')
            
            # Group by category
            categories = {}
            for item in menu_items:
                category = item.category
                if category not in categories:
                    categories[category] = []
                
                # Add item to its category
                categories[category].append({
                    'id': item.id,
                    'name': item.name,
                    'price': str(item.price),
                    'description': item.description or '',
                    'category': item.category,
                    'image_url': request.build_absolute_uri(item.image.url) if item.image and hasattr(item.image, 'url') else None,
                    'is_available': item.is_available,
                    'is_veg': getattr(item, 'is_veg', False)  # Default to False if field doesn't exist
                })
            
            # Format for response
            formatted_categories = [
                {
                    'name': category_name,
                    'items': items
                } for category_name, items in categories.items()
            ]
            
            # Get popular recommendations
            recommendation_engine = RecommendationEngine(vendor_id)
            popular_items = recommendation_engine.get_popular_items(limit=5)
            
            # Add image URLs to popular items
            for item in popular_items:
                menu_item = MenuItem.objects.get(id=item['id'])
                if menu_item.image and hasattr(menu_item.image, 'url'):
                    item['image_url'] = request.build_absolute_uri(menu_item.image.url)
                else:
                    item['image_url'] = None
            
            return Response({
                'vendor_info': vendor_info,
                'categories': formatted_categories,
                'total_items': menu_items.count(),
                'popular_items': popular_items  # Add popular items to the response
            })
            
        except Exception as e:
            logger.error(f"Error fetching public menu: {e}")
            return Response({
                'error': 'Failed to fetch menu',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)