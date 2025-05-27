"""
Advanced algorithms for the Smart QR Menu System including:
- Recommendation engine (collaborative filtering)
- Binary search for menu items
- QuickSort implementation for flexible sorting
"""

from .models import MenuItem, Order, OrderItem
from django.db.models import Count, Sum, F, Q
from collections import defaultdict
import numpy as np
import logging
import math
from collections import Counter
from django.db import connection
import random
from fuzzywuzzy import fuzz

logger = logging.getLogger(__name__)

###########################################
# RECOMMENDATION ALGORITHM
###########################################

class RecommendationEngine:
    """
    Collaborative Filtering Recommendation Algorithm for menu items
    """
    def __init__(self, vendor_id):
        self.vendor_id = vendor_id
        
    def build_matrix(self):
        """Build co-occurrence matrix based on order history"""
        try:
            # Get all completed orders for this vendor
            orders = Order.objects.filter(
                vendor_id=self.vendor_id,
                status='completed'
            ).prefetch_related('items__menu_item')
            
            if not orders:
                logger.info(f"No completed orders found for vendor {self.vendor_id}")
                return False
                
            # Get all menu items for this vendor
            menu_items = MenuItem.objects.filter(vendor_id=self.vendor_id)
            
            # Create mapping of item_id to matrix index
            for idx, item in enumerate(menu_items):
                self.item_map[item.id] = idx
                self.reverse_map[idx] = item.id
                self.item_data[item.id] = {
                    'id': item.id,
                    'name': item.name,
                    'category': item.category,
                    'price': item.price,
                    'is_available': item.is_available
                }
            
            # Initialize co-occurrence matrix
            matrix_size = len(self.item_map)
            self.item_matrix = np.zeros((matrix_size, matrix_size))
            
            # Build co-occurrence matrix
            for order in orders:
                order_items = [item.menu_item.id for item in order.items.all()]
                
                # Update co-occurrence counts
                for i in range(len(order_items)):
                    for j in range(len(order_items)):
                        if i != j and order_items[i] in self.item_map and order_items[j] in self.item_map:
                            idx_i = self.item_map[orderItems[i]]
                            idx_j = self.item_map[orderItems[j]]
                            self.item_matrix[idx_i][idx_j] += 1
            
            # Apply normalization to avoid bias towards popular items
            row_sums = self.item_matrix.sum(axis=1)
            self.item_matrix = np.divide(
                self.item_matrix, 
                row_sums[:, np.newaxis], 
                out=np.zeros_like(self.item_matrix), 
                where=row_sums[:, np.newaxis] != 0
            )
            
            logger.info(f"Successfully built recommendation matrix for vendor {self.vendor_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error building recommendation matrix: {str(e)}", exc_info=True)
            return False
    
    def get_recommendations(self, cart_items, max_recommendations=5):
        """
        Implementation of item-based collaborative filtering
        
        Args:
            cart_items: List of item IDs in the user's cart
            max_recommendations: Maximum number of recommendations to return
            
        Returns:
            List of recommended menu items
        """
        if not cart_items:
            return []
            
        # Get all past orders containing any of the cart items
        with connection.cursor() as cursor:
            placeholders = ','.join(['%s'] * len(cart_items))
            cursor.execute(f"""
                SELECT DISTINCT oi.order_id
                FROM vendor_orderitem oi
                WHERE oi.menu_item_id IN ({placeholders})
                AND oi.menu_item_id IN (
                    SELECT id FROM vendor_menuitem WHERE vendor_id = %s
                )
            """, cart_items + [self.vendor_id])
            
            related_order_ids = [row[0] for row in cursor.fetchall()]
            
        if not related_order_ids:
            return self.get_popular_items(limit=max_recommendations)
        
        # Find co-occurring items in these orders (excluding items already in cart)
        with connection.cursor() as cursor:
            order_placeholders = ','.join(['%s'] * len(related_order_ids))
            cart_placeholders = ','.join(['%s'] * len(cart_items))
            
            cursor.execute(f"""
                SELECT 
                    oi.menu_item_id, 
                    COUNT(DISTINCT oi.order_id) as co_occurrence_count,
                    m.name,
                    m.price,
                    m.category,
                    m.is_available
                FROM 
                    vendor_orderitem oi
                JOIN 
                    vendor_menuitem m ON oi.menu_item_id = m.id
                WHERE 
                    oi.order_id IN ({order_placeholders})
                    AND oi.menu_item_id NOT IN ({cart_placeholders})
                    AND m.vendor_id = %s
                    AND m.is_available = TRUE
                GROUP BY 
                    oi.menu_item_id, m.name, m.price, m.category, m.is_available
                ORDER BY 
                    co_occurrence_count DESC
                LIMIT %s
            """, related_order_ids + cart_items + [self.vendor_id, max_recommendations])
            
            results = cursor.fetchall()
        
        # Calculate similarity scores using Jaccard similarity
        recommendations = []
        for row in results:
            item_id, co_occurrence, name, price, category, is_available = row
            
            # Calculate Jaccard similarity for each item
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(DISTINCT order_id)
                    FROM vendor_orderitem
                    WHERE menu_item_id = %s
                """, [item_id])
                item_order_count = cursor.fetchone()[0]
                
                # Jaccard similarity = |A ∩ B| / |A ∪ B|
                # |A ∩ B| = co_occurrence_count
                # |A ∪ B| = orders_with_cart_items + orders_with_this_item - co_occurrence_count
                intersection = co_occurrence
                union = len(related_order_ids) + item_order_count - co_occurrence
                similarity = intersection / union if union > 0 else 0
            
            recommendations.append({
                'id': item_id,
                'name': name,
                'price': str(price),
                'category': category,
                'is_available': is_available,
                'similarity_score': similarity
            })
        
        # Sort by similarity score
        recommendations.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        # Return top recommendations
        return recommendations[:max_recommendations]

    def get_popular_items(self, limit=5):
        """
        Get the most popular items for this vendor
        """
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    m.id, 
                    m.name, 
                    m.price,
                    m.category,
                    m.is_available,
                    COUNT(oi.id) as order_count
                FROM 
                    vendor_menuitem m
                LEFT JOIN 
                    vendor_orderitem oi ON m.id = oi.menu_item_id
                WHERE 
                    m.vendor_id = %s
                    AND m.is_available = TRUE
                GROUP BY 
                    m.id, m.name, m.price, m.category, m.is_available
                ORDER BY 
                    order_count DESC
                LIMIT %s
            """, [self.vendor_id, limit])
            
            results = cursor.fetchall()
            
        return [
            {
                'id': row[0],
                'name': row[1],
                'price': str(row[2]),
                'category': row[3],
                'is_available': row[4]
            }
            for row in results
        ]


###########################################
# BINARY SEARCH ALGORITHM
###########################################

class MenuItemSearch:
    """
    Binary Search implementation for menu items
    """
    def __init__(self, vendor_id):
        self.vendor_id = vendor_id
        
        # Get all menu items for this vendor and sort by id and name
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    id, name, price, category, description, is_available
                FROM 
                    vendor_menuitem
                WHERE 
                    vendor_id = %s
                ORDER BY 
                    id
            """, [vendor_id])
            
            self.items_by_id = [
                {
                    'id': row[0],
                    'name': row[1],
                    'price': str(row[2]),
                    'category': row[3],
                    'description': row[4],
                    'is_available': row[5]
                }
                for row in cursor.fetchall()
            ]
            
            # Sort another copy by name for name searching
            self.items_by_name = sorted(self.items_by_id, key=lambda x: x['name'].lower())
    
    def binary_search_by_id(self, target_id):
        """
        Binary search implementation to find item by ID
        
        Args:
            target_id: Item ID to find
            
        Returns:
            Item if found, None otherwise
        """
        left = 0
        right = len(self.items_by_id) - 1
        
        while left <= right:
            mid = (left + right) // 2
            if self.items_by_id[mid]['id'] == target_id:
                return self.items_by_id[mid]
            elif self.items_by_id[mid]['id'] < target_id:
                left = mid + 1
            else:
                right = mid - 1
                
        return None
    
    def binary_search_by_name(self, query, fuzzy=True):
        """
        Binary search with fuzzy matching to find items by name
        
        Args:
            query: Search query
            fuzzy: Whether to use fuzzy matching
            
        Returns:
            List of matching items
        """
        if not fuzzy:
            # Exact binary search
            left = 0
            right = len(self.items_by_name) - 1
            results = []
            
            # Binary search for exact matches
            while left <= right:
                mid = (left + right) // 2
                if self.items_by_name[mid]['name'].lower() == query.lower():
                    # Found an exact match at mid, now check for duplicates
                    results.append(self.items_by_name[mid])
                    
                    # Check left side for more matches
                    l = mid - 1
                    while l >= 0 and self.items_by_name[l]['name'].lower() == query.lower():
                        results.append(self.items_by_name[l])
                        l -= 1
                        
                    # Check right side for more matches
                    r = mid + 1
                    while r < len(self.items_by_name) and self.items_by_name[r]['name'].lower() == query.lower():
                        results.append(self.items_by_name[r])
                        r += 1
                        
                    return results
                    
                elif self.items_by_name[mid]['name'].lower() < query.lower():
                    left = mid + 1
                else:
                    right = mid - 1
                    
            return []
        else:
            # Fuzzy matching approach
            query_lower = query.lower()
            
            # Start with binary search to find approximate location
            left = 0
            right = len(self.items_by_name) - 1
            mid = 0
            
            # Find a close match as a starting point
            while left <= right:
                mid = (left + right) // 2
                if self.items_by_name[mid]['name'].lower() < query_lower:
                    left = mid + 1
                else:
                    right = mid - 1
            
            # Expand around the approximate location to check for fuzzy matches
            results = []
            
            # Search threshold: items must have at least 60% similarity
            threshold = 60
            
            # Check items around the located position
            # Start from mid and expand outward
            checked_ids = set()
            
            for i in range(len(self.items_by_name)):
                # Alternate checking left and right
                if i % 2 == 0:
                    idx = mid + (i // 2)
                else:
                    idx = mid - (i // 2 + 1)
                    
                if idx < 0 or idx >= len(self.items_by_name):
                    continue
                    
                item = self.items_by_name[idx]
                
                # Skip if already checked
                if item['id'] in checked_ids:
                    continue
                
                checked_ids.add(item['id'])
                
                # Check similarity
                similarity = fuzz.partial_ratio(query_lower, item['name'].lower())
                
                if similarity >= threshold:
                    # Add similarity score to the result
                    item_with_score = item.copy()
                    item_with_score['match_score'] = similarity
                    results.append(item_with_score)
                    
                # If we've checked 10 items in each direction without a match, stop
                if i > 20 and not results:
                    break
            
            # Sort results by similarity
            results.sort(key=lambda x: x['match_score'], reverse=True)
            
            # Return top 10 results
            return results[:10]


###########################################
# SORTING ALGORITHM (QUICKSORT)
###########################################

class MenuItemSorter:
    """
    QuickSort implementation for menu items
    """
    @staticmethod
    def sort_by_price(items, reverse=False):
        """
        Sort items by price using QuickSort
        
        Args:
            items: List of menu items
            reverse: Whether to sort in descending order
            
        Returns:
            Sorted list of items
        """
        if not items:
            return []
            
        # Make a copy to avoid modifying the original
        items_copy = items.copy()
        
        def quicksort(arr, low, high):
            if low < high:
                # Partition the array
                pivot_idx = partition(arr, low, high)
                
                # Sort the subarrays
                quicksort(arr, low, pivot_idx - 1)
                quicksort(arr, pivot_idx + 1, high)
                
        def partition(arr, low, high):
            # Use a random pivot for better average performance
            pivot_idx = random.randint(low, high)
            arr[pivot_idx], arr[high] = arr[high], arr[pivot_idx]
            
            pivot = float(arr[high]['price'])
            i = low - 1
            
            for j in range(low, high):
                if (float(arr[j]['price']) <= pivot and not reverse) or \
                   (float(arr[j]['price']) >= pivot and reverse):
                    i += 1
                    arr[i], arr[j] = arr[j], arr[i]
                    
            arr[i + 1], arr[high] = arr[high], arr[i + 1]
            return i + 1
            
        quicksort(items_copy, 0, len(items_copy) - 1)
        return items_copy
    
    @staticmethod
    def sort_by_name(items, reverse=False):
        """
        Sort items by name using QuickSort
        
        Args:
            items: List of menu items
            reverse: Whether to sort in descending order
            
        Returns:
            Sorted list of items
        """
        if not items:
            return []
            
        # Make a copy to avoid modifying the original
        items_copy = items.copy()
        
        def quicksort(arr, low, high):
            if low < high:
                # Partition the array
                pivot_idx = partition(arr, low, high)
                
                # Sort the subarrays
                quicksort(arr, low, pivot_idx - 1)
                quicksort(arr, pivot_idx + 1, high)
                
        def partition(arr, low, high):
            # Use a random pivot for better average performance
            pivot_idx = random.randint(low, high)
            arr[pivot_idx], arr[high] = arr[high], arr[pivot_idx]
            
            pivot = arr[high]['name'].lower()
            i = low - 1
            
            for j in range(low, high):
                if (arr[j]['name'].lower() <= pivot and not reverse) or \
                   (arr[j]['name'].lower() >= pivot and reverse):
                    i += 1
                    arr[i], arr[j] = arr[j], arr[i]
                    
            arr[i + 1], arr[high] = arr[high], arr[i + 1]
            return i + 1
            
        quicksort(items_copy, 0, len(items_copy) - 1)
        return items_copy
    
    @staticmethod
    def sort_by_popularity(items, vendor_id, reverse=False):
        """
        Sort items by popularity using QuickSort
        
        Args:
            items: List of menu items
            vendor_id: Vendor ID
            reverse: Whether to sort in descending order
            
        Returns:
            Sorted list of items
        """
        if not items:
            return []
            
        # Get popularity counts from the database
        item_ids = [item['id'] for item in items]
        
        popularity_data = {}
        with connection.cursor() as cursor:
            placeholders = ','.join(['%s'] * len(item_ids))
            cursor.execute(f"""
                SELECT 
                    menu_item_id, 
                    COUNT(id) as order_count
                FROM 
                    vendor_orderitem
                WHERE 
                    menu_item_id IN ({placeholders})
                GROUP BY 
                    menu_item_id
            """, item_ids)
            
            for row in cursor.fetchall():
                popularity_data[row[0]] = row[1]
        
        # Assign popularity counts to items (defaulting to 0 if not ordered)
        items_with_popularity = []
        for item in items:
            item_copy = item.copy()
            item_copy['popularity'] = popularity_data.get(item['id'], 0)
            items_with_popularity.append(item_copy)
            
        # Make a copy to avoid modifying the original
        items_copy = items_with_popularity.copy()
        
        def quicksort(arr, low, high):
            if low < high:
                # Partition the array
                pivot_idx = partition(arr, low, high)
                
                # Sort the subarrays
                quicksort(arr, low, pivot_idx - 1)
                quicksort(arr, pivot_idx + 1, high)
                
        def partition(arr, low, high):
            # Use a random pivot for better average performance
            pivot_idx = random.randint(low, high)
            arr[pivot_idx], arr[high] = arr[high], arr[pivot_idx]
            
            pivot = arr[high]['popularity']
            i = low - 1
            
            for j in range(low, high):
                if (arr[j]['popularity'] <= pivot and not reverse) or \
                   (arr[j]['popularity'] >= pivot and reverse):
                    i += 1
                    arr[i], arr[j] = arr[j], arr[i]
                    
            arr[i + 1], arr[high] = arr[high], arr[i + 1]
            return i + 1
            
        quicksort(items_copy, 0, len(items_copy) - 1)
        
        # Remove the popularity field from the result
        for item in items_copy:
            item.pop('popularity', None)
            
        return items_copy