"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Loader2,
  Clock,
  CheckCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import toast from "react-hot-toast";
import Tooltip from "@/components/ui/custom-tooltip";

const Cart = ({ vendorId, tableNo }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const {
    cart,
    removeFromCart,
    updateQuantity,
    cartTotal,
    createOrder,
    proceedToPayment,
    pendingOrder,
    setPendingOrder,
    isConnected,
    usingFallback,
    connectionStatus,
  } = useCart();
  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    try {
      setCheckoutLoading(true);
      const order = await createOrder();

      // Validate that the order has an ID before setting it
      if (!order || !order.id) {
        console.error("Invalid order object returned:", order);
        toast.error("Error creating order: Invalid order data");
        return;
      }

      setPendingOrder(order);
      toast.success("Order created! Waiting for restaurant approval...");
    } catch (error) {
      console.error("Order creation error:", error);
      toast.error(error.message || "Failed to create order. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!pendingOrder || !pendingOrder.id) {
      toast.error("Invalid order. Please try creating a new order.");
      console.error(
        "Attempted to proceed to payment with invalid order:",
        pendingOrder
      );
      return;
    }

    if (pendingOrder.status !== "accepted") {
      toast.error("Order must be accepted before payment");
      console.error(
        `Order ${pendingOrder.id} has status ${pendingOrder.status}, not accepted`
      );
      return;
    }

    console.log(
      `Proceeding to payment for order ${pendingOrder.id} with status ${pendingOrder.status}`
    );
    console.log("Current cart items:", cart);

    try {
      setCheckoutLoading(true);

      // Display a toast to let the user know we're processing
      toast.loading("Connecting to payment gateway...", {
        id: "payment-toast",
      });

      const paymentData = await proceedToPayment(pendingOrder.id);

      // Dismiss the loading toast
      toast.dismiss("payment-toast");

      console.log("Payment data received:", paymentData);

      // Validate payment data
      if (!paymentData || !paymentData.amount || !paymentData.invoice_no) {
        console.error("Invalid payment data received:", paymentData);
        toast.error("Invalid payment data received from server");
        return;
      }

      // Create and submit the eSewa form
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

      const fields = {
        amount: String(paymentData.amount),
        tax_amount: "0",
        total_amount: String(paymentData.amount),
        transaction_uuid: paymentData.invoice_no,
        product_code: "EPAYTEST",
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: paymentData.success_url,
        failure_url: paymentData.failure_url,
        signed_field_names: "total_amount,transaction_uuid,product_code",
        signature: paymentData.signature,
      };

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // When component mounts, just log the current pendingOrder state, no polling
  useEffect(() => {
    console.log("Cart: Current pendingOrder state:", pendingOrder);

    // No need to verify order status via API since we're using WebSockets
  }, [pendingOrder, setPendingOrder, isConnected]);

  return (
    <>
      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto">
          <SheetHeader className="flex flex-row items-center justify-between">
            <SheetTitle>Your Cart</SheetTitle>
            {/* Connection status indicator */}
            <div className="flex items-center">
              {isConnected ? (
                <Tooltip content="Real-time connection active">
                  <Wifi className="h-4 w-4 text-green-500" />
                </Tooltip>
              ) : usingFallback ? (
                <Tooltip content="Using backup connection. Updates may be delayed.">
                  <WifiOff className="h-4 w-4 text-amber-500" />
                </Tooltip>
              ) : (
                <Tooltip content="Connection issue. Trying to reconnect...">
                  <WifiOff className="h-4 w-4 text-red-500 animate-pulse" />
                </Tooltip>
              )}
            </div>
          </SheetHeader>
          <div className="mt-8">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Your cart is empty</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Add items from the menu to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border"
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 rounded-md object-cover"
                        onError={(e) => {
                          e.target.src = "/images/default-food-image.jpg";
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Rs. {item.price}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}{" "}
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex justify-between mb-4">
                    <span className="font-medium">Total</span>
                    <span className="font-medium">
                      Rs. {cartTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Show different UI based on order state */}
                  {!pendingOrder ? (
                    // No pending order - show create order button
                    <Button
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={handleCreateOrder}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating Order...
                        </>
                      ) : (
                        "Place Order"
                      )}
                    </Button>
                  ) : !pendingOrder.id ? (
                    // Invalid order state - show error and option to create new order
                    <div className="space-y-3">
                      <div className="flex items-center justify-center p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                        <span className="text-sm text-red-800 dark:text-red-200">
                          Error with order. Please try again.
                        </span>
                      </div>
                      <Button
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => {
                          setPendingOrder(null);
                          // Clear any invalid orders from localStorage
                          const trackedOrders = JSON.parse(
                            localStorage.getItem("tracked_orders") || "[]"
                          );
                          localStorage.setItem(
                            "tracked_orders",
                            JSON.stringify(
                              trackedOrders.filter((order) => order.id)
                            )
                          );
                        }}
                      >
                        Create New Order
                      </Button>
                    </div>
                  ) : pendingOrder.status === "pending" ? (
                    // Order is pending approval
                    <div className="space-y-3">
                      <div className="flex items-center justify-center p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                        <span className="text-sm text-yellow-800 dark:text-yellow-200">
                          Waiting for restaurant approval...
                        </span>
                      </div>{" "}
                      <p className="text-xs text-muted-foreground text-center">
                        Order #{pendingOrder.id || "New"} •{" "}
                        {pendingOrder.items?.length || cart.length} items{" "}
                        {isConnected && (
                          <span className="ml-2 text-green-600">
                            • Connected
                          </span>
                        )}
                      </p>
                    </div>
                  ) : String(pendingOrder.status) === "accepted" ? (
                    // Order is accepted - show payment button
                    <div className="space-y-3">
                      <div className="flex items-center justify-center p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                        <span className="text-sm text-green-800 dark:text-green-200">
                          Order approved! Ready for payment
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Order #{pendingOrder.id || "New"} •{" "}
                        {pendingOrder.items?.length || cart.length} items
                      </p>
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleProceedToPayment}
                        disabled={checkoutLoading}
                      >
                        {checkoutLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing Payment...
                          </>
                        ) : (
                          "Proceed to Payment"
                        )}
                      </Button>
                    </div>
                  ) : (
                    // Order rejected or other status
                    <div className="space-y-3">
                      <div className="flex items-center justify-center p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                        <span className="text-sm text-red-800 dark:text-red-200">
                          Order was rejected. Please modify and try again.
                        </span>
                      </div>
                      <Button
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => {
                          setPendingOrder(null);
                          // Clear the rejected order from localStorage
                          const trackedOrders = JSON.parse(
                            localStorage.getItem("tracked_orders") || "[]"
                          );
                          const filteredOrders = trackedOrders.filter(
                            (order) =>
                              !pendingOrder.id || order.id !== pendingOrder.id
                          );
                          localStorage.setItem(
                            "tracked_orders",
                            JSON.stringify(filteredOrders)
                          );
                        }}
                      >
                        Create New Order
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

// Mobile cart button for use at the bottom of the screen on mobile devices
export const MobileCartButton = ({ vendorId, tableNo }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cart, cartTotal, pendingOrder } = useCart();

  const getButtonText = () => {
    if (!pendingOrder || !pendingOrder.id) {
      return `${cart.length} items`;
    }
    if (pendingOrder.status === "pending") {
      return "Order Pending";
    }
    if (String(pendingOrder.status) === "accepted") {
      return "Pay Now";
    }
    return `${cart.length} items`;
  };

  const getButtonColor = () => {
    if (!pendingOrder || !pendingOrder.id) {
      return "bg-orange-500 hover:bg-orange-600";
    }
    if (pendingOrder.status === "pending") {
      return "bg-yellow-500 hover:bg-yellow-600";
    }
    if (String(pendingOrder.status) === "accepted") {
      return "bg-green-500 hover:bg-green-600";
    }
    return "bg-orange-500 hover:bg-orange-600";
  };

  return (
    <>
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        {" "}
        <SheetTrigger asChild>
          <Button
            className={`fixed bottom-6 right-6 z-50 h-14 px-6 rounded-full shadow-lg text-white ${getButtonColor()}`}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            <span>{getButtonText()}</span>
            {(!pendingOrder ||
              !pendingOrder.id ||
              pendingOrder.status === "accepted") && (
              <span className="ml-2 font-medium">
                Rs. {cartTotal.toFixed(2)}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Your Cart</SheetTitle>
          </SheetHeader>
          <div className="mt-8">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Your cart is empty</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Add items from the menu to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border"
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 rounded-md object-cover"
                        onError={(e) => {
                          e.target.src = "/images/default-food-image.jpg";
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Rs. {item.price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        Rs. {(item.price * item.quantity).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        x{item.quantity}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex justify-between mb-4">
                    <span className="font-medium">Total</span>
                    <span className="font-medium">
                      Rs. {cartTotal.toFixed(2)}
                    </span>
                  </div>{" "}
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => setIsCartOpen(false)}
                  >
                    View Full Cart for Order Actions
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Cart;
