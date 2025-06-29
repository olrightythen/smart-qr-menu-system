"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  Package,
  Receipt,
  ThumbsUp,
  Utensils,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import toast from "react-hot-toast";
import { getApiBaseUrl, getWsBaseUrl } from "@/hooks/useWebSocket";
import { useTheme } from "@/components/ThemeProvider";

const orderStatuses = {
  pending: {
    icon: Receipt,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-950/60",
    label: "Order Received",
    description: "Your order has been received and is being processed",
  },
  accepted: {
    icon: ThumbsUp,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-950/60",
    label: "Order Accepted",
    description: "Your order has been accepted and will be prepared soon",
  },
  confirmed: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-950/60",
    label: "Order Confirmed",
    description: "Your order has been confirmed and will be prepared soon",
  },
  preparing: {
    icon: ChefHat,
    color: "text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-950/60",
    label: "Preparing",
    description: "Our chefs are preparing your delicious meal",
  },
  ready: {
    icon: Package,
    color: "text-green-500",
    bg: "bg-green-100 dark:bg-green-950/60",
    label: "Ready for Pickup",
    description: "Your order is ready! Please come to collect it",
  },
  completed: {
    icon: Utensils,
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-950/60",
    label: "Completed",
    description: "Order completed successfully. Thank you!",
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-100 dark:bg-red-950/60",
    label: "Cancelled",
    description: "This order has been cancelled",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-100 dark:bg-red-950/60",
    label: "Rejected",
    description: "This order has been rejected",
  },
};

// Create a custom hook for order tracking WebSocket
const useOrderWebSocket = (orderId, initialOrder = null) => {
  const [status, setStatus] = useState("Disconnected");
  const [orderData, setOrderData] = useState(initialOrder);

  // Update orderData when initialOrder changes
  useEffect(() => {
    if (initialOrder && !orderData) {
      console.log("Initializing orderData with initial order:", initialOrder);
      setOrderData(initialOrder);
    }
  }, [initialOrder, orderData]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const [menuUrl, setMenuUrl] = useState("/menu"); // Default menu URL

  // Helper function to calculate estimated time based on status
  const calculateEstimatedTime = (status, placedAt) => {
    const estimatedTimes = {
      pending: "5-10 minutes",
      accepted: "15-20 minutes",
      confirmed: "15-20 minutes",
      preparing: "10-15 minutes",
      ready: "Ready now",
      completed: "Completed",
      cancelled: "Cancelled",
      rejected: "Rejected",
    };

    // For ready, completed, cancelled, rejected - show status instead of time
    if (["ready", "completed", "cancelled", "rejected"].includes(status)) {
      return estimatedTimes[status];
    }

    // For active orders, calculate remaining time
    if (placedAt) {
      const now = new Date();
      const placed = new Date(placedAt);
      const elapsed = Math.floor((now - placed) / (1000 * 60)); // minutes elapsed

      let baseTime = 20; // default 20 minutes
      if (status === "pending") baseTime = 10;
      else if (status === "preparing") baseTime = 15;

      const remaining = Math.max(0, baseTime - elapsed);

      if (remaining <= 0) {
        return "Almost ready";
      } else {
        return `${remaining}-${remaining + 5} minutes`;
      }
    }

    return estimatedTimes[status] || "15-20 minutes";
  };

  const connect = useCallback(() => {
    if (!orderId) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      setStatus("Connecting");

      // Get WebSocket base URL
      const wsBaseUrl = getWsBaseUrl();
      const wsUrl = `${wsBaseUrl}/ws/track-order/${orderId}/`;

      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
      wsRef.current = new WebSocket(wsUrl);

      // Set a timeout to detect connection failures faster
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          console.log(
            "WebSocket connection timeout - readyState:",
            wsRef.current.readyState
          );
          // Force close and trigger reconnect
          wsRef.current.close();
        }
      }, 5000); // 5 second timeout

      wsRef.current.onopen = () => {
        setStatus("Connected");
        reconnectAttemptsRef.current = 0;
        clearTimeout(connectionTimeout); // Clear the timeout
        console.log(`Order tracking WebSocket connected for order ${orderId}`);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Order tracking WebSocket received message:", data);

          // Handle connection established message
          if (data.type === "connection_established") {
            console.log(
              "Order tracking WebSocket connection established:",
              data.message
            );
          }
          // Handle order updates
          else if (data.type === "order_update" && data.data) {
            console.log("Received order update:", data.data);

            // Process status updates that have our server_timestamp signature
            if (
              data.data.id &&
              data.data.status &&
              data.data.server_timestamp
            ) {
              console.log("Processing status update from order_utils");

              // Update the orderData state (will be synced to order via useEffect)
              setOrderData((prevOrder) => {
                if (!prevOrder) {
                  console.log("No previous order to update");
                  return prevOrder;
                }

                console.log("Previous status:", prevOrder.status);
                console.log("New status from WebSocket:", data.data.status);

                const updatedOrder = {
                  ...prevOrder, // Keep all existing data (table, restaurant, items, etc.)
                  status: data.data.status, // Update only the status
                  updatedAt: new Date(
                    data.data.updated_at || data.data.updatedAt
                  ),
                  // Recalculate estimated time based on new status
                  estimatedTime: calculateEstimatedTime(
                    data.data.status,
                    prevOrder.placedAt
                  ),
                };

                console.log(
                  "Updated order object with new status:",
                  updatedOrder.status
                );
                return updatedOrder;
              });
            } else {
              console.log("Ignoring update without server_timestamp signature");
            }

            // If there's vendor information, update the menu URL
            if (data.data.vendor_id) {
              const vendorId = data.data.vendor_id;
              const tableIdentifier =
                data.data.table_identifier || data.data.qr_code || "";
              const newMenuUrl = `/menu/${vendorId}/${encodeURIComponent(
                tableIdentifier
              )}`;
              setMenuUrl(newMenuUrl);
              localStorage.setItem("last_menu_url", newMenuUrl);
            }
          }
          // Handle pong responses
          else if (data.type === "pong") {
            console.log(
              "Received pong from order tracking server:",
              data.server_timestamp
            );
          }
          // Handle error messages
          else if (data.type === "error") {
            console.error(
              "Order tracking WebSocket server error:",
              data.message
            );
          }
        } catch (error) {
          console.error(
            "Error parsing order tracking WebSocket message:",
            error
          );
        }
      };

      wsRef.current.onclose = (event) => {
        clearTimeout(connectionTimeout); // Clear the timeout
        setStatus("Disconnected");
        console.log(
          `Order tracking WebSocket disconnected: Code ${event.code}, Reason: ${
            event.reason || "None"
          }, wasClean: ${event.wasClean}`
        );

        // More detailed logging based on close code
        if (event.code === 1000) {
          console.log("Normal closure, connection closed normally");
        } else if (event.code === 1001) {
          console.log("Remote endpoint going away, server shutting down");
        } else if (event.code === 1002) {
          console.log("Protocol error");
        } else if (event.code === 1003) {
          console.log("Invalid data received");
        } else if (event.code === 1006) {
          console.log(
            "Abnormal closure, connection closed abnormally (no close frame)"
          );
        } else if (event.code === 1007) {
          console.log("Invalid frame payload data");
        } else if (event.code === 1008) {
          console.log("Policy violation");
        } else if (event.code === 1009) {
          console.log("Message too big");
        } else if (event.code === 1010) {
          console.log("Missing extension");
        } else if (event.code === 1011) {
          console.log("Internal server error");
        } else if (event.code === 1015) {
          console.log("TLS handshake failure");
        }

        // Attempt to reconnect if not intentionally closed
        if (
          event.code !== 1000 &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            30000
          );
          reconnectAttemptsRef.current += 1;

          console.log(
            `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
          setStatus("Reconnecting");

          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          console.log(
            "Max reconnect attempts reached. Please refresh the page to try again."
          );
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("Order tracking WebSocket error:", error);
        setStatus("Error");

        // Log more details about the error
        console.log("WebSocket readyState:", wsRef.current.readyState);
        console.log("Navigator online:", navigator.onLine);

        // If we reach the maximum number of reconnect attempts, log it
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log("Max reconnect attempts reached in error handler");
        }
      };
    } catch (error) {
      console.error("Error creating order tracking WebSocket:", error);
      setStatus("Error");
    }
  }, [orderId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Intentional disconnect");
      wsRef.current = null;
    }

    setStatus("Disconnected");
    reconnectAttemptsRef.current = 0;
  }, []);

  // Connect when orderId changes
  useEffect(() => {
    if (orderId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [orderId, connect, disconnect]);

  return { status, orderData, connect, disconnect, menuUrl };
};

export default function OrderTracking() {
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuUrl, setMenuUrl] = useState("/menu"); // Default menu URL
  const { theme, toggleTheme } = useTheme();

  const {
    status: wsStatus,
    orderData,
    menuUrl: wsMenuUrl,
  } = useOrderWebSocket(selectedOrderId, order);

  // Update the order state when we get updates from WebSocket
  useEffect(() => {
    if (orderData) {
      console.log("Updating order from WebSocket orderData:", orderData);
      console.log("New status:", orderData.status);
      console.log("Restaurant info in orderData:", orderData.restaurant);
      setOrder(orderData);
      console.log("Order state updated");

      // Update the orders list with the new status
      setOrders((prevOrders) =>
        prevOrders.map((orderInfo) =>
          orderInfo.id === orderData.id || orderInfo.id === orderData.order_id
            ? {
                ...orderInfo,
                status: orderData.status,
                timestamp:
                  orderData.timestamp ||
                  orderData.updated_at ||
                  orderInfo.timestamp,
              }
            : orderInfo
        )
      );

      // Clean up table booking info when order is completed/cancelled/rejected
      if (["completed", "cancelled", "rejected"].includes(orderData.status)) {
        console.log("Order finished, cleaning up table booking info");
        localStorage.removeItem("last_order_table");
        localStorage.removeItem("last_order_vendor");
        localStorage.removeItem("current_order_id");
      }
    }
  }, [orderData]);

  // Update menuUrl when websocket provides it
  useEffect(() => {
    if (wsMenuUrl && wsMenuUrl !== "/menu") {
      setMenuUrl(wsMenuUrl);
    }
  }, [wsMenuUrl]);

  // Load orders from localStorage on page load
  useEffect(() => {
    const loadTrackedOrders = () => {
      try {
        // Get stored orders from localStorage
        const storedOrdersJSON = localStorage.getItem("tracked_orders");
        console.log(
          "Loading tracked orders from localStorage:",
          storedOrdersJSON
        );

        if (storedOrdersJSON) {
          const storedOrders = JSON.parse(storedOrdersJSON);
          console.log("Parsed stored orders:", storedOrders);

          // Remove duplicates based on order ID
          const uniqueOrders = storedOrders.filter(
            (order, index, self) =>
              index === self.findIndex((o) => o.id === order.id)
          );

          console.log("Unique orders after deduplication:", uniqueOrders);
          setOrders(uniqueOrders);

          // Auto-select the most recent order if available
          if (uniqueOrders.length > 0 && !selectedOrderId) {
            const mostRecentOrder = uniqueOrders[0];
            console.log("Auto-selecting most recent order:", mostRecentOrder);
            fetchOrderDetails(mostRecentOrder.id);
          }
        } else {
          console.log("No tracked orders found in localStorage");
          setOrders([]);
        }
      } catch (error) {
        console.error("Error loading tracked orders:", error);
        setOrders([]);
      }
    };

    loadTrackedOrders();

    // Check for current active order from localStorage (from payment result)
    const currentOrderId = localStorage.getItem("current_order_id");
    if (currentOrderId) {
      console.log("Found current order ID in localStorage:", currentOrderId);
      fetchOrderDetails(currentOrderId);
      // Clear the current order ID after fetching
      localStorage.removeItem("current_order_id");
    }

    // Get last used menu URL from localStorage
    const lastMenuUrl = localStorage.getItem("last_menu_url");
    if (lastMenuUrl) {
      setMenuUrl(lastMenuUrl);
    } else {
      setMenuUrl("/menu"); // Default fallback
    }
  }, []);

  const fetchOrderDetails = async (orderId) => {
    if (!orderId) return;

    setLoading(true);
    setError("");
    setSelectedOrderId(orderId);
    try {
      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl();

      // Call the API to get order details
      const response = await fetch(
        `${apiBaseUrl}/api/track-order/?order_id=${orderId}`
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (response.ok) {
        // Debug logging to see what data we receive
        console.log("Received order data:", data);
        console.log("Restaurant data:", data.restaurant);
        console.log("Vendor name:", data.vendor_name);
        // Helper function to calculate estimated time
        const calculateEstimatedTime = (status) => {
          const estimatedTimes = {
            pending: "5-10 minutes",
            accepted: "15-20 minutes",
            confirmed: "15-20 minutes",
            preparing: "10-15 minutes",
            ready: "Ready now",
            completed: "Completed",
            cancelled: "Cancelled",
            rejected: "Rejected",
          };
          return estimatedTimes[status] || "15-20 minutes";
        };

        // Format the received order data
        const receivedOrder = {
          ...data,
          id: data.id || data.order_id,
          status: data.status,
          estimatedTime:
            data.estimatedTime ||
            data.estimated_time ||
            calculateEstimatedTime(data.status),
          placedAt: new Date(
            data.placedAt || data.timestamp || data.created_at
          ),
          items: data.items || [],
          total: data.total || data.total_amount,
          tableIdentifier: data.table_identifier || data.qr_code,
          table: {
            name: data.table_name || data.table_identifier || "Table",
            identifier: data.table_identifier || data.qr_code || "N/A",
            id: data.table_id || null,
          },
          restaurant: {
            name: data.restaurant?.name || data.vendor_name || "Restaurant",
            phone: data.restaurant?.phone || data.restaurant?.contact || null,
          },
        };

        setOrder(receivedOrder);

        // If there's vendor information, update the menu URL
        if (data.vendor_id) {
          const vendorId = data.vendor_id;
          const tableIdentifier = data.table_identifier || data.qr_code || "";
          const newMenuUrl = `/menu/${vendorId}/${encodeURIComponent(
            tableIdentifier
          )}`;
          setMenuUrl(newMenuUrl);
          localStorage.setItem("last_menu_url", newMenuUrl);
        }
      }
    } catch (err) {
      console.error("Error tracking order:", err);
      setError(
        "Order not found or an error occurred. Please check your order ID."
      );
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusProgress = (currentStatus) => {
    const statuses = [
      "pending",
      "accepted",
      "confirmed",
      "preparing",
      "ready",
      "completed",
    ];

    // Handle cancelled/rejected status separately
    if (currentStatus === "cancelled" || currentStatus === "rejected") {
      return 0;
    }

    const currentIndex = statuses.indexOf(currentStatus);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / statuses.length) * 100;
  };

  const isStatusActive = (status, currentStatus) => {
    const statuses = [
      "pending",
      "accepted",
      "confirmed",
      "preparing",
      "ready",
      "completed",
    ];

    // Handle cancelled/rejected status separately
    if (currentStatus === "cancelled" || currentStatus === "rejected") {
      return status === "cancelled" || status === "rejected";
    }

    const currentIndex = statuses.indexOf(currentStatus);
    const statusIndex = statuses.indexOf(status);
    if (currentIndex === -1 || statusIndex === -1) return false;
    return statusIndex <= currentIndex;
  };

  // Calculate how long ago the order was placed (updates in real-time)
  const getTimeAgo = (date) => {
    const now = currentTime;
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  };

  // Debug: Track orders state changes
  useEffect(() => {
    console.log("Orders state changed:", orders);
  }, [orders]);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for real-time "time ago" display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background py-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{order?.restaurant?.name}</h1>
            {order?.table && (
              <p className="text-xs text-muted-foreground">
                {order.table.name}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            {order?.restaurant && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  (window.location.href = `tel:${order.restaurant.phone}`)
                }
                disabled={!order.restaurant.phone}
              >
                <Package className="h-4 w-4 mr-2" />
                Call Restaurant
              </Button>
            )}
          </div>
        </div>{" "}
      </header>
      <div className="container mx-auto px-4 max-w-2xl">
        <Link
          href={menuUrl}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Menu
        </Link>

        <div className="bg-card rounded-xl border border-border p-6 md:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Track Your Order
            </h1>
            <p className="text-muted-foreground">
              View the status of your recent orders
            </p>
          </div>

          {/* Recent Orders Section */}
          {orders.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-medium text-lg">Your Recent Orders</h2>
              <div className="space-y-2">
                {orders.map((orderInfo) => (
                  <div
                    key={orderInfo.id}
                    className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer ${
                      selectedOrderId === orderInfo.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => fetchOrderDetails(orderInfo.id)}
                  >
                    <div>
                      <div className="font-medium">Order #{orderInfo.id}</div>
                      <div className="text-sm text-muted-foreground">
                        {orderInfo.timestamp &&
                          getTimeAgo(new Date(orderInfo.timestamp))}
                      </div>
                    </div>
                    {orderInfo.status && (
                      <div
                        className={`text-sm px-2 py-1 rounded-full ${
                          orderStatuses[orderInfo.status]?.bg || "bg-muted"
                        }`}
                      >
                        {orderStatuses[orderInfo.status]?.label ||
                          orderInfo.status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading order details...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-8 space-y-4">
              <XCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div className="text-red-500">{error}</div>
              <p className="text-muted-foreground">
                Please check that you have the correct order ID
              </p>
            </div>
          )}

          {/* Order Details */}
          {order && !loading && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="text-center border-b border-border pb-4">
                <h2 className="text-xl font-semibold">Order #{order.id}</h2>
                <p className="text-muted-foreground">
                  Placed {order.placedAt.toLocaleTimeString()} • Estimated:{" "}
                  {order.estimatedTime}
                </p>
                {wsStatus && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        wsStatus === "Connected"
                          ? "bg-green-500"
                          : wsStatus === "Connecting" ||
                            wsStatus === "Reconnecting"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {wsStatus === "Connected"
                        ? "Live updates active"
                        : wsStatus === "Connecting"
                        ? "Connecting..."
                        : wsStatus === "Reconnecting"
                        ? "Reconnecting..."
                        : "Updates paused"}
                    </span>
                  </div>
                )}
              </div>
              {/* Status Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Order Progress</span>
                  <span className="font-medium">
                    {Math.round(getStatusProgress(order.status))}%
                  </span>
                </div>

                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${getStatusProgress(order.status)}%` }}
                  ></div>
                </div>

                {/* Status Steps */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    "pending",
                    "accepted",
                    "confirmed",
                    "preparing",
                    "ready",
                    "completed",
                  ].map((status) => {
                    if (!orderStatuses[status]) return null;

                    const config = orderStatuses[status];
                    const isActive = isStatusActive(status, order.status);
                    const isCurrent = status === order.status;
                    const IconComponent = config.icon;

                    return (
                      <div
                        key={status}
                        className={`text-center p-3 rounded-lg transition-all ${
                          isActive ? config.bg : "bg-muted/50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                            isActive ? config.bg : "bg-muted"
                          }`}
                        >
                          <IconComponent
                            className={`h-4 w-4 ${
                              isActive ? config.color : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            isActive
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {config.label}
                        </div>
                        {isCurrent && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {config.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Current Status Card */}
              {order.status && orderStatuses[order.status] && (
                <div
                  className={`rounded-lg p-4 ${orderStatuses[order.status].bg}`}
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const StatusIcon = orderStatuses[order.status].icon;
                      return (
                        <StatusIcon
                          className={`h-6 w-6 ${
                            orderStatuses[order.status].color
                          }`}
                        />
                      );
                    })()}
                    <div>
                      <h3 className="font-medium">
                        {orderStatuses[order.status].label}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {orderStatuses[order.status].description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback for unknown status */}
              {order.status && !orderStatuses[order.status] && (
                <div className="rounded-lg p-4 bg-gray-100 dark:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-gray-500" />
                    <div>
                      <h3 className="font-medium capitalize">
                        {order.status.replace("_", " ")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Order status has been updated
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Order Items */}
              <div className="space-y-4">
                <h3 className="font-medium">Order Items</h3>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={`${item.id || item.name}-${item.quantity}`}
                      className="flex justify-between text-sm"
                    >
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span>Rs. {item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>Rs. {order.total}</span>
                </div>
              </div>
              {/* Contact Information */}
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Table</h4>
                  <p className="text-lg font-medium">
                    {order.table?.name || order.tableIdentifier || "Table"}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Restaurant</h4>
                  <p>{order.restaurant?.name || "Restaurant"}</p>
                  {order.restaurant?.phone ? (
                    <p className="text-muted-foreground">
                      {order.restaurant.phone}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Contact information not available
                    </p>
                  )}
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {order.restaurant?.phone ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      (window.location.href = `tel:${order.restaurant.phone}`)
                    }
                  >
                    Call Restaurant
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    Contact Unavailable
                  </Button>
                )}
                <Button
                  asChild
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Link href={menuUrl}>Order Again</Link>
                </Button>
              </div>
            </div>
          )}

          {/* No Orders State */}
          {orders.length === 0 && !order && !loading && !error && (
            <div className="text-center py-8 space-y-4">
              <Package className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="font-medium">No Recent Orders</h3>
              <p className="text-muted-foreground">
                You don't have any recent orders to track
              </p>
              <Button
                asChild
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Link href={menuUrl}>Browse Menu</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
