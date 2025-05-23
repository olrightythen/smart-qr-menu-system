"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
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
  const { user, token } = useAuth();

  useEffect(() => {
    if (user?.id && token) {
      fetchRecentOrders();
    } else {
      setLoading(false);
    }
  }, [user, token]);

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
        items_text: order.items
          .map((item) => item.name)
          .join(", "),
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

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 md:p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">
              Loading orders...
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent orders found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left pb-3">Order ID</th>
                  <th className="text-left pb-3">Table No.</th>
                  <th className="text-left pb-3">Items</th>
                  <th className="text-left pb-3">Amount</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-left pb-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border">
                    <td className="py-3 pr-4 font-medium text-sm">
                      {order.order_id}
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      {order.table_no || "N/A"}
                    </td>
                    <td className="py-3 pr-4 text-sm max-w-[180px] truncate">
                      {order.items_text}
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      Rs. {parseFloat(order.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusStyles[order.status] || "bg-gray-100"
                        }`}
                      >
                        {formatStatus(order.status)}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {order.time_elapsed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 text-right">
          <Link
            href="/dashboard/orders"
            className="text-sm text-primary hover:underline"
          >
            View all orders
          </Link>
        </div>
      </div>
    </div>
  );
}
