"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentResult() {
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);

  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "failed";
  const orderId = searchParams.get("order_id");
  const invoiceNo = searchParams.get("invoice_no");
  const reason = searchParams.get("reason");

  useEffect(() => {
    // Function to fetch order details
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);

        // Determine which param to use for the API call
        let url;
        if (orderId) {
          url = `http://localhost:8000/api/order/${orderId}/`;
        } else if (invoiceNo) {
          url = `http://localhost:8000/api/order/?invoice_no=${invoiceNo}`;
        } else {
          throw new Error("No order identifier provided");
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch order: ${response.status}`);
        }

        const data = await response.json();
        setOrderDetails(data);
      } catch (error) {
        console.error("Error fetching order details:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, invoiceNo]);

  // Countdown effect for redirection
  useEffect(() => {
    if (status === "success" && countdown > 0 && !loading) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }

    // Redirect after countdown completes
    if (status === "success" && countdown === 0 && orderDetails) {
      // Redirect to the menu of the vendor
      window.location.href = `/menu/${orderDetails.vendor.id}/${orderDetails.table_no}`;
    }
  }, [countdown, status, loading, orderDetails]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !orderDetails) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-card rounded-xl border border-border p-6 md:p-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-500 mb-2">
              Error Loading Order Details
            </h1>
            <p className="text-muted-foreground">
              {error || "Could not load order information"}
            </p>
            <Button asChild className="mt-4">
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Format date
  const formattedDate = new Date(orderDetails.timestamp).toLocaleString();

  // Determine where to return (to the same vendor's menu)
  const returnUrl = `/menu/${orderDetails.vendor.id}/${
    orderDetails.table_no || ""
  }`;

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link
          href={returnUrl}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Return to Menu
        </Link>

        <div className="bg-card rounded-xl border border-border p-6 md:p-8 space-y-6">
          {/* Status Header */}
          <div className="text-center">
            {status === "success" ? (
              <>
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h1 className="text-2xl font-bold text-green-500 mb-2">
                  Payment Successful!
                </h1>
                <p className="text-muted-foreground">
                  Your order has been confirmed and will be ready soon.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-red-500 mb-2">
                  Payment Failed
                </h1>
                <p className="text-muted-foreground">
                  {reason === "order-not-found"
                    ? "We couldn't find your order in our system."
                    : reason === "amount-mismatch"
                    ? "The payment amount doesn't match your order total."
                    : "There was an issue processing your payment. Please try again."}
                </p>
              </>
            )}
          </div>

          {/* Order Details */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-medium">#{orderDetails.order_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice Number</span>
              <span className="font-medium">{orderDetails.invoice_no}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            {orderDetails.table_no && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Table Number</span>
                <span className="font-medium">{orderDetails.table_no}</span>
              </div>
            )}

            <hr className="border-border" />

            <div className="space-y-2">
              {orderDetails.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <hr className="border-border" />

            <div className="flex justify-between font-medium">
              <span>Total Amount</span>
              <span>₹{orderDetails.total_amount.toFixed(2)}</span>
            </div>

            {orderDetails.transaction_id && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-medium">
                  {orderDetails.transaction_id}
                </span>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-medium">Restaurant Details</h3>
              <div className="text-sm space-y-1">
                <p>{orderDetails.vendor.name}</p>
                <p>{orderDetails.vendor.phone}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <Button
              asChild
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link href={returnUrl}>Return to Menu</Link>
            </Button>

            {status === "success" && (
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                <Clock className="w-4 h-4 mr-2" />
                Redirecting in {countdown} seconds...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
