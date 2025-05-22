import json
from django.views import View
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .payment_handler import EsewaPaymentHandler  # Assuming it's in payment_handler.py


@method_decorator(csrf_exempt, name="dispatch")
class EsewaInitiatePaymentView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            items = data.get("items")  # [{"id": menu_item_id, "quantity": x}]
            if not items:
                return HttpResponseBadRequest("Missing items")

            handler = EsewaPaymentHandler(items)
            return JsonResponse(handler.get_response_data())

        except ValueError as e:
            return HttpResponseBadRequest(str(e))
        except Exception as e:
            return HttpResponseBadRequest(f"Unexpected error: {str(e)}")
