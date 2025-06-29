# Update payment_handler.py

from django.utils.timezone import now
from ..models import MenuItem, Order, OrderItem, Vendor
import hmac
import hashlib
import base64


class EsewaPaymentHandler:
    SECRET_KEY = "8gBm/:&EnhH.1/q"
    PRODUCT_CODE = "EPAYTEST"

    def __init__(self, order_id=None, items=None, vendor_id=None, table_identifier=None):
        # Support both existing order and new order creation
        if order_id:
            # Working with existing order
            self.order = Order.objects.select_related('vendor').get(id=order_id)
            self.items = self._get_order_items()
            self.total = float(self.order.total_amount)
            self.invoice_no = self.order.invoice_no
            self.vendor_id = self.order.vendor.id
            self.table_identifier = self.order.table_identifier
            self.vendor = self.order.vendor
        else:
            # Creating new order (legacy support)
            self.order = None
            self.items = items or []
            self.menu_items = self._get_menu_items()
            self.invoice_no = f"INV{int(now().timestamp())}"
            self.total = self._calculate_total()
            self.vendor_id = vendor_id
            self.table_identifier = table_identifier
            self.vendor = self._validate_vendor()

    def _get_order_items(self):
        """Get items from existing order"""
        order_items = self.order.items.all().select_related('menu_item')
        return [
            {
                'id': item.menu_item.id,
                'quantity': item.quantity,
                'price': float(item.price)
            }
            for item in order_items
        ]

    def _get_menu_items(self):
        item_ids = [item["id"] for item in self.items]
        qs = MenuItem.objects.select_related("vendor").filter(id__in=item_ids, is_available=True)
        
        # Check if all requested items were found
        found_ids = set(item.id for item in qs)
        requested_ids = set(item_ids)
        missing_ids = requested_ids - found_ids
        
        if missing_ids:
            raise ValueError(f"Items with IDs {missing_ids} are not available or invalid")
            
        return {item.id: item for item in qs}

    def _calculate_total(self):
        total = 0
        for item in self.items:
            menu_item = self.menu_items[item["id"]]
            total += float(menu_item.price) * item["quantity"]
        return total

    def _validate_vendor(self):
        # If vendor_id is provided, make sure all items belong to that vendor
        vendors = {item.vendor.id for item in self.menu_items.values()}
        
        if len(vendors) > 1:
            raise ValueError("All items must belong to the same vendor")
            
        if self.vendor_id and int(self.vendor_id) not in vendors:
            raise ValueError("Items do not belong to the specified vendor")
            
        return next(iter(self.menu_items.values())).vendor

    def generate_signature(self):
        # eSewa requires a specific format for the signature
        total_amount_str = str(self.total)
        message = f"total_amount={total_amount_str},transaction_uuid={self.invoice_no},product_code={self.PRODUCT_CODE}"
        
        # Debug logging
        print(f"Signature message: {message}")
        print(f"Secret key: {self.SECRET_KEY}")
        
        signature = hmac.new(
            self.SECRET_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).digest()
        
        signature_b64 = base64.b64encode(signature).decode()
        print(f"Generated signature: {signature_b64}")
        
        return signature_b64

    def create_order(self):
        # Only create if we don't have an existing order
        if self.order:
            return self.order
            
        order = Order.objects.create(
            vendor=self.vendor,
            status="pending",  # Start as pending, not awaiting payment
            payment_status="pending",
            payment_method="esewa",
            table_identifier=self.table_identifier,
            invoice_no=self.invoice_no,
            total_amount=self.total
        )
        
        for item_data in self.items:
            item_id = item_data["id"]
            quantity = item_data["quantity"]
            menu_item = self.menu_items[item_id]
            
            # Create order item
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=quantity,
                price=menu_item.price
            )
            
        return order
        
    def get_response_data(self):
        order = self.create_order()
        
        # Ensure WebSocket notification is sent for current order status
        try:
            from notifications.order_utils import send_order_update
            # Important: Force a refresh to ensure we're getting the most recent data
            order.refresh_from_db()
            
            # Send the notification - first attempt
            result = send_order_update(order.id)
            print(f"Sent WebSocket update for order {order.id} status: {order.status}, result: {result}")
            
            # If the first attempt didn't succeed, try once more after a short delay
            if not result:
                import time
                time.sleep(0.5)  # 500ms delay
                print(f"Retrying WebSocket update for order {order.id}")
                result = send_order_update(order.id)
                print(f"Retry result: {result}")
        except Exception as e:
            print(f"Failed to send WebSocket update for order {order.id}: {e}")
            import traceback
            traceback.print_exc()
        
        # Make sure amount is properly formatted as a string
        total_amount_str = str(self.total)
        
        # Generate tracking URL for order
        tracking_url = f"http://localhost:3000/order-tracking?orderId={order.id}"
        
        return {
            "amount": total_amount_str,
            "invoice_no": self.invoice_no,
            "order_id": order.id,
            "tracking_url": tracking_url,
            "signature": self.generate_signature(),
            "success_url": f"http://localhost:8000/api/verify-payment/",
            "failure_url": f"http://localhost:8000/api/verify-payment"
        }