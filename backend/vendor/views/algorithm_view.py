"""
API endpoints that utilize database-optimized algorithms
"""

import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import connection
from django.db.models import Count, Q
from ..models import MenuItem, Vendor
from ..algorithms import RecommendationEngine

logger = logging.getLogger(__name__)

def get_image_url(request, image_path):
    """Helper function to properly construct image URLs"""
    if not image_path:
        return None
    
    if settings.MEDIA_URL and image_path.startswith(settings.MEDIA_URL):
        # Already has media URL prefix
        image_url = image_path
    else:
        # Need to add the media URL prefix
        image_url = f"{settings.MEDIA_URL}{image_path}" if image_path else None
    
    # Add domain if it's a relative URL
    if image_url and not image_url.startswith(('http://', 'https://')):
        return request.build_absolute_uri(image_url)
    return image_url

class MenuRecommendationsView(APIView):
    """
    API endpoint to get menu item recommendations based on items in the cart
    """
    
    def get(self, request, vendor_id):
        try:
            # Validate vendor exists
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get cart item IDs from the query parameters
            cart_items_param = request.query_params.get('items', '')
            if not cart_items_param:
                return Response({'recommendations': []})
                
            try:
                cart_items = [int(item) for item in cart_items_param.split(',') if item.strip().isdigit()]
            except ValueError:
                return Response(
                    {'error': 'Invalid item IDs in request'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get limit parameter (default: 5)
            try:
                limit = int(request.query_params.get('limit', 5))
                limit = min(limit, 10)  # Cap at 10 to prevent abuse
            except ValueError:
                limit = 5
                
            # If no cart items, return empty recommendations
            if not cart_items:
                return Response({'recommendations': []})
                
            # Initialize recommendation engine
            engine = RecommendationEngine(vendor_id)
            
            # Get recommendations
            recommendations = engine.get_recommendations(cart_items, max_recommendations=limit)
            
            # Add image URLs to the recommendations - using a single query for efficiency
            if recommendations:
                item_ids = [item['id'] for item in recommendations]
                menu_items = MenuItem.objects.filter(id__in=item_ids).values('id', 'image')
                
                # Create a mapping of item_id to image_url
                item_images = {
                    item['id']: get_image_url(request, item['image'])
                    for item in menu_items if item['image']
                }
                
                # Add image URLs to recommendations
                for item in recommendations:
                    item['image_url'] = item_images.get(item['id'])
            
            return Response({'recommendations': recommendations})
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to generate recommendations'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MenuSearchView(APIView):
    """
    API endpoint to search menu items using MySQL's native capabilities
    """
    
    def get(self, request, vendor_id):
        try:
            # Validate vendor exists
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get search query
            query = request.query_params.get('query', '').strip()
            
            if not query:
                return Response(
                    {'error': 'Search query is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Get fuzzy parameter (default: True)
            fuzzy = request.query_params.get('fuzzy', 'true').lower() != 'false'
            
            # Use parametrized queries to prevent SQL injection
            with connection.cursor() as cursor:
                if not fuzzy:
                    # Exact match - case insensitive
                    cursor.execute("""
                        SELECT 
                            id, name, price, category, description, is_available, image
                        FROM 
                            vendor_menuitem
                        WHERE 
                            vendor_id = %s
                            AND LOWER(name) = LOWER(%s)
                        ORDER BY
                            name
                    """, [vendor_id, query])
                else:
                    # Fuzzy search using MySQL LIKE
                    cursor.execute("""
                        SELECT 
                            id, name, price, category, description, is_available, image,
                            CASE
                                WHEN LOWER(name) = LOWER(%s) THEN 100
                                WHEN LOWER(name) LIKE CONCAT(LOWER(%s), '%%') THEN 90
                                WHEN LOWER(name) LIKE CONCAT('%%', LOWER(%s), '%%') THEN 70
                                ELSE 50
                            END as match_score
                        FROM 
                            vendor_menuitem
                        WHERE 
                            vendor_id = %s
                            AND (
                                LOWER(name) LIKE CONCAT('%%', LOWER(%s), '%%')
                                OR LOWER(category) LIKE CONCAT('%%', LOWER(%s), '%%')
                            )
                        ORDER BY 
                            match_score DESC, name
                        LIMIT 10
                    """, [query, query, query, vendor_id, query, query])
                
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Process results and add image URLs
            for item in results:
                # Format price as string
                item['price'] = str(item['price'])
                
                # Convert is_available to boolean
                item['is_available'] = bool(item['is_available'])
                
                # Add image URL
                item['image_url'] = get_image_url(request, item.get('image'))
                
                # Remove the raw image path
                if 'image' in item:
                    del item['image']
            
            return Response({'results': results})
            
        except Exception as e:
            logger.error(f"Error searching menu items: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to search menu items'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MenuSortView(APIView):
    """
    API endpoint to sort menu items using MySQL's native ORDER BY
    """
    
    def get(self, request, vendor_id):
        try:
            # Validate vendor exists
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get sort parameters
            sort_by = request.query_params.get('sort_by', 'popularity')
            order = request.query_params.get('order', 'desc')
            
            # Get limit parameter (optional)
            try:
                limit = int(request.query_params.get('limit', 0))
                # Cap limit to prevent abuse
                limit = min(limit, 100) if limit > 0 else 0
            except ValueError:
                limit = 0
                
            # Validate sort parameters
            if sort_by not in ['price', 'name', 'popularity']:
                return Response(
                    {'error': 'Invalid sort_by parameter. Must be one of: price, name, popularity'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if order not in ['asc', 'desc']:
                return Response(
                    {'error': 'Invalid order parameter. Must be one of: asc, desc'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Use database for sorting with proper ORDER BY clause
            with connection.cursor() as cursor:
                order_direction = "DESC" if order == 'desc' else "ASC"
                
                # Securely construct sort field to avoid SQL injection
                sort_field = {
                    'price': 'm.price',
                    'name': 'm.name',
                    'popularity': 'popularity'
                }.get(sort_by)
                
                if sort_by == 'popularity':
                    # For popularity sorting, join with order items
                    query = f"""
                        SELECT 
                            m.id, 
                            m.name, 
                            m.price,
                            m.category,
                            m.description,
                            m.is_available,
                            m.image,
                            COUNT(oi.id) as popularity
                        FROM 
                            vendor_menuitem m
                        LEFT JOIN 
                            vendor_orderitem oi ON m.id = oi.menu_item_id
                        WHERE 
                            m.vendor_id = %s
                        GROUP BY 
                            m.id, m.name, m.price, m.category, m.description, m.is_available, m.image
                        ORDER BY 
                            {sort_field} {order_direction}, m.id
                    """
                else:
                    # For price or name sorting
                    query = f"""
                        SELECT 
                            m.id, 
                            m.name, 
                            m.price,
                            m.category,
                            m.description,
                            m.is_available,
                            m.image
                        FROM 
                            vendor_menuitem m
                        WHERE 
                            m.vendor_id = %s
                        ORDER BY 
                            {sort_field} {order_direction}, m.id
                    """
                
                # Add limit if specified
                if limit > 0:
                    query += f" LIMIT {limit}"
                    
                cursor.execute(query, [vendor_id])
                
                # Get column names and results
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            # Format results
            items = []
            for item in results:
                formatted_item = {
                    'id': item['id'],
                    'name': item['name'],
                    'price': str(item['price']),
                    'category': item['category'],
                    'description': item['description'] or '',
                    'is_available': bool(item['is_available']),
                    'image_url': get_image_url(request, item.get('image'))
                }
                
                if 'popularity' in item:
                    formatted_item['popularity'] = int(item['popularity'])
                    
                items.append(formatted_item)
            
            return Response({'items': items})
            
        except Exception as e:
            logger.error(f"Error sorting menu items: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to sort menu items'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )