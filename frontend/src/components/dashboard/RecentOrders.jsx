"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import Link from "next/link";

const statusStyles = {
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function RecentOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { user, token } = useAuth();
  const { notifications } = useNotifications();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (user?.id && token) {
      fetchRecentOrders();
    } else {
      setLoading(false);
    }
  }, [user, token]);

  // Auto-refresh orders when new order notifications are received
  useEffect(() => {
    const newOrderNotifications = notifications.filter(
      (n) => n.type === "new_order" && !n.read
    );

    if (newOrderNotifications.length > 0 && user?.id && token) {
      fetchRecentOrders();
    }
  }, [notifications, user?.id, token]);

  const fetchRecentOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:8000/api/orders/${user.id}/`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch orders");

      const data = await response.json();

      // Process the data to add items_text
      const processedOrders = data.orders.map((order) => ({
        ...order,
        items_text: order.items.map((item) => item.name).join(", "),
      }));

      // Only take the 5 most recent orders
      setOrders(processedOrders.slice(0, 5));
    } catch (error) {
      console.error("Error fetching recent orders:", error);
    } finally {
      setLoading(false);
    }
  };

  // Format the status for display
  const formatStatus = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Check if order is newly received (within last 5 minutes)
  const isNewOrder = (timestamp) => {
    const orderTime = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = (now - orderTime) / (1000 * 60);
    return diffInMinutes <= 5;
  };

  // Mobile card view
  const MobileOrderCard = ({ order }) => (
    <div
      className={`bg-background border rounded-lg p-4 space-y-3 ${
        isNewOrder(order.timestamp)
          ? "border-orange-300 bg-orange-50 dark:bg-orange-900/10"
          : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center">
          {order.order_id}
          {isNewOrder(order.timestamp) && (
            <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
              New
            </span>
          )}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            statusStyles[order.status] || "bg-gray-100"
          }`}
        >
          {formatStatus(order.status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Table:</span>
          <span className="ml-1 font-medium">{order.table_name || "N/A"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Amount:</span>
          <span className="ml-1 font-medium">
            Rs. {parseFloat(order.total_amount).toFixed(2)}
          </span>
        </div>
      </div>

      <div>
        <span className="text-muted-foreground text-sm">Items:</span>
        <p className="text-sm mt-1 line-clamp-2">{order.items_text}</p>
      </div>

      <div className="text-xs text-muted-foreground">{order.time_elapsed}</div>
    </div>
  );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 sm:p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Recent Orders</h2>
          {loading && (
            <div className="w-4 h-4 border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">
              Loading orders...
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm sm:text-base">No recent orders found</p>
          </div>
        ) : (
          <>
            {/* Mobile view - Card layout */}
            <div className="md:hidden space-y-3">
              {orders.map((order) => (
                <MobileOrderCard key={order.id} order={order} />
              ))}
            </div>

            {/* Desktop view - Table layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left pb-3">Order ID</th>
                    <th className="text-left pb-3">Table</th>
                    <th className="text-left pb-3 hidden lg:table-cell">
                      Items
                    </th>
                    <th className="text-left pb-3">Amount</th>
                    <th className="text-left pb-3">Status</th>
                    <th className="text-left pb-3 hidden xl:table-cell">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className={`border-b border-border ${
                        isNewOrder(order.timestamp)
                          ? "bg-orange-50 dark:bg-orange-900/10"
                          : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium text-sm">
                        <div className="flex items-center">
                          {order.order_id}
                          {isNewOrder(order.timestamp) && (
                            <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                              New
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {order.table_name || "N/A"}
                      </td>
                      <td className="py-3 pr-4 text-sm max-w-[120px] lg:max-w-[180px] truncate hidden lg:table-cell">
                        {order.items_text}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        Rs. {parseFloat(order.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            statusStyles[order.status] || "bg-gray-100"
                          }`}
                        >
                          {formatStatus(order.status)}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground hidden xl:table-cell">
                        {order.time_elapsed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-4 text-right">
          <Link
            href="/dashboard/orders"
            className="text-sm text-primary hover:underline inline-block"
          >
            View all orders
          </Link>
        </div>
      </div>
    </div>
  );
}
