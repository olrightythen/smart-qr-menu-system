"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  Clock,
  Download,
  Share2,
  Receipt,
  Home,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { getApiBaseUrl } from "@/hooks/useWebSocket";

export default function PaymentResult() {
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [menuUrl, setMenuUrl] = useState("/menu");

  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "failed";
  const orderId = searchParams.get("orderId") || searchParams.get("order_id");
  const invoiceNo = searchParams.get("invoice_no");
  const reason = searchParams.get("reason");

  // Status messages mapping
  const statusMessages = {
    success: {
      title: "Payment Successful!",
      description: "Your order has been confirmed and will be ready soon.",
      icon: CheckCircle,
      color: "green",
    },
    failed: {
      title: "Payment Failed",
      description: getFailureMessage(reason),
      icon: XCircle,
      color: "red",
    },
  };

  function getFailureMessage(reason) {
    const messages = {
      "order-not-found": "We couldn't find your order in our system.",
      "amount-mismatch": "The payment amount doesn't match your order total.",
      "payment-verification-failed":
        "Payment verification failed. Please contact support if amount was deducted.",
    };
    return (
      messages[reason] ||
      "There was an issue processing your payment. Please try again."
    );
  }

  // Fetch order details when component mounts
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        // Get menu URL from localStorage
        const lastMenuUrl = localStorage.getItem("last_menu_url");
        if (lastMenuUrl) {
          setMenuUrl(lastMenuUrl);
        }

        if (orderId) {
          // Fetch order details by order ID
          const apiBaseUrl = getApiBaseUrl();
          const response = await fetch(
            `${apiBaseUrl}/api/orders/${orderId}/status/`
          );

          if (response.ok) {
            const data = await response.json();
            setOrderDetails({
              ...data,
              order_id: data.id,
              vendor: {
                id: data.vendor_id,
                name: "Restaurant", // Default name, will be updated if available
              },
              qr_code: data.table_identifier,
              table_name: data.table_name || `Table ${data.table_identifier}`,
            });

            // Update menu URL if vendor info is available
            if (data.vendor_id && data.table_identifier) {
              const newMenuUrl = `/menu/${data.vendor_id}/${encodeURIComponent(
                data.table_identifier
              )}`;
              setMenuUrl(newMenuUrl);
              localStorage.setItem("last_menu_url", newMenuUrl);
            }
          } else {
            setError("Failed to fetch order details");
          }
        } else if (invoiceNo) {
          // Fetch order details by invoice number
          const apiBaseUrl = getApiBaseUrl();
          const response = await fetch(
            `${apiBaseUrl}/api/order/?invoice_no=${invoiceNo}`
          );

          if (response.ok) {
            const data = await response.json();
            setOrderDetails({
              ...data,
              vendor: {
                id: data.vendor_id,
                name: data.vendor_name || "Restaurant",
              },
              qr_code: data.table_identifier,
              table_name: data.table_name || `Table ${data.table_identifier}`,
            });

            // Update menu URL if vendor info is available
            if (data.vendor_id && data.table_identifier) {
              const newMenuUrl = `/menu/${data.vendor_id}/${encodeURIComponent(
                data.table_identifier
              )}`;
              setMenuUrl(newMenuUrl);
              localStorage.setItem("last_menu_url", newMenuUrl);
            }
          } else {
            setError("Failed to fetch order details");
          }
        }
      } catch (err) {
        console.error("Error fetching order details:", err);
        setError("Failed to load order information");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, invoiceNo]);

  // Countdown timer for successful payments
  useEffect(() => {
    if (status === "success" && countdown > 0 && !loading) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, status, loading]);

  // Auto-redirect logic
  useEffect(() => {
    if (!loading && orderDetails && orderDetails.vendor) {
      const redirectDelay = status === "success" ? countdown * 1000 : 3000;

      if ((status === "success" && countdown === 0) || status === "failed") {
        const timer = setTimeout(
          () => {
            const vendorId = orderDetails.vendor.id;
            const tableIdentifier =
              orderDetails.qr_code || orderDetails.table_name;

            // Clear cart only on successful payment
            if (status === "success") {
              localStorage.setItem(
                `clear_cart_${vendorId}_${tableIdentifier}`,
                "true"
              );

              // Store the order info in localStorage for tracking
              const orderInfo = {
                id: orderDetails.order_id || orderDetails.id,
                invoice: orderDetails.invoice_no,
                status: orderDetails.status,
                timestamp: orderDetails.timestamp,
                stored_at: new Date().toISOString(),
              };

              // Get existing orders from localStorage
              const existingOrdersJSON = localStorage.getItem("tracked_orders");
              let existingOrders = existingOrdersJSON
                ? JSON.parse(existingOrdersJSON)
                : [];

              // Add this order if it doesn't exist
              if (
                !existingOrders.some(
                  (order) =>
                    order.id === (orderDetails.order_id || orderDetails.id)
                )
              ) {
                // Limit to 5 most recent orders
                existingOrders = [orderInfo, ...existingOrders.slice(0, 4)];
                localStorage.setItem(
                  "tracked_orders",
                  JSON.stringify(existingOrders)
                );
              }

              // Store the menu URL for order tracking page
              const menuUrl = `/menu/${vendorId}/${encodeURIComponent(
                tableIdentifier
              )}`;
              localStorage.setItem("last_menu_url", menuUrl);
            }

            const menuUrl = `/menu/${vendorId}/${encodeURIComponent(
              tableIdentifier
            )}`;
            window.location.href = menuUrl;
          },
          status === "failed" ? 3000 : 0
        );

        return () => clearTimeout(timer);
      }
    }
  }, [countdown, status, loading, orderDetails]);

  // Helper functions
  const getReturnUrl = () => {
    if (!orderDetails || !orderDetails.vendor) return "/";
    const vendorId = orderDetails.vendor.id;
    const tableIdentifier = orderDetails.qr_code || orderDetails.table_name;
    return `/menu/${vendorId}/${encodeURIComponent(tableIdentifier)}`;
  };

  const handleManualReturn = () => {
    if (status === "success" && orderDetails && orderDetails.vendor) {
      const vendorId = orderDetails.vendor.id;
      const tableIdentifier = orderDetails.qr_code || orderDetails.table_name;
      localStorage.setItem(`clear_cart_${vendorId}_${tableIdentifier}`, "true");

      // Store the order info in localStorage for tracking
      const orderInfo = {
        id: orderDetails.order_id || orderDetails.id,
        invoice: orderDetails.invoice_no,
        status: orderDetails.status,
        timestamp: orderDetails.timestamp,
        stored_at: new Date().toISOString(),
      };

      // Get existing orders from localStorage
      const existingOrdersJSON = localStorage.getItem("tracked_orders");
      let existingOrders = existingOrdersJSON
        ? JSON.parse(existingOrdersJSON)
        : [];

      // Add this order if it doesn't exist
      if (!existingOrders.some((order) => order.id === orderDetails.order_id)) {
        // Limit to 5 most recent orders
        existingOrders = [orderInfo, ...existingOrders.slice(0, 4)];
        localStorage.setItem("tracked_orders", JSON.stringify(existingOrders));
      }

      // Store the menu URL for order tracking page
      const menuUrl = getReturnUrl();
      localStorage.setItem("last_menu_url", menuUrl);
    }
  };

  const downloadReceipt = () => {
    if (!orderDetails) return;

    const receiptContent = `
ORDER RECEIPT
=============

Order ID: #${orderDetails.order_id || orderDetails.id || "N/A"}
${orderDetails.invoice_no ? `Invoice: ${orderDetails.invoice_no}` : ""}
Date: ${
      orderDetails.timestamp
        ? new Date(orderDetails.timestamp).toLocaleString()
        : "N/A"
    }
Table: ${orderDetails.table_name || "N/A"}
Status: ${orderDetails.status || "N/A"}

ITEMS:
------
${
  orderDetails.items && orderDetails.items.length > 0
    ? orderDetails.items
        .map(
          (item) =>
            `${item.quantity || 0}x ${item.name || "Unknown"} - Rs. ${(
              (item.price || 0) * (item.quantity || 0)
            ).toFixed(2)}`
        )
        .join("\n")
    : "No items found"
}

TOTAL: Rs. ${orderDetails.total_amount || "0.00"}

${
  orderDetails.transaction_id
    ? `Transaction ID: ${orderDetails.transaction_id}`
    : ""
}

Restaurant: ${orderDetails.vendor?.name || "N/A"}
${orderDetails.vendor?.phone ? `Phone: ${orderDetails.vendor.phone}` : ""}
    `;

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${
      orderDetails.order_id || orderDetails.id || "order"
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded successfully");
  };

  const shareReceipt = async () => {
    if (!orderDetails) return;

    const shareData = {
      title: "Order Receipt",
      text: `Order #${
        orderDetails.order_id || orderDetails.id || "N/A"
      } - Rs. ${orderDetails.total_amount || "0.00"}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Receipt shared successfully");
      } else {
        await navigator.clipboard.writeText(
          `${shareData.text} - ${shareData.url}`
        );
        toast.success("Receipt details copied to clipboard");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error("Failed to share receipt");
      }
    }
  };

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

  const currentStatus = statusMessages[status];
  const StatusIcon = currentStatus.icon;
  const returnUrl = getReturnUrl();

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link
          href={returnUrl}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Return to Menu
        </Link>

        <div className="bg-card rounded-xl border border-border shadow-lg p-6 md:p-8 space-y-6">
          {/* Status Header */}
          <div className="text-center">
            <div
              className={`w-20 h-20 bg-${currentStatus.color}-100 dark:bg-${currentStatus.color}-900/30 rounded-full flex items-center justify-center mx-auto mb-6`}
            >
              <StatusIcon
                className={`w-12 h-12 text-${currentStatus.color}-500`}
              />
            </div>
            <h1
              className={`text-3xl font-bold text-${currentStatus.color}-500 mb-3`}
            >
              {currentStatus.title}
            </h1>
            <p className="text-muted-foreground text-lg">
              {currentStatus.description}
            </p>
          </div>

          {/* Order Summary */}
          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-medium">#{orderDetails.order_id}</span>
                </div>
                {orderDetails.invoice_no && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice</span>
                    <span className="font-medium">
                      {orderDetails.invoice_no}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span className="font-medium">
                    {orderDetails?.timestamp
                      ? new Date(orderDetails.timestamp).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Table</span>
                  <span className="font-medium">
                    {orderDetails?.table_name || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {orderDetails?.status || "pending"}
                  </span>
                </div>
                {orderDetails?.transaction_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Transaction ID
                    </span>
                    <span className="font-medium text-xs break-all">
                      {orderDetails.transaction_id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Ordered Items</h3>
            <div className="space-y-3">
              {orderDetails?.items && orderDetails.items.length > 0 ? (
                orderDetails.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-border last:border-b-0"
                  >
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ×{item.quantity}
                      </span>{" "}
                    </div>
                    <span className="font-medium">
                      Rs. {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No items found for this order
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total Amount</span>
                <span className="text-primary">
                  Rs. {orderDetails?.total_amount || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Restaurant Info */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Restaurant Details</h3>
            <div className="text-sm space-y-1">
              <p className="font-medium">{orderDetails.vendor.name}</p>
              {orderDetails.vendor.phone && (
                <p className="text-muted-foreground">
                  {orderDetails.vendor.phone}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4 pt-4">
            <div className="flex gap-3">
              <Button
                asChild
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleManualReturn}
              >
                <Link href={returnUrl}>Return to Menu</Link>
              </Button>

              {status === "success" && (
                <>
                  <Button
                    onClick={downloadReceipt}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Download Receipt"
                  >
                    <Download className="w-4 h-4" />
                  </Button>

                  <Button
                    onClick={shareReceipt}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Share Receipt"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Track Order Button for successful payments */}
            {status === "success" && orderDetails && (
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => {
                  // Store order ID in localStorage for order tracking
                  localStorage.setItem(
                    "current_order_id",
                    (orderDetails.order_id || orderDetails.id).toString()
                  );
                  window.location.href = "/order-tracking";
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Track Your Order
              </Button>
            )}

            {status === "success" && countdown > 0 && (
              <div className="flex items-center justify-center text-sm text-muted-foreground bg-muted/50 rounded-lg py-3">
                <Clock className="w-4 h-4 mr-2" />
                Redirecting automatically in {countdown} seconds...
              </div>
            )}

            {status === "failed" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center text-sm text-muted-foreground bg-red-50 dark:bg-red-900/20 rounded-lg py-3">
                  <Clock className="w-4 h-4 mr-2" />
                  Redirecting in 3 seconds... Your cart is preserved.
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={returnUrl}>Try Ordering Again</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
