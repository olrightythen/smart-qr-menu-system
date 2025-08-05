"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Filter,
  Search,
  CheckCircle,
  XCircle,
  MoreVertical,
  RefreshCw,
  Loader2,
  Check,
  Calendar,
  DollarSign,
  AlertTriangle,
  Package,
  Clock,
  MessageSquare,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { toast } from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import ConnectionStatus from "@/components/dashboard/ConnectionStatus";

// Memoized status styles to avoid re-creating on every render
const STATUS_STYLES = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  accepted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  preparing:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  ready:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// Format the status for display - moved outside component to avoid recreation on each render
const formatStatus = (status) => {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "confirmed":
      return "Confirmed";
    case "rejected":
      return "Rejected";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready for Pickup";
    case "delivered":
      return "Delivered";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

// Format time elapsed for display (same format as recent orders)
const formatTimeElapsed = (timestamp) => {
  if (!timestamp) return "N/A";

  try {
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diff = now - orderTime;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (minutes > 0) {
      return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
    } else {
      return "Just now";
    }
  } catch (error) {
    return "N/A";
  }
};

// Get base API URL - moved outside component
const getApiBaseUrl = () => {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:8000"
      : `${window.location.protocol}//${window.location.hostname}:8000`)
  );
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrders, setUpdatingOrders] = useState(new Set());
  const [error, setError] = useState(null);
  const { user, token } = useAuth();
  const { notifications } = useNotifications();
  const [activeFilters, setActiveFilters] = useState({
    status: [],
    timeRange: "all",
    minAmount: "",
    maxAmount: "",
  });

  // Memoize the active filter count
  const activeFilterCount = useMemo(
    () =>
      activeFilters.status.length +
      (activeFilters.timeRange !== "all" ? 1 : 0) +
      (activeFilters.minAmount ? 1 : 0) +
      (activeFilters.maxAmount ? 1 : 0),
    [activeFilters]
  );

  // Create the fetchOrders function with useCallback to avoid dependency issues
  const fetchOrders = useCallback(async () => {
    if (!user?.id || !token) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${getApiBaseUrl()}/api/orders/${user.id}/`,
        {
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to fetch orders: ${response.status}`
        );
      }

      const data = await response.json();

      // Process orders to add items_text for display
      const processedOrders = data.orders.map((order) => {
        const itemsText = Array.isArray(order.items)
          ? order.items
              .map((item) => `${item.quantity}x ${item.name}`)
              .join(", ")
          : "No items";

        return {
          ...order,
          items_text: itemsText,
          // Keep customer verification and delivery issue fields for display only
          customer_verified: Boolean(order.customer_verified),
          verification_timestamp: order.verification_timestamp || null,
          delivery_issue_reported: Boolean(order.delivery_issue_reported),
          issue_description: order.issue_description || null,
          issue_report_timestamp: order.issue_report_timestamp || null,
        };
      });

      setOrders(processedOrders);
      setError(null);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders. Please try again.");
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [user?.id, token]);

  // Custom message handler for WebSocket messages

  // Custom message handler for WebSocket messages
  const handleWebSocketMessage = useCallback(
    (data) => {
      // Debug: Log all incoming WebSocket messages
      console.log("🔌 WebSocket message received:", data);
      
      // Handle different message structures
      let notificationType, orderData;
      
      if (data.type === "vendor_notification" && data.data) {
        // Vendor notification format: { type: "vendor_notification", data: { type: "...", data: {...} } }
        notificationType = data.data.type;
        orderData = data.data.data || {};
      } else if (data.type === "order_status") {
        // Direct order status format: { type: "order_status", data: {...} }
        notificationType = "order_status";
        orderData = data.data || data;
      } else {
        // Direct message format
        notificationType = data.type;
        orderData = data.data || data;
      }
      
      // Debug: Log parsed data
      console.log("📨 Parsed notification type:", notificationType);
      console.log("📊 Order data:", orderData);

      // Handle different notification types
      if (notificationType === "new_order") {
        // Only for new orders, we need to fetch all orders to get the new one
        fetchOrders();
        toast.success("New order received!");
      } else if (notificationType === "order_status") {
        // Update specific order without full refresh
        if ((orderData.order_id || orderData.id) && orderData.status) {
          const orderId = orderData.order_id || orderData.id;
          console.log(`🔄 Updating order ${orderId} status to ${orderData.status}`);
          
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === orderId
                ? {
                    ...order,
                    status: orderData.status,
                    // Also update delivery issue fields if present in the update
                    ...(orderData.delivery_issue_reported !== undefined && {
                      delivery_issue_reported: Boolean(
                        orderData.delivery_issue_reported
                      ),
                      issue_report_timestamp:
                        orderData.issue_report_timestamp ||
                        order.issue_report_timestamp,
                      issue_description:
                        orderData.issue_description || order.issue_description,
                      issue_resolved: Boolean(orderData.issue_resolved),
                      issue_resolution_timestamp:
                        orderData.issue_resolution_timestamp ||
                        order.issue_resolution_timestamp,
                      resolution_message:
                        orderData.resolution_message ||
                        order.resolution_message,
                    }),
                    // Update customer verification fields if present
                    ...(orderData.customer_verified !== undefined && {
                      customer_verified: Boolean(orderData.customer_verified),
                      verification_timestamp:
                        orderData.verification_timestamp ||
                        order.verification_timestamp,
                    }),
                  }
                : order
            )
          );
          
          // Show toast if verification status changed
          if (orderData.customer_verified !== undefined) {
            console.log(`✅ Customer verification update for order ${orderId}:`, orderData.customer_verified);
            if (orderData.customer_verified) {
              toast.success(`✅ Order #${orderId} verified by customer`);
            }
          }
        }
      } else if (notificationType === "delivery_issue") {
        // Show notification to vendor (for information only)
        toast.error("⚠️ Customer reported a delivery issue");

        // Update the specific order with delivery issue flag (display only)
        const orderId = orderData.order_id || data.order_id;
        if (orderId) {
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === orderId
                ? {
                    ...order,
                    delivery_issue_reported: true,
                    issue_report_timestamp: new Date().toISOString(),
                    issue_description:
                      orderData.issue_description ||
                      data.issue_description ||
                      "Customer reports not receiving the delivered order",
                  }
                : order
            )
          );
        }
      } else if (
        notificationType === "customer_verification" ||
        notificationType === "verification"
      ) {
        // Update the specific order with verification status
        const orderId = orderData.order_id || data.order_id;
        if (orderId) {
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === orderId
                ? {
                    ...order,
                    customer_verified: Boolean(
                      orderData.verified || orderData.customer_verified
                    ),
                    verification_timestamp:
                      orderData.verification_timestamp ||
                      new Date().toISOString(),
                  }
                : order
            )
          );
          toast.success("Customer verification status updated");
        }
      }
    },
    [fetchOrders]
  );

  // Connect to WebSocket for real-time updates
  const { connectionStatus } = useWebSocket(handleWebSocketMessage);

  // Load orders on mount and when user/token changes
  useEffect(() => {
    if (user?.id && token) {
      fetchOrders();
    }
  }, [user?.id, token]);

  // Optimized order status update function
  const updateOrderStatus = useCallback(
    async (orderId, newStatus) => {
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      setUpdatingOrders((prev) => new Set(prev).add(orderId));
      try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(
          `${apiBaseUrl}/api/orders/${orderId}/update-status/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Token ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `Failed to update order status: ${response.status}`
          );
        }

        // Update the order in the state
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );

        // Enhanced success message with context
        const statusMessages = {
          delivered:
            "Order marked as delivered. Customer will be notified to verify receipt.",
          completed: "Order completed successfully.",
          cancelled: "Order has been cancelled.",
          preparing: "Order is now being prepared.",
          ready: "Order is ready for pickup/delivery.",
        };

        toast.success(
          statusMessages[newStatus] ||
            `Order #${orderId} updated to ${formatStatus(newStatus)}`
        );
      } catch (error) {
        console.error("Error updating order status:", error);
        toast.error("Failed to update order status");
      } finally {
        setUpdatingOrders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    },
    [token]
  );

  // Function to send verification reminder to customer
  const sendVerificationReminder = useCallback(
    async (orderId) => {
      try {
        // For now, just show a success message as the reminder functionality
        // would need to be implemented on the backend
        toast.success(
          "Verification reminder functionality will be implemented soon"
        );

        // TODO: Implement actual reminder sending when backend endpoint is ready
        // const apiBaseUrl = getApiBaseUrl();
        // const response = await fetch(
        //   `${apiBaseUrl}/api/orders/${orderId}/send-reminder/`,
        //   {
        //     method: "POST",
        //     headers: {
        //       "Content-Type": "application/json",
        //       Authorization: `Token ${token}`,
        //     },
        //     body: JSON.stringify({
        //       reminder_type: "verification",
        //       sent_at: new Date().toISOString(),
        //     }),
        //   }
        // );

        // if (response.ok) {
        //   toast.success("Verification reminder sent to customer");
        // } else {
        //   throw new Error("Failed to send reminder");
        // }
      } catch (error) {
        console.error("Error sending verification reminder:", error);
        toast.error("Failed to send verification reminder");
      }
    },
    [token]
  );

  // Function to resolve delivery issues
  const resolveDeliveryIssue = useCallback(
    async (orderId) => {
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      try {
        setUpdatingOrders((prev) => new Set(prev).add(orderId));

        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(
          `${apiBaseUrl}/api/orders/${orderId}/resolve-issue/`,
          {
            method: "POST",
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              resolution_message:
                "Restaurant has resolved the delivery issue. Your order is now available.",
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `Failed to resolve delivery issue: ${response.status}`
          );
        }

        // Update the order in the state
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  issue_resolved: true,
                  issue_resolution_timestamp: new Date().toISOString(),
                  resolution_message:
                    "Restaurant has resolved the delivery issue. Your order is now available.",
                }
              : order
          )
        );

        toast.success(
          "Delivery issue marked as resolved. Customer has been notified and can now verify order completion."
        );
      } catch (error) {
        console.error("Error resolving delivery issue:", error);
        toast.error("Failed to resolve delivery issue");
      } finally {
        setUpdatingOrders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    },
    [token]
  );

  // Filter handlers
  const toggleStatusFilter = useCallback((status) => {
    setActiveFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  }, []);

  const setTimeRangeFilter = useCallback((range) => {
    setActiveFilters((prev) => ({
      ...prev,
      timeRange: range,
    }));
  }, []);

  const updateAmountFilter = useCallback((type, value) => {
    setActiveFilters((prev) => ({
      ...prev,
      [type]: value,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setActiveFilters({
      status: [],
      timeRange: "all",
      minAmount: "",
      maxAmount: "",
    });
    toast.success("Filters reset");
  }, []);

  // Function to check if an order has any available actions
  const hasAvailableActions = useCallback((order) => {
    // No actions for final states
    if (["completed", "cancelled", "rejected"].includes(order.status)) {
      return false;
    }

    // All other statuses have actions except completed orders
    if (order.status === "delivered") {
      // Delivered orders always have actions - either verification/issue resolution options
      return true;
    }

    // All other statuses have actions
    return true;
  }, []);

  // Enhanced filtered and sorted orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const searchLower = searchTerm.toLowerCase();

        // Text search filter
        const matchesSearch =
          (order.order_id?.toLowerCase() || "").includes(searchLower) ||
          (order.table_name?.toLowerCase() || "").includes(searchLower) ||
          (order.status?.toLowerCase() || "").includes(searchLower) ||
          (order.items_text?.toLowerCase() || "").includes(searchLower) ||
          (Array.isArray(order.items) &&
            order.items.some((item) =>
              (item.name?.toLowerCase() || "").includes(searchLower)
            ));

        if (!matchesSearch) return false;

        // Status filter
        if (
          activeFilters.status.length > 0 &&
          !activeFilters.status.includes(order.status)
        ) {
          return false;
        }

        // Amount filter
        const amount = parseFloat(order.total_amount || 0);
        if (
          activeFilters.minAmount &&
          amount < parseFloat(activeFilters.minAmount)
        ) {
          return false;
        }
        if (
          activeFilters.maxAmount &&
          amount > parseFloat(activeFilters.maxAmount)
        ) {
          return false;
        }

        // Time range filter
        if (activeFilters.timeRange !== "all") {
          const orderDate = new Date(order.timestamp);
          const now = new Date();

          if (activeFilters.timeRange === "today") {
            // Check if the order is from today
            const isToday =
              orderDate.getDate() === now.getDate() &&
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear();
            if (!isToday) return false;
          } else if (activeFilters.timeRange === "yesterday") {
            // Check if the order is from yesterday
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const isYesterday =
              orderDate.getDate() === yesterday.getDate() &&
              orderDate.getMonth() === yesterday.getMonth() &&
              orderDate.getFullYear() === yesterday.getFullYear();
            if (!isYesterday) return false;
          } else if (activeFilters.timeRange === "thisWeek") {
            // Check if the order is from this week
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
            startOfWeek.setHours(0, 0, 0, 0);
            if (orderDate < startOfWeek) return false;
          } else if (activeFilters.timeRange === "thisMonth") {
            // Check if the order is from this month
            const isThisMonth =
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear();
            if (!isThisMonth) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by status urgency, then by timestamp

        // Status urgency priority
        const statusPriority = {
          pending: 5,
          accepted: 4,
          confirmed: 4,
          preparing: 3,
          ready: 3,
          delivered: 2,
          completed: 1,
          cancelled: 0,
          rejected: 0,
        };

        const aStatusPriority = statusPriority[a.status] || 0;
        const bStatusPriority = statusPriority[b.status] || 0;

        if (aStatusPriority !== bStatusPriority) {
          return bStatusPriority - aStatusPriority;
        }

        // Final sort by timestamp (newest first)
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
  }, [orders, searchTerm, activeFilters]);

  // Format the status for display
  const formatStatus = (status) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "accepted":
        return "Accepted";
      case "confirmed":
        return "Confirmed";
      case "rejected":
        return "Rejected";
      case "preparing":
        return "Preparing";
      case "ready":
        return "Ready for Pickup";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage your restaurant orders</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus status={connectionStatus} />

          {/* Active Delivery Issues Info Alert */}
          {orders.filter(
            (order) =>
              order.delivery_issue_reported === true &&
              order.status === "delivered" &&
              order.customer_verified !== true
          ).length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                {
                  orders.filter(
                    (order) =>
                      order.delivery_issue_reported === true &&
                      order.status === "delivered" &&
                      order.customer_verified !== true
                  ).length
                }{" "}
                Active Customer Issue
                {orders.filter(
                  (order) =>
                    order.delivery_issue_reported === true &&
                    order.status === "delivered" &&
                    order.customer_verified !== true
                ).length > 1
                  ? "s"
                  : ""}{" "}
                - Awaiting Verification
              </span>
            </div>
          )}
          <Button onClick={fetchOrders} disabled={loading} variant="outline">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <p className="text-sm text-muted-foreground">Delivered Orders</p>
          </div>
          <p className="text-2xl font-bold mt-2">
            {orders.filter((order) => order.status === "delivered").length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {
              orders.filter(
                (order) =>
                  order.status === "delivered" &&
                  order.customer_verified !== true
              ).length
            }{" "}
            awaiting verification
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <p className="text-sm text-muted-foreground">Verified Orders</p>
          </div>
          <p className="text-2xl font-bold mt-2">
            {orders.filter((order) => order.customer_verified === true).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Customer verified
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500"></div>
            <p className="text-sm text-muted-foreground">Active Issues</p>
          </div>
          <p className="text-2xl font-bold mt-2">
            {
              orders.filter(
                (order) =>
                  order.delivery_issue_reported === true &&
                  order.status === "delivered" &&
                  order.customer_verified !== true
              ).length
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Unresolved customer reports
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500"></div>
            <p className="text-sm text-muted-foreground">Active Orders</p>
          </div>
          <p className="text-2xl font-bold mt-2">
            {
              orders.filter((order) =>
                [
                  "pending",
                  "accepted",
                  "confirmed",
                  "preparing",
                  "ready",
                ].includes(order.status)
              ).length
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">In progress</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center rounded-full bg-primary w-5 h-5 text-[10px] text-primary-foreground font-medium">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60">
            <DropdownMenuLabel>Filter Orders</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activeFilters.status.length > 0
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    ></span>
                  </span>
                  <span>Status</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("pending")}
                    onCheckedChange={() => toggleStatusFilter("pending")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      <span>Pending</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("accepted")}
                    onCheckedChange={() => toggleStatusFilter("accepted")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Accepted</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("rejected")}
                    onCheckedChange={() => toggleStatusFilter("rejected")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span>Rejected</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("confirmed")}
                    onCheckedChange={() => toggleStatusFilter("confirmed")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                      <span>Confirmed</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("preparing")}
                    onCheckedChange={() => toggleStatusFilter("preparing")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <span>Preparing</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("ready")}
                    onCheckedChange={() => toggleStatusFilter("ready")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span>Ready for Pickup</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("delivered")}
                    onCheckedChange={() => toggleStatusFilter("delivered")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Delivered</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("completed")}
                    onCheckedChange={() => toggleStatusFilter("completed")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span>Completed</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.status.includes("cancelled")}
                    onCheckedChange={() => toggleStatusFilter("cancelled")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span>Cancelled</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activeFilters.timeRange !== "all"
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    ></span>
                  </span>
                  <span>Time Range</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={activeFilters.timeRange}
                    onValueChange={setTimeRangeFilter}
                  >
                    <DropdownMenuRadioItem value="all">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>All Time</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="today">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>Today</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="yesterday">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>Yesterday</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="thisWeek">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>This Week</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="thisMonth">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>This Month</span>
                      </div>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activeFilters.minAmount || activeFilters.maxAmount
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    ></span>
                  </span>
                  <span>Amount Range</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      <span className="text-sm">Min Amount</span>
                    </div>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={activeFilters.minAmount}
                      onChange={(e) =>
                        updateAmountFilter("minAmount", e.target.value)
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      <span className="text-sm">Max Amount</span>
                    </div>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={activeFilters.maxAmount}
                      onChange={(e) =>
                        updateAmountFilter("maxAmount", e.target.value)
                      }
                      className="h-8"
                    />
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={resetFilters}
              className="justify-center text-center"
            >
              Reset Filters
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border bg-card overflow-x-auto">
        <div className="min-w-full">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground"
                >
                  Order ID
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground"
                >
                  Table
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground"
                >
                  Items
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground"
                >
                  Time
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                      <p className="text-muted-foreground">Loading orders...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-12 w-12 text-muted-foreground" />
                      <h3 className="text-lg font-medium">No orders found</h3>
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? "Try adjusting your search"
                          : "Orders will appear here when customers place them"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border hover:bg-accent/50"
                  >
                    <td className="p-4">{order.order_id}</td>
                    <td className="p-4">{order.table_name || "N/A"}</td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {Array.isArray(order.items) &&
                          order.items.map((item, index) => (
                            <div key={index} className="text-sm">
                              {item.quantity}x {item.name || "Unnamed Item"}
                            </div>
                          ))}
                        {(!Array.isArray(order.items) ||
                          order.items.length === 0) && (
                          <div className="text-sm text-muted-foreground">
                            No items
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-medium">
                      Rs. {parseFloat(order.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        {/* Main Status Badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_STYLES[order.status] ||
                              "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {formatStatus(order.status)}
                          </span>

                          {/* Delivery Issue Indicator (Information Only) */}
                          {order.delivery_issue_reported === true && (
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <span className="ml-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                ISSUE REPORTED
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Enhanced Verification Status Indicators */}
                        {order.status === "delivered" && (
                          <div className="flex flex-col gap-1">
                            {order.customer_verified === true ? (
                              <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                                <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                                  Customer Verified
                                </span>
                              </div>
                            ) : order.delivery_issue_reported === true ? (
                              <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                                <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                                <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                                  Customer Reported Issue
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                                  Awaiting Customer Verification
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Completed Order Verification Badge */}
                        {order.status === "completed" &&
                          order.customer_verified === true && (
                            <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded border border-green-200 dark:border-green-800 self-start">
                              <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                              <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                                Verified Complete
                              </span>
                            </div>
                          )}

                        {/* Issue Description Display (Only for Active Unresolved Issues) */}
                        {order.delivery_issue_reported === true &&
                          order.status === "delivered" &&
                          order.customer_verified !== true && (
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                                    Customer Reported Issue
                                  </p>
                                  <p className="text-sm text-red-700 dark:text-red-300 break-words">
                                    {order.issue_description ||
                                      "Customer reports not receiving the delivered order"}
                                  </p>
                                  {order.issue_report_timestamp && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                      Reported:{" "}
                                      {new Date(
                                        order.issue_report_timestamp
                                      ).toLocaleString()}
                                    </p>
                                  )}
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                                    Note: Only customer can verify order
                                    completion
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatTimeElapsed(order.timestamp)}
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className={`h-8 w-8 p-0 ${
                              !hasAvailableActions(order)
                                ? "text-muted-foreground cursor-not-allowed opacity-50"
                                : ""
                            }`}
                            disabled={
                              updatingOrders.has(order.id) ||
                              !hasAvailableActions(order)
                            }
                          >
                            {updatingOrders.has(order.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                              {hasAvailableActions(order)
                                ? "Open menu"
                                : "No actions available"}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {order.status === "pending" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "accepted")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                                Accept Order
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "rejected")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                Reject Order
                              </DropdownMenuItem>
                            </>
                          )}

                          {order.status === "accepted" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "confirmed")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2 text-teal-500" />
                                Confirm Order
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "cancelled")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                Cancel Order
                              </DropdownMenuItem>
                            </>
                          )}

                          {order.status === "confirmed" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "preparing")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2 text-orange-500" />
                                Start Preparing
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "cancelled")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                Cancel Order
                              </DropdownMenuItem>
                            </>
                          )}

                          {order.status === "preparing" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "ready")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2 text-purple-500" />
                                Mark Ready for Pickup
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "cancelled")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                Cancel Order
                              </DropdownMenuItem>
                            </>
                          )}

                          {order.status === "ready" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateOrderStatus(order.id, "delivered")
                                }
                                disabled={updatingOrders.has(order.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                                Mark as Delivered
                              </DropdownMenuItem>
                            </>
                          )}

                          {order.status === "delivered" && (
                            <>
                              {order.delivery_issue_reported === true &&
                              order.customer_verified !== true ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const issueText =
                                        order.issue_description ||
                                        "Customer reported delivery issue";
                                      const timestamp =
                                        order.issue_report_timestamp
                                          ? new Date(
                                              order.issue_report_timestamp
                                            ).toLocaleString()
                                          : "Unknown time";

                                      toast.success(
                                        `Issue Details: ${issueText} (Reported: ${timestamp})`,
                                        {
                                          duration: 8000,
                                          icon: "ℹ️",
                                        }
                                      );
                                    }}
                                    disabled={updatingOrders.has(order.id)}
                                  >
                                    <Eye className="w-4 h-4 mr-2 text-amber-500" />
                                    View Issue Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      resolveDeliveryIssue(order.id)
                                    }
                                    disabled={
                                      updatingOrders.has(order.id) ||
                                      order.issue_resolved
                                    }
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                    {order.issue_resolved
                                      ? "Issue Resolved ✓"
                                      : "Mark Issue Resolved"}
                                  </DropdownMenuItem>
                                </>
                              ) : order.customer_verified === true ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateOrderStatus(order.id, "completed")
                                  }
                                  disabled={updatingOrders.has(order.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                  Complete Order
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => {
                                    // Send reminder to customer
                                    sendVerificationReminder(order.id);
                                  }}
                                  disabled={updatingOrders.has(order.id)}
                                >
                                  <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
                                  Send Verification Reminder
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
