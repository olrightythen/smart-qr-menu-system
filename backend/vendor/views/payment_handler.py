from django.utils.timezone import now
from ..models import MenuItem, Order, OrderItem, Vendor
import hmac
import hashlib
import base64


class EsewaPaymentHandler:
    SECRET_KEY = "8gBm/:&EnhH.1/q"
    PRODUCT_CODE = "EPAYTEST"

    def __init__(self, items):  # items = [{"id": menu_item_id, "quantity": x}, ...]
        self.items = items
        self.menu_items = self._get_menu_items()
        self.invoice_no = f"INV{int(now().timestamp())}"
        self.total = self._calculate_total()
        self.vendor = self._validate_single_vendor()

    def _get_menu_items(self):
        ids = [item["id"] for item in self.items]
        qs = MenuItem.objects.select_related("vendor").filter(id__in=ids, is_available=True)
        if len(qs) != len(ids):
            raise ValueError("Some items are not available or invalid")
        return {item.id: item for item in qs}

    def _calculate_total(self):
        total = 0
        for item in self.items:
            menu_item = self.menu_items[item["id"]]
            total += menu_item.price * item["quantity"]
        return total

    def _validate_single_vendor(self):
        vendors = {item.vendor.id for item in self.menu_items.values()}
        if len(vendors) > 1:
            raise ValueError("All items must belong to the same vendor")
        return next(iter(self.menu_items.values())).vendor

    def generate_signature(self):
        message = f"total_amount={self.total},transaction_uuid={self.invoice_no},product_code={self.PRODUCT_CODE}"
        signature = hmac.new(
            self.SECRET_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).digest()
        return base64.b64encode(signature).decode()

    def create_order(self):
        order = Order.objects.create(
            vendor=self.vendor,
            status="pending",
            payment_status="pending",
            payment_method="esewa"
        )
        for item in self.items:
            menu_item = self.menu_items[item["id"]]
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item["quantity"],
                price=menu_item.price
            )
        return order

    def get_response_data(self):
        self.create_order()
        return {
            "amount": self.total,
            "invoice_no": self.invoice_no,
            "signature": self.generate_signature(),
            "success_url": "http://localhost:3000/esewa-result",
            "failure_url": "http://localhost:3000/esewa-result"
        }
