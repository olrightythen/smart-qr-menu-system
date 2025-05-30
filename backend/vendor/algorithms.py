"""
Advanced algorithms for the Smart QR Menu System focusing on recommendations
while using database native capabilities for search and sort
"""

from .models import MenuItem
import logging
from django.db import connection

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
    
    def get_recommendations(self, cart_items, max_recommendations=5):
        """
        Optimized implementation of item-based collaborative filtering
        
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
                    AND m.is_available = 1
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
                    AND m.is_available = 1
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