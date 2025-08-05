import json
import base64
import hmac
import hashlib
from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest, HttpResponseRedirect
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from .payment_handler import EsewaPaymentHandler
from ..models import Order
from notifications.services import NotificationService
import logging

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name="dispatch")
class EsewaInitiatePaymentView(View):
    def post(self, request):
        try:
            # Log incoming request for debugging
            print("Payment initiation request received:", request.body)
            
            data = json.loads(request.body)
            order_id = data.get("order_id")
            
            # Handle existing order case
            if order_id:
                try:
                    # Try to get the existing order and create payment for it
                    order = Order.objects.get(id=order_id)
                    handler = EsewaPaymentHandler(order_id=order_id)
                    response_data = handler.get_response_data()
                    print("Payment response data:", response_data)
                    return JsonResponse(response_data)
                except Order.DoesNotExist:
                    return HttpResponseBadRequest(f"Order with ID {order_id} not found")
            
            # Handle new order creation (legacy path)
            items = data.get("items")
            vendor_id = data.get("vendor_id")
            table_identifier = data.get("table_identifier")
            
            if not items:
                return HttpResponseBadRequest("Missing items")
                
            if not vendor_id:
                return HttpResponseBadRequest("Missing vendor ID")

            handler = EsewaPaymentHandler(items=items, vendor_id=vendor_id, table_identifier=table_identifier)
            response_data = handler.get_response_data()
            # Log response for debugging
            print("Payment response data:", response_data)
            return JsonResponse(response_data)

        except ValueError as e:
            print(f"ValueError in payment view: {e}")
            return HttpResponseBadRequest(str(e))
        except Exception as e:
            print(f"Unexpected error in payment view: {e}")
            return HttpResponseBadRequest(f"Unexpected error: {str(e)}")
        
# Add to payment_view.py

@method_decorator(csrf_exempt, name="dispatch")
class EsewaPaymentVerifyView(View):
    # Use the same secret key as in payment handler
    SECRET_KEY = "8gBm/:&EnhH.1/q"
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.notification_service = NotificationService()
    
    def get(self, request):
        try:
            # eSewa is using GET method with a data parameter
            data_param = request.GET.get('data')
            
            if not data_param:
                logger.error("Missing data parameter in eSewa response")
                return HttpResponse("Missing payment data", status=400)
            
            # Decode and parse the base64 data parameter
            try:
                decoded_bytes = base64.b64decode(data_param)
                payment_data = json.loads(decoded_bytes.decode('utf-8'))
                
                # Log the decoded data for debugging
                logger.info(f"Decoded payment data: {payment_data}")
                
                # Extract necessary fields
                transaction_uuid = payment_data.get('transaction_uuid')
                status = payment_data.get('status')
                total_amount = payment_data.get('total_amount')
                transaction_code = payment_data.get('transaction_code')
                received_signature = payment_data.get('signature')
                signed_field_names = payment_data.get('signed_field_names', '')
                
                # Verify signature if it exists
                if received_signature and signed_field_names:
                    is_valid = self._verify_signature(payment_data, received_signature, signed_field_names)
                    if not is_valid:
                        logger.warning("eSewa signature verification failed")
                        return HttpResponse("Invalid signature", status=400)
                
                # Process the payment
                return self._process_payment(transaction_uuid, status, total_amount, transaction_code)
                
            except Exception as e:
                logger.error(f"Error decoding payment data: {e}")
                return HttpResponse(f"Error decoding payment data: {str(e)}", status=400)
                
        except Exception as e:
            logger.error(f"Error verifying eSewa payment (GET): {e}")
            return HttpResponse(f"Error: {str(e)}", status=500)
    
    def _verify_signature(self, payment_data, received_signature, signed_field_names):
        try:
            # Build the message string from the signed fields
            field_list = signed_field_names.split(',')
            message_parts = []
            
            for field in field_list:
                value = payment_data.get(field, '')
                message_parts.append(f"{field}={value}")
            
            message = ",".join(message_parts)
            
            # Generate signature
            signature = hmac.new(
                self.SECRET_KEY.encode('utf-8'),
                message.encode('utf-8'),
                hashlib.sha256
            ).digest()
            
            calculated_signature = base64.b64encode(signature).decode('utf-8')
            logger.info(f"Calculated signature: {calculated_signature}")
            logger.info(f"Received signature: {received_signature}")
            
            # Compare signatures
            return received_signature == calculated_signature
            
        except Exception as e:
            logger.error(f"Error verifying signature: {e}")
            return False
    
    def _process_payment(self, transaction_uuid, status, total_amount, transaction_code):
        # Find the order by invoice number
        try:
            order = Order.objects.select_related('vendor', 'table').get(invoice_no=transaction_uuid)
        except Order.DoesNotExist:
            logger.error(f"Order not found with invoice number: {transaction_uuid}")
            return HttpResponseRedirect(f'http://localhost:3000/payment-result?status=failed&reason=order-not-found&invoice_no={transaction_uuid}')
            
        # Verify the payment status
        if status != 'COMPLETE':
            if status == 'PENDING':
                order.payment_status = "pending"
                order.save()
                logger.info("Payment is pending")
                return HttpResponseRedirect(f'http://localhost:3000/payment-result?status=pending&invoice_no={transaction_uuid}')
              
            logger.warning(f"Payment failed with status: {status}")
            return HttpResponseRedirect(f'http://localhost:3000/payment-result?status=failed&invoice_no={transaction_uuid}')
            
        # Format total_amount to match order.total_amount format for comparison
        formatted_total_amount = total_amount.replace(',', '')
        
        # Verify the amount (with some tolerance for floating point issues)
        if abs(float(formatted_total_amount) - float(order.total_amount)) > 0.01:
            logger.warning(f"Amount mismatch: expected {order.total_amount}, got {formatted_total_amount}")
            return HttpResponseRedirect(f'http://localhost:3000/payment-result?status=failed&reason=amount-mismatch&invoice_no={transaction_uuid}')
            
        # Update order status and payment method
        old_status = order.status
        order.payment_status = "paid"
        order.status = "confirmed"
        order.payment_method = "esewa"  # Set payment method to esewa after successful payment
        order.transaction_id = transaction_code
        order.save()
        
        logger.info(f"Order {order.id} has been paid and verified. Payment method set to eSewa. Transaction: {transaction_code}")
        
        # Send real-time update through WebSocket
        try:
            from notifications.order_utils import send_order_update
            send_order_update(order.id)
            logger.info(f"Sent WebSocket update for order {order.id} status change: {old_status} -> confirmed")
        except Exception as e:
            logger.error(f"Failed to send WebSocket update for order {order.id}: {e}")
        
        # SEND NOTIFICATIONS AFTER SUCCESSFUL PAYMENT
        try:
            self._send_payment_notifications(order, transaction_code)
        except Exception as e:
            logger.error(f"Failed to send notifications for order {order.id}: {e}")
            # Don't fail the payment process if notifications fail
          # Redirect to payment result page with order ID
        return HttpResponseRedirect(f'http://localhost:3000/payment-result?status=success&orderId={order.id}&invoice_no={transaction_uuid}')
    
    def _send_payment_notifications(self, order, transaction_code):
        """Send notifications after successful payment"""
        notifications_sent = []
        
        # 1. Send payment success notification
        try:
            table_info = f"Table: {order.table.name}" if order.table else f"Table: {order.table_identifier or 'Unknown'}"
            message = f"Payment received for Order #{order.id} ({table_info}) - Transaction: {transaction_code or 'N/A'}"
            
            self.notification_service.create_notification(
                vendor=order.vendor,
                title="Payment Received",
                message=message,
                notification_type="payment_success",
                data={'order_id': order.id, 'transaction_code': transaction_code}
            )
            notifications_sent.append("payment_success")
            logger.info(f"Payment success notification sent for order {order.id}")
        except Exception as e:
            logger.error(f"Failed to send payment success notification for order {order.id}: {e}")
        
        # 2. Send new order received notification
        try:
            items_summary = self._get_order_items_summary(order)
            table_name = order.table.name if order.table else order.table_identifier or "Unknown Table"
            
            detailed_message = (
                f"New Order Received!\n"
                f"Order: ORD{order.id:03d}\n"
                f"Table: {table_name}\n"
                f"Items: {items_summary}\n"
                f"Total: Rs. {order.total_amount}\n"
                f"Payment: Paid via eSewa"
            )
            
            self.notification_service.create_notification(
                vendor=order.vendor,
                title="New Order Received",
                message=detailed_message,
                notification_type="new_order",
                data={'order_id': order.id, 'table_name': table_name, 'total_amount': str(order.total_amount)}
            )
            notifications_sent.append("new_order")
            logger.info(f"New order received notification sent for order {order.id}")
        except Exception as e:
            logger.error(f"Failed to send new order notification for order {order.id}: {e}")
        
        # 3. Alternative: Use the utility function
        try:
            from notifications.utils import send_order_notification
            send_order_notification(order.vendor, order, 'new_order')
            notifications_sent.append("utility_notification")
            logger.info(f"Utility new order notification sent for order {order.id}")
        except Exception as e:
            logger.error(f"Failed to send utility notification for order {order.id}: {e}")
        
        logger.info(f"Notifications sent for order {order.id}: {notifications_sent}")
        return notifications_sent
    
    def _get_order_items_summary(self, order):
        """Get a summary of order items for notification"""
        try:
            items = order.items.all().select_related('menu_item')
            if not items.exists():
                return "No items"
            
            items_list = []
            for item in items[:3]:  # Show first 3 items
                item_name = item.menu_item.name if item.menu_item else "Unknown Item"
                items_list.append(f"{item.quantity}x {item_name}")
            
            summary = ", ".join(items_list)
            
            if items.count() > 3:
                summary += f" and {items.count() - 3} more items"
            
            return summary
        except Exception as e:
            logger.error(f"Error getting items summary for order {order.id}: {e}")
            return "Items unavailable"
        
    # Keep the post method as it was
    def post(self, request):
        try:
            # Extract parameters
            transaction_uuid = request.POST.get('transaction_uuid')
            status = request.POST.get('status')
            total_amount = request.POST.get('total_amount')
            transaction_code = request.POST.get('transaction_code')
            
            return self._process_payment(transaction_uuid, status, total_amount, transaction_code)
        except Exception as e:
            logger.error(f"Error verifying eSewa payment (POST): {e}")
            return HttpResponse(f"Error: {str(e)}", status=500)