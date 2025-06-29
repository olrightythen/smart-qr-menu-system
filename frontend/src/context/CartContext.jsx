"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import toast from "react-hot-toast";
import { useOrderWebSocket } from "@/hooks/useOrderWebSocket";
import { getApiBaseUrl } from "@/hooks/useWebSocket";

// Create the context with default values
export const CartContext = createContext({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  recentlyAdded: {},
  clearCart: () => {},
  cartTotal: 0,
  createOrder: async () => {},
  proceedToPayment: async () => {},
  pendingOrder: null,
  setPendingOrder: () => {},
});

// Create the provider component
export const CartProvider = ({
  children,
  vendorId,
  tableNo,
  onUpdateRecommendations,
}) => {
  const [cart, setCart] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState({});
  const [pendingOrder, setPendingOrder] = useState(null);
  const timeoutRefs = useRef({});
  const initialLoadCompleted = useRef(false);
  const previousCartJSON = useRef("");

  // Prevent excessive recommendation updates with debounce
  const recommendationsTimeoutRef = useRef(null);
  const pendingCartItemsRef = useRef(null);

  // Define clearCart first so it can be used in handleOrderUpdate
  const clearCart = useCallback(() => {
    setCart([]);
    pendingCartItemsRef.current = null;
  }, []);

  // Function to handle WebSocket order updates
  const handleOrderUpdate = useCallback(
    ({ order_id, status, order_data }) => {
      console.log(
        `CartContext: Received WebSocket update for order ${order_id}, status: ${status}`,
        order_data
      );

      // Update pendingOrder if it matches our current order
      if (pendingOrder && pendingOrder.id === parseInt(order_id)) {
        console.log(
          `CartContext: Updating pendingOrder with new status: ${status}`,
          order_data
        );

        // Create complete updated order object with all data
        const updatedOrder = {
          ...pendingOrder,
          status: status,
          // Include any additional data from the WebSocket message
          ...(order_data || {}),
        };

        console.log("CartContext: Updated order object:", updatedOrder);

        // Update state
        setPendingOrder(updatedOrder);

        // Clean up table booking info when order is completed/cancelled/rejected
        if (["completed", "cancelled", "rejected"].includes(status)) {
          console.log("Order finished, cleaning up table booking info");
          localStorage.removeItem("last_order_table");
          localStorage.removeItem("last_order_vendor");
          localStorage.removeItem("current_order_id");
        }

        // Generate a unique toast ID for this status update
        const toastKey = `order-${order_id}-${status}`;
        const toastId = `${toastKey}-context-${Date.now()}`;

        // Check if we've shown this exact status update before (in the last 30 seconds)
        // Increased from 5 to 30 seconds to prevent duplicate toasts across page navigations
        const lastShown = localStorage.getItem(`last_toast_${toastKey}`);
        const shouldShow =
          !lastShown || Date.now() - parseInt(lastShown) > 30000;

        if (shouldShow) {
          // Save this toast's timestamp
          localStorage.setItem(`last_toast_${toastKey}`, Date.now().toString());

          // Show toast notification for important status changes
          if (String(status) === "accepted") {
            toast.success(
              `Your order has been accepted and is ready for payment!`,
              { id: toastId, duration: 4000 }
            );
          } else if (String(status) === "rejected") {
            toast.error(
              `Order #${order_id} was rejected. Please modify and try again.`,
              { id: toastId, duration: 4000 }
            );

            // If order is rejected, clear the pendingOrder so user can create a new one
            setTimeout(() => setPendingOrder(null), 3000);
          } else if (
            status === "confirmed" ||
            status === "preparing" ||
            status === "ready" ||
            status === "completed"
          ) {
            // If order is confirmed (paid) or later stages, clear the cart
            clearCart();
            // Only show status update toasts for non-payment related statuses
            // Payment success is handled by the payment result page
            if (status !== "confirmed") {
              toast.success(`Order #${order_id} is now ${status}!`, {
                id: toastId,
                duration: 4000,
              });
            }
          }
        }
      } else {
        // If we don't have a matching pendingOrder, check if the order exists in localStorage
        // This ensures we don't miss updates for orders created in other tabs/sessions
        console.log(
          `CartContext: Order update doesn't match current pendingOrder or no pendingOrder exists`,
          {
            currentOrder: pendingOrder ? pendingOrder.id : null,
            updateFor: order_id,
          }
        );

        // Check if this order exists in localStorage
        const trackedOrders = JSON.parse(
          localStorage.getItem("tracked_orders") || "[]"
        );

        const existingOrder = trackedOrders.find(
          (order) => order.id === parseInt(order_id)
        );

        if (existingOrder) {
          console.log(
            "Found order in localStorage, updating pendingOrder state with it:",
            existingOrder
          );

          // Update the order in localStorage
          const updatedOrder = {
            ...existingOrder,
            status: status,
            ...(order_data || {}),
          };

          // Update localStorage
          const updatedOrders = trackedOrders.map((order) =>
            order.id === parseInt(order_id) ? updatedOrder : order
          );
          localStorage.setItem("tracked_orders", JSON.stringify(updatedOrders));

          // Set as current pendingOrder if it matches our table and vendor
          if (
            updatedOrder.table_identifier === tableNo &&
            updatedOrder.vendor_id === parseInt(vendorId)
          ) {
            console.log("Setting updated order as pendingOrder:", updatedOrder);
            setPendingOrder(updatedOrder);
          }
        }
      }
    },
    [pendingOrder, setPendingOrder, clearCart, tableNo, vendorId]
  );
  // Setup WebSocket connection for order tracking with enhanced status info
  const { isConnected, connectionStatus, usingFallback } = useOrderWebSocket(
    vendorId,
    tableNo,
    handleOrderUpdate
  );

  // Debug log connection status changes
  useEffect(() => {
    console.log(
      `CartContext: WebSocket connection status changed to ${
        isConnected ? "connected" : "disconnected"
      }`
    );
    if (usingFallback) {
      console.log(
        "CartContext: Using API fallback due to WebSocket connection issues"
      );
    }
  }, [isConnected, usingFallback]);

  // Check for existing pending order on mount
  useEffect(() => {
    // Define a function to load orders from localStorage
    const loadOrdersFromStorage = () => {
      const trackedOrders = JSON.parse(
        localStorage.getItem("tracked_orders") || "[]"
      );

      // Filter out any orders without valid IDs
      const validOrders = trackedOrders.filter((order) => order && order.id);

      // Debug log to see what orders are being filtered
      console.log("CartContext: All tracked orders:", trackedOrders);
      console.log("CartContext: Valid orders after filtering:", validOrders);

      // If we filtered out any invalid orders, update localStorage
      if (validOrders.length !== trackedOrders.length) {
        console.log(
          "CartContext: Removing invalid orders from localStorage. Original count:",
          trackedOrders.length,
          "Valid count:",
          validOrders.length
        );
        localStorage.setItem("tracked_orders", JSON.stringify(validOrders));
        console.log("Removed invalid orders from localStorage");
      }

      // Look specifically for pending or accepted orders for this table and vendor
      const relevantStatuses = ["pending", "accepted"];
      const currentPendingOrder = validOrders.find(
        (order) =>
          relevantStatuses.includes(order.status) &&
          order.vendor_id === parseInt(vendorId) &&
          order.table_identifier === tableNo
      );

      // Debug log to help understand what we found
      if (currentPendingOrder) {
        console.log("CartContext: Found pending order in localStorage:", {
          id: currentPendingOrder.id,
          status: currentPendingOrder.status,
          vendor: currentPendingOrder.vendor_id,
          table: currentPendingOrder.table_identifier,
        });
      } else {
        console.log(
          "CartContext: No pending order found in localStorage for this table and vendor"
        );
      }

      // Check if we have a cached WebSocket update that should be applied
      const latestUpdate = window._latestOrderUpdate;
      let updatedOrder = currentPendingOrder;

      if (
        latestUpdate &&
        currentPendingOrder &&
        currentPendingOrder.id === latestUpdate.orderId
      ) {
        console.log(
          "CartContext: Found cached WebSocket update, applying it",
          latestUpdate
        );
        updatedOrder = {
          ...currentPendingOrder,
          status: latestUpdate.status,
          ...(latestUpdate.order_data || {}),
        };

        // Update in localStorage too
        const updatedOrders = validOrders.map((order) =>
          order.id === updatedOrder.id ? updatedOrder : order
        );
        localStorage.setItem("tracked_orders", JSON.stringify(updatedOrders));
      }

      if (updatedOrder) {
        console.log("Found existing pending order:", updatedOrder);
        console.log("Order status type:", typeof updatedOrder.status);
        console.log("Order ID type:", typeof updatedOrder.id);
        setPendingOrder(updatedOrder);

        // Also verify the order status immediately via API to ensure we have the latest status
        verifyOrderStatus(updatedOrder.id);
      } else {
        // Clear any stale pending order state
        setPendingOrder(null);
      }
    };

    // Function to verify order status via API
    const verifyOrderStatus = async (orderId) => {
      try {
        // Get API base URL
        const apiBaseUrl = getApiBaseUrl();

        console.log(`CartContext: Verifying order ${orderId} status via API`);
        const response = await fetch(
          `${apiBaseUrl}/api/orders/${orderId}/status/`
        );

        if (response.ok) {
          const data = await response.json();
          console.log(
            `CartContext: API verified order ${orderId} status: ${data.status}`
          );

          // Update pendingOrder with latest status
          setPendingOrder((prev) => {
            if (prev && prev.id === orderId && prev.status !== data.status) {
              console.log(
                `CartContext: Updating order status from ${prev.status} to ${data.status}`
              );

              // If order has moved to completed or confirmed state, clear the cart
              if (["completed", "confirmed"].includes(data.status)) {
                clearCart();
              }

              return { ...prev, status: data.status };
            }
            return prev;
          });

          // Also update in localStorage
          const trackedOrders = JSON.parse(
            localStorage.getItem("tracked_orders") || "[]"
          );
          const updatedOrders = trackedOrders.map((order) =>
            order.id === orderId ? { ...order, status: data.status } : order
          );
          localStorage.setItem("tracked_orders", JSON.stringify(updatedOrders));
        }
      } catch (error) {
        console.error("Error verifying order status:", error);
      }
    };

    // Load orders on mount
    loadOrdersFromStorage();

    return () => {}; // No cleanup needed
  }, [vendorId, tableNo, isConnected, clearCart]);

  // Calculate cart total
  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Load cart from localStorage on initial mount
  useEffect(() => {
    if (initialLoadCompleted.current) return;

    try {
      const cartKey = `cart_${vendorId}_${tableNo}`;
      const savedCart = localStorage.getItem(cartKey);

      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        previousCartJSON.current = savedCart;

        // Update recommendations based on loaded cart
        if (parsedCart.length > 0 && onUpdateRecommendations) {
          const cartItemIds = parsedCart.map((item) => item.id);
          pendingCartItemsRef.current = cartItemIds;
          triggerRecommendationsUpdate();
        }
      }
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
    }

    initialLoadCompleted.current = true;
  }, [vendorId, tableNo, onUpdateRecommendations]);

  // Save cart to localStorage when it changes
  useEffect(() => {
    if (!initialLoadCompleted.current) return;

    try {
      const cartKey = `cart_${vendorId}_${tableNo}`;
      const currentCartJSON = JSON.stringify(cart);

      if (currentCartJSON !== previousCartJSON.current) {
        localStorage.setItem(cartKey, currentCartJSON);
        previousCartJSON.current = currentCartJSON;
      }
    } catch (error) {
      console.error("Error saving cart to localStorage:", error);
    }
  }, [cart, vendorId, tableNo]);

  // Clean up timeouts when component unmounts
  useEffect(() => {
    return () => {
      // Clear all timeouts
      Object.values(timeoutRefs.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });

      if (recommendationsTimeoutRef.current) {
        clearTimeout(recommendationsTimeoutRef.current);
      }
    };
  }, []);

  // Debounced recommendations update
  const triggerRecommendationsUpdate = useCallback(() => {
    if (recommendationsTimeoutRef.current) {
      clearTimeout(recommendationsTimeoutRef.current);
    }

    recommendationsTimeoutRef.current = setTimeout(() => {
      if (pendingCartItemsRef.current && onUpdateRecommendations) {
        onUpdateRecommendations(pendingCartItemsRef.current);
        pendingCartItemsRef.current = null;
      }
      recommendationsTimeoutRef.current = null;
    }, 500); // 500ms debounce
  }, [onUpdateRecommendations]);

  const addToCart = useCallback(
    (item) => {
      setCart((prevCart) => {
        const existingItem = prevCart.find(
          (cartItem) => cartItem.id === item.id
        );
        let updatedCart;

        if (existingItem) {
          updatedCart = prevCart.map((cartItem) =>
            cartItem.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          );
        } else {
          updatedCart = [...prevCart, { ...item, quantity: 1 }];
        }

        // Update recommendations queue
        const cartItemIds = updatedCart.map((item) => item.id);
        pendingCartItemsRef.current = cartItemIds;
        triggerRecommendationsUpdate();

        return updatedCart;
      });

      // Clear any existing timeout for this item
      if (timeoutRefs.current[item.id]) {
        clearTimeout(timeoutRefs.current[item.id]);
      }

      // Set recently added indicator
      setRecentlyAdded((prev) => ({ ...prev, [item.id]: true }));

      // Store the timeout reference
      timeoutRefs.current[item.id] = setTimeout(() => {
        setRecentlyAdded((prev) => ({ ...prev, [item.id]: false }));
        delete timeoutRefs.current[item.id];
      }, 2000);

      toast.success(`${item.name} added to cart`);
    },
    [triggerRecommendationsUpdate]
  );

  const removeFromCart = useCallback(
    (itemId) => {
      setCart((prevCart) => {
        const updatedCart = prevCart.filter((item) => item.id !== itemId);

        // Update recommendations if needed
        if (updatedCart.length > 0) {
          const cartItemIds = updatedCart.map((item) => item.id);
          pendingCartItemsRef.current = cartItemIds;
          triggerRecommendationsUpdate();
        }

        return updatedCart;
      });
    },
    [triggerRecommendationsUpdate]
  );

  const updateQuantity = useCallback(
    (itemId, newQuantity) => {
      if (newQuantity < 1) {
        removeFromCart(itemId);
        return;
      }

      setCart((prevCart) => {
        const updatedCart = prevCart.map((item) =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        );

        // Update recommendations queue
        const cartItemIds = updatedCart.map((item) => item.id);
        pendingCartItemsRef.current = cartItemIds;
        triggerRecommendationsUpdate();

        return updatedCart;
      });
    },
    [removeFromCart, triggerRecommendationsUpdate]
  );

  // Create order before payment
  const createOrder = useCallback(async () => {
    if (cart.length === 0) {
      throw new Error("Cart is empty");
    }

    try {
      const orderData = {
        items: cart.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        vendor_id: vendorId,
        table_identifier: tableNo,
      };

      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(`${apiBaseUrl}/api/orders/create/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      const result = await response.json();

      console.log("Create Order API response:", result);

      // Get the order ID from the correct location in the response
      // The API is returning order_id as result.order.id, not directly as result.order_id
      const orderId = result.order?.id || result.order_id;

      if (!orderId) {
        console.error("No order ID found in API response:", result);
        throw new Error("Failed to create order: No order ID returned");
      }

      // Create properly formatted order object
      const orderObject = {
        id: orderId,
        status: "pending",
        table_identifier: tableNo,
        vendor_id: parseInt(vendorId),
        total: result.total || result.order?.total || cartTotal.toString(),
        table_name: result.table_name || result.order?.table_name || "Table",
        timestamp: new Date().toISOString(),
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      console.log("Created order object:", orderObject);
      console.log("Order ID type:", typeof orderObject.id);

      // Store order info in localStorage for tracking
      const trackedOrders = JSON.parse(
        localStorage.getItem("tracked_orders") || "[]"
      );

      // Check if this order already exists to prevent duplicates
      const existingOrderIndex = trackedOrders.findIndex(
        (order) => order.id === orderObject.id
      );
      if (existingOrderIndex !== -1) {
        // Update existing order instead of adding duplicate
        trackedOrders[existingOrderIndex] = orderObject;
      } else {
        // Add new order to the beginning
        trackedOrders.unshift(orderObject);
        // Keep only the 5 most recent orders
        if (trackedOrders.length > 5) {
          trackedOrders.splice(5);
        }
      }

      localStorage.setItem("tracked_orders", JSON.stringify(trackedOrders));

      // Store current order ID for order tracking page navigation
      localStorage.setItem("current_order_id", orderId.toString());

      // Store last menu URL for navigation
      localStorage.setItem(
        "last_menu_url",
        `/menu/${vendorId}/${encodeURIComponent(tableNo)}`
      );

      // IMPORTANT: Don't clear the cart yet - we'll keep items until the order is accepted
      // and payment is processed, then clear it

      return orderObject;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }, [cart, vendorId, tableNo]);

  // Proceed to payment for existing order
  const proceedToPayment = useCallback(async (orderId) => {
    try {
      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl();

      // For existing orders, we should just send the order_id
      const response = await fetch(`${apiBaseUrl}/api/initiate-payment/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Payment initiation failed:", errorText);
        console.error("Request data was:", { order_id: orderId });
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || "Failed to initiate payment");
        } catch (e) {
          throw new Error(errorText || "Failed to initiate payment");
        }
      }
      const paymentData = await response.json();

      // Store a flag to check payment status when returning from payment gateway
      localStorage.setItem(`payment_pending_${orderId}`, "true");

      return paymentData;
    } catch (error) {
      console.error("Error initiating payment:", error);
      throw error;
    }
  }, []); // Only need to run once during initialization
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!pendingOrder || !pendingOrder.id) return;

      try {
        // Get the API base URL
        const apiBaseUrl = getApiBaseUrl();

        const response = await fetch(
          `${apiBaseUrl}/api/orders/${pendingOrder.id}/status/`
        );

        if (response.ok) {
          const data = await response.json();

          // If order status indicates payment was completed, clear cart
          if (
            data.status === "confirmed" ||
            data.status === "preparing" ||
            data.status === "ready" ||
            data.status === "completed"
          ) {
            clearCart();
            setPendingOrder(null);
            // Remove duplicate payment success toast - this is handled by payment result page

            // Update the order status in tracked orders instead of removing it
            const trackedOrders = JSON.parse(
              localStorage.getItem("tracked_orders") || "[]"
            );
            const updatedOrders = trackedOrders.map((order) =>
              order.id === pendingOrder.id
                ? { ...order, status: data.status, ...data }
                : order
            );
            localStorage.setItem(
              "tracked_orders",
              JSON.stringify(updatedOrders)
            );

            // Clear the payment pending flag
            if (pendingOrder.id) {
              localStorage.removeItem(`payment_pending_${pendingOrder.id}`);
            }
          }
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
      }
    };

    // Check payment status when component mounts or pendingOrder changes
    checkPaymentStatus();

    // Also check if user is returning from payment (URL contains payment-related params)
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get("payment") === "success" ||
      urlParams.get("status") === "success"
    ) {
      // Clear the URL parameters to prevent repeated notifications
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Check payment status immediately
      setTimeout(checkPaymentStatus, 1000);
    }
  }, [pendingOrder, clearCart]);

  // Remove the old cart clearing logic
  /*
  useEffect(() => {
    const clearCartKey = `clear_cart_${vendorId}_${tableNo}`;
    const shouldClearCart = localStorage.getItem(clearCartKey);

    if (shouldClearCart === "true") {
      clearCart();
      localStorage.removeItem(clearCartKey);
      toast.success("Payment successful! Your order has been placed.");
    }
  }, [vendorId, tableNo, clearCart]);
  */

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        recentlyAdded,
        clearCart,
        cartTotal,
        createOrder,
        proceedToPayment,
        pendingOrder,
        setPendingOrder,
        isConnected,
        connectionStatus,
        usingFallback,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Custom hook to use cart context
export const useCart = () => useContext(CartContext);
