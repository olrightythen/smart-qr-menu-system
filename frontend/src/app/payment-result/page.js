"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ArrowLeft, Clock, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function PaymentResult() {
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [tableInfo, setTableInfo] = useState(null);

  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "failed";
  const orderId = searchParams.get("order_id");
  const invoiceNo = searchParams.get("invoice_no");
  const reason = searchParams.get("reason");

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);

        let orderUrl;
        if (orderId) {
          orderUrl = `http://localhost:8000/api/order/${orderId}/`;
        } else if (invoiceNo) {
          orderUrl = `http://localhost:8000/api/order/?invoice_no=${invoiceNo}`;
        } else {
          throw new Error("No order identifier provided");
        }

        const orderResponse = await fetch(orderUrl);

        if (!orderResponse.ok) {
          throw new Error(`Failed to fetch order: ${orderResponse.status}`);
        }

        const orderData = await orderResponse.json();
        setOrderDetails(orderData);

        // Fetch table information if available
        if (orderData.table_identifier && orderData.vendor_id) { // Changed from table_no
          try {
            const tableUrl = `http://localhost:8000/api/public-table/${orderData.vendor_id}/${orderData.table_identifier}/`; // Changed from table_no
            const tableResponse = await fetch(tableUrl);

            if (tableResponse.ok) {
              const tableData = await tableResponse.json();
              setTableInfo({
                qr_code: tableData.qr_code,
                name: tableData.name,
                is_active: tableData.is_active
              });
            } else {
              // Fallback to using table_identifier as identifier
              setTableInfo({
                qr_code: orderData.table_identifier, // Changed from table_no
                name: orderData.table_identifier, // Changed from table_no
                is_active: true
              });
            }
          } catch (tableError) {
            // Fallback to using table_identifier as identifier
            setTableInfo({
              qr_code: orderData.table_identifier, // Changed from table_no
              name: orderData.table_identifier, // Changed from table_no
              is_active: true
            });
          }
        }

      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, invoiceNo]);

  // Countdown timer for successful payments
  useEffect(() => {
    if (status === "success" && countdown > 0 && !loading) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, status, loading]);

  // Auto-redirect after countdown
  useEffect(() => {
    if (status === "success" && countdown === 0 && !loading && orderDetails) {
      const vendorId = orderDetails.vendor_id || orderDetails.vendor?.id;
      const tableIdentifier = tableInfo?.qr_code || orderDetails.table_no;
      
      if (vendorId && tableIdentifier) {
        const menuUrl = `/menu/${vendorId}/${encodeURIComponent(tableIdentifier)}`;
        window.location.href = menuUrl;
      } else {
        window.location.href = '/';
      }
    }
  }, [countdown, status, loading, orderDetails, tableInfo]);

  // Helper function to construct return URL
  const getReturnUrl = () => {
    if (!orderDetails) return '/';
    
    const vendorId = orderDetails.vendor_id || orderDetails.vendor?.id;
    const tableIdentifier = tableInfo?.qr_code || orderDetails.table_no;
    
    if (vendorId && tableIdentifier) {
      return `/menu/${vendorId}/${encodeURIComponent(tableIdentifier)}`;
    }
    
    return '/';
  };

  // Download receipt function
  const downloadReceipt = () => {
    const receiptContent = `
      ORDER RECEIPT
      =============
      
      Order ID: #${orderDetails.order_id || orderDetails.id}
      ${orderDetails.invoice_no ? `Invoice: ${orderDetails.invoice_no}` : ''}
      Date: ${new Date(orderDetails.timestamp || orderDetails.created_at).toLocaleString()}
      ${tableInfo?.name ? `Table: ${tableInfo.name}` : ''}
      Status: ${orderDetails.status || 'Pending'}
      
      ITEMS:
      ------
      ${orderDetails.items?.map(item => 
        `${item.quantity}x ${item.name} - Rs. ${(parseFloat(item.price) * item.quantity).toFixed(2)}`
      ).join('\n') || 'No items'}
      
      TOTAL: Rs. ${parseFloat(orderDetails.total_amount || 0).toFixed(2)}
      
      ${orderDetails.transaction_id ? `Transaction ID: ${orderDetails.transaction_id}` : ''}
      
      Restaurant: ${orderDetails.vendor?.name || orderDetails.vendor?.restaurant_name || 'N/A'}
      ${orderDetails.vendor?.phone ? `Phone: ${orderDetails.vendor.phone}` : ''}
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${orderDetails.order_id || orderDetails.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Receipt downloaded successfully");
  };

  // Share receipt function
  const shareReceipt = async () => {
    const shareData = {
      title: 'Order Receipt',
      text: `Order #${orderDetails.order_id || orderDetails.id} - Rs. ${parseFloat(orderDetails.total_amount || 0).toFixed(2)}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success("Receipt shared successfully");
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Fallback to clipboard
          copyToClipboard();
        }
      }
    } else {
      // Fallback to clipboard
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    const receiptText = `Order #${orderDetails.order_id || orderDetails.id} - Rs. ${parseFloat(orderDetails.total_amount || 0).toFixed(2)} - ${window.location.href}`;
    navigator.clipboard.writeText(receiptText).then(() => {
      toast.success("Receipt details copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy receipt details");
    });
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

  const formattedDate = new Date(orderDetails.timestamp || orderDetails.created_at).toLocaleString();
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
            {status === "success" ? (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h1 className="text-3xl font-bold text-green-500 mb-3">
                  Payment Successful!
                </h1>
                <p className="text-muted-foreground text-lg">
                  Your order has been confirmed and will be ready soon.
                </p>
                
                {tableInfo && !tableInfo.is_active && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ Note: The table is currently unavailable, but your order has been placed successfully.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-12 h-12 text-red-500" />
                </div>
                <h1 className="text-3xl font-bold text-red-500 mb-3">
                  Payment Failed
                </h1>
                <p className="text-muted-foreground text-lg">
                  {reason === "order-not-found"
                    ? "We couldn't find your order in our system."
                    : reason === "amount-mismatch"
                    ? "The payment amount doesn't match your order total."
                    : reason === "payment-verification-failed"
                    ? "Payment verification failed. Please contact support if amount was deducted."
                    : "There was an issue processing your payment. Please try again."}
                </p>
              </>
            )}
          </div>

          {/* Order Summary */}
          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-medium">#{orderDetails.order_id || orderDetails.id}</span>
                </div>
                {orderDetails.invoice_no && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice</span>
                    <span className="font-medium">{orderDetails.invoice_no}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span className="font-medium">{formattedDate}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {tableInfo && tableInfo.name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table</span>
                    <span className="font-medium">{tableInfo.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-medium capitalize px-2 py-1 rounded-full text-xs ${
                    orderDetails.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    orderDetails.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    orderDetails.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                    orderDetails.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {orderDetails.status || 'Pending'}
                  </span>
                </div>
                {orderDetails.transaction_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID</span>
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
              {orderDetails.items?.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                  </div>
                  <span className="font-medium">Rs. {(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                </div>
              )) || <p className="text-muted-foreground italic">No items found</p>}
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total Amount</span>
                <span className="text-primary">Rs. {parseFloat(orderDetails.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Restaurant Info */}
          {orderDetails.vendor && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Restaurant Details</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{orderDetails.vendor.name || orderDetails.vendor.restaurant_name}</p>
                {orderDetails.vendor.phone && (
                  <p className="text-muted-foreground">{orderDetails.vendor.phone}</p>
                )}
                {orderDetails.vendor.location && (
                  <p className="text-muted-foreground">{orderDetails.vendor.location}</p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4 pt-4">
            <div className="flex gap-3">
              <Button
                asChild
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
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

            {status === "success" && countdown > 0 && (
              <div className="flex items-center justify-center text-sm text-muted-foreground bg-muted/50 rounded-lg py-3">
                <Clock className="w-4 h-4 mr-2" />
                Redirecting automatically in {countdown} seconds...
              </div>
            )}

            {status === "failed" && (
              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <Link href={returnUrl}>Try Ordering Again</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
