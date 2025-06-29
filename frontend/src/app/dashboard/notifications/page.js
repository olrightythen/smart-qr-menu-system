"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import {
  Bell,
  Check,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Info,
  DollarSign,
  ShoppingBag,
  Clock,
  Eye,
  EyeOff,
  CheckSquare,
} from "lucide-react";

// Simple date formatting function
const formatTimeAgo = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
};

export default function NotificationsPage() {
  const { token } = useAuth();
  const {
    notifications: contextNotifications,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    removeNotification,
    fetchNotifications,
  } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, unread, read
  const [typeFilter, setTypeFilter] = useState("all"); // all, new_order, payment, order_status, info
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Get notification type icon
  const getNotificationIcon = (type) => {
    switch (type) {
      case "new_order":
        return (
          <ShoppingBag className="w-5 h-5 text-green-600 dark:text-green-400" />
        );
      case "payment":
        return (
          <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        );
      case "order_status":
        return (
          <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        );
      default:
        return <Info className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  // Get notification type badge
  const getTypeBadge = (type) => {
    const badges = {
      new_order: {
        label: "New Order",
        color:
          "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
      },
      payment: {
        label: "Payment",
        color:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
      },
      order_status: {
        label: "Status Update",
        color:
          "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
      },
      info: {
        label: "Info",
        color: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300",
      },
    };

    const badge = badges[type] || badges.info;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
      >
        {badge.label}
      </span>
    );
  };

  // Filter notifications based on current filters
  const filteredNotifications = contextNotifications.filter((notification) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && !notification.read) ||
      (filter === "read" && notification.read);

    const matchesType =
      typeFilter === "all" || notification.type === typeFilter;

    const matchesSearch =
      searchTerm === "" ||
      notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesType && matchesSearch;
  });

  // Handle bulk actions
  const handleBulkMarkRead = async () => {
    if (selectedNotifications.length > 0) {
      // Mark selected as read
      for (const id of selectedNotifications) {
        await markAsRead(id);
      }
      setSelectedNotifications([]);
    } else {
      // Mark all as read
      await markAllAsRead();
    }
    setShowBulkActions(false);
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length > 0) {
      // Delete selected
      for (const id of selectedNotifications) {
        await removeNotification(id);
      }
      setSelectedNotifications([]);
    } else {
      // Clear all
      await clearNotifications();
    }
    setShowBulkActions(false);
  };

  // Toggle notification selection
  const toggleNotificationSelection = (id) => {
    setSelectedNotifications((prev) =>
      prev.includes(id) ? prev.filter((nId) => nId !== id) : [...prev, id]
    );
  };

  // Select all filtered notifications
  const selectAllFiltered = () => {
    setSelectedNotifications(filteredNotifications.map((n) => n.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedNotifications([]);
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
      setLoading(false);
    }
  }, [token, fetchNotifications]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = contextNotifications.filter((n) => !n.read).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center space-x-3 mb-4 sm:mb-0">
          <Bell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Notifications
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {unreadCount > 0
                ? `${unreadCount} unread notifications`
                : "All caught up!"}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBulkMarkRead}
            className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center space-x-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
          <button
            onClick={() => setShowBulkActions(!showBulkActions)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              showBulkActions
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Select</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter:
              </span>
            </div>

            {/* Status Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="new_order">New Orders</option>
              <option value="payment">Payments</option>
              <option value="order_status">Status Updates</option>
              <option value="info">Information</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Panel */}
      {showBulkActions && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedNotifications.length > 0
                  ? `${selectedNotifications.length} selected`
                  : "Select notifications for bulk actions"}
              </span>
              {filteredNotifications.length > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={selectAllFiltered}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Select All
                  </button>
                  {selectedNotifications.length > 0 && (
                    <button
                      onClick={clearSelection}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedNotifications.length > 0 && (
              <div className="flex space-x-3">
                <button
                  onClick={handleBulkMarkRead}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Mark Selected Read</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Selected</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm || filter !== "all" || typeFilter !== "all"
                ? "No notifications match your filters"
                : "No notifications yet"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || filter !== "all" || typeFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "When you receive notifications, they'll appear here."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white dark:bg-gray-800 rounded-lg border transition-all duration-200 hover:shadow-md dark:hover:shadow-lg ${
                notification.read
                  ? "border-gray-200 dark:border-gray-700"
                  : "border-blue-200 dark:border-blue-600 shadow-sm"
              } ${
                selectedNotifications.includes(notification.id)
                  ? "ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400"
                  : ""
              }`}
            >
              <div className="p-6">
                <div className="flex items-start space-x-4">
                  {/* Selection Checkbox */}
                  {showBulkActions && (
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={() =>
                        toggleNotificationSelection(notification.id)
                      }
                      className="mt-1 w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700"
                    />
                  )}

                  {/* Notification Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3
                            className={`font-semibold ${
                              notification.read
                                ? "text-gray-700 dark:text-gray-300"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          {getTypeBadge(notification.type)}
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
                          )}
                        </div>

                        <p
                          className={`text-sm ${
                            notification.read
                              ? "text-gray-500 dark:text-gray-400"
                              : "text-gray-600 dark:text-gray-300"
                          } mb-3`}
                        >
                          {notification.message}
                        </p>

                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatTimeAgo(
                                notification.created_at ||
                                  notification.timestamp
                              )}
                            </span>
                          </span>

                          {notification.data?.order_id && (
                            <span className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
                              <ShoppingBag className="w-3 h-3" />
                              <span>Order #{notification.data.order_id}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                            title="Mark as read"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Read</span>
                          </button>
                        )}

                        <button
                          onClick={() => removeNotification(notification.id)}
                          className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Results Summary */}
      {filteredNotifications.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredNotifications.length} of{" "}
          {contextNotifications.length} notifications
        </div>
      )}
    </div>
  );
}
