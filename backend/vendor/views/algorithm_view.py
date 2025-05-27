"""
API endpoints that utilize the advanced algorithms
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from ..models import MenuItem, Vendor
from ..algorithms import RecommendationEngine, MenuItemSearch, MenuItemSorter

logger = logging.getLogger(__name__)

class MenuRecommendationsView(APIView):
    """
    API endpoint to get menu item recommendations based on items in the cart
    """
    
    def get(self, request, vendor_id):
        try:
            # Validate vendor exists
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get cart item IDs from the query parameters
            cart_items = request.query_params.get('items', '').split(',')
            cart_items = [int(item) for item in cart_items if item.isdigit()]
            
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
            
            # Add image URLs to the recommendations
            for item in recommendations:
                menu_item = MenuItem.objects.filter(id=item['id']).first()
                item['image_url'] = request.build_absolute_uri(menu_item.image.url) if menu_item and menu_item.image else None
            
            return Response({'recommendations': recommendations})
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to generate recommendations'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MenuSearchView(APIView):
    """
    API endpoint to search menu items using binary search
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
            
            # Initialize search engine
            search_engine = MenuItemSearch(vendor_id)
            
            # Perform search
            results = search_engine.binary_search_by_name(query, fuzzy=fuzzy)
            
            # Add image URLs to the search results
            for item in results:
                menu_item = MenuItem.objects.filter(id=item['id']).first()
                item['image_url'] = request.build_absolute_uri(menu_item.image.url) if menu_item and menu_item.image else None
                
                # If fuzzy search, include match score in response
                if fuzzy and 'match_score' in item:
                    item['match_score'] = item['match_score']
            
            return Response({'results': results})
            
        except Exception as e:
            logger.error(f"Error searching menu items: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to search menu items'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MenuSortView(APIView):
    """
    API endpoint to sort menu items using QuickSort
    """
    
    def get(self, request, vendor_id):
        try:
            # Validate vendor exists
            vendor = get_object_or_404(Vendor, id=vendor_id)
            
            # Get sort parameters
            sort_by = request.query_params.get('sort_by', 'popularity')
            order = request.query_params.get('order', 'desc')
            
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
                
            # Get menu items for the vendor
            menu_items = MenuItem.objects.filter(vendor_id=vendor_id)
            
            # Convert to list of dictionaries for sorting
            items = []
            for item in menu_items:
                items.append({
                    'id': item.id,
                    'name': item.name,
                    'price': str(item.price),
                    'category': item.category,
                    'description': item.description,
                    'is_available': item.is_available,
                    'image_url': request.build_absolute_uri(item.image.url) if item.image else None,
                })
                
            # Initialize sorter
            sorter = MenuItemSorter()
            
            # Perform sorting
            reverse = (order == 'desc')
            if sort_by == 'price':
                sorted_items = sorter.sort_by_price(items, reverse=reverse)
            elif sort_by == 'name':
                sorted_items = sorter.sort_by_name(items, reverse=reverse)
            else:  # popularity
                sorted_items = sorter.sort_by_popularity(items, vendor_id, reverse=reverse)
            
            return Response({'items': sorted_items})
            
        except Exception as e:
            logger.error(f"Error sorting menu items: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to sort menu items'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )