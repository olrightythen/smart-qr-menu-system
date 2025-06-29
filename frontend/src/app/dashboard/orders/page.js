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
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
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
      // Debug all incoming messages to identify the correct structure
      console.log("WebSocket message received in orders page:", data);

      // Extract the actual notification data, handling both direct and nested formats
      const notificationData =
        data.type === "vendor_notification" && data.data ? data.data : data;

      const notificationType = notificationData.type;
      const orderData = notificationData.data || {};

      // Handle different notification types
      if (notificationType === "new_order") {
        console.log("New order received via WebSocket:", notificationData);
        fetchOrders();
        toast.success("New order received! Refreshing order list...");
      } else if (notificationType === "order_status") {
        console.log("Order status updated via WebSocket:", notificationData);

        // If we have the order details, update it directly without a full refetch
        if (orderData.order_id && orderData.status) {
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === orderData.order_id
                ? { ...order, status: orderData.status }
                : order
            )
          );
        } else {
          // If we don't have complete data, do a full refresh
          fetchOrders();
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
  }, [user?.id, token, fetchOrders]);

  // Listen for notification changes that might affect orders
  useEffect(() => {
    const orderNotifications = notifications.filter(
      (n) => n.type === "new_order" || n.type === "order_status"
    );

    if (orderNotifications.length > 0) {
      fetchOrders();
    }
  }, [notifications, fetchOrders]);

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

        toast.success(
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

  // Memoized filter function for better performance
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
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
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_STYLES[order.status] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {formatStatus(order.status)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {order.timestamp
                        ? new Date(order.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A"}
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={updatingOrders.has(order.id)}
                          >
                            {updatingOrders.has(order.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                            <span className="sr-only">Open menu</span>
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
                            <DropdownMenuItem
                              onClick={() =>
                                updateOrderStatus(order.id, "completed")
                              }
                              disabled={updatingOrders.has(order.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                              Mark as Completed
                            </DropdownMenuItem>
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
