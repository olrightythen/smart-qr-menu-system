# Update payment_handler.py

from django.utils.timezone import now
from ..models import MenuItem, Order, OrderItem, Vendor
import hmac
import hashlib
import base64


class EsewaPaymentHandler:
    SECRET_KEY = "8gBm/:&EnhH.1/q"
    PRODUCT_CODE = "EPAYTEST"

    def __init__(self, items, vendor_id=None, table_no=None):  
        # items = [{"id": menu_item_id, "quantity": x}, ...]
        self.items = items
        self.menu_items = self._get_menu_items()
        self.invoice_no = f"INV{int(now().timestamp())}"
        self.total = self._calculate_total()
        self.vendor_id = vendor_id
        self.table_no = table_no
        self.vendor = self._validate_vendor()

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
        order = Order.objects.create(
            vendor=self.vendor,
            status="pending",
            payment_status="pending",
            payment_method="esewa",
            table_no=self.table_no,
            invoice_no=self.invoice_no,
            total_amount=self.total
        )
        
        for item_data in self.items:
            item_id = item_data["id"]
            quantity = item_data["quantity"]
            menu_item = self.menu_items[item_id]
            
            # Remove the name field from creation
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=quantity,
                price=menu_item.price
            )
            
        return order

    def get_response_data(self):
        order = self.create_order()
        
        # Make sure amount is properly formatted as a string
        total_amount_str = str(self.total)
        
        return {
            "amount": total_amount_str,
            "invoice_no": self.invoice_no,
            "order_id": order.id,
            "signature": self.generate_signature(),
            "success_url": f"http://localhost:8000/api/verify-payment/",  # Changed to backend URL
            "failure_url": f"http://localhost:8000/api/verify-payment"   # Changed to backend URL
        }