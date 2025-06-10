"use client";

import React from "react";
import { X, Bell, Check, Trash2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const NotificationPanel = ({
  notifications,
  onClose,
  onMarkAsRead,
  onDelete,
  onMarkAllAsRead,
  onClearAll,
}) => {
  const formatTimeAgo = (timestamp) => {
    try {
      if (!timestamp) return "Unknown time";

      const now = new Date();
      const notificationTime = new Date(timestamp);

      // Check if the date is valid
      if (isNaN(notificationTime.getTime())) {
        return "Unknown time";
      }

      const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));

      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;

      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } catch (error) {
      console.error("Error formatting time:", error);
      return "Unknown time";
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "new_order":
        return "🛒";
      case "order_status":
        return "📋";
      case "payment":
        return "💳";
      case "system":
        return "⚙️";
      default:
        return "📢";
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "new_order":
        return "border-l-blue-500";
      case "order_status":
        return "border-l-orange-500";
      case "payment":
        return "border-l-green-500";
      case "system":
        return "border-l-purple-500";
      default:
        return "border-l-gray-500";
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Notifications</h3>
          {notifications.length > 0 && (
            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-accent rounded-md transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Action Buttons */}
      {notifications.length > 0 && (
        <div className="p-3 border-b border-border bg-muted/30">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              className="text-xs h-7"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark All Read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-xs h-7 text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No notifications yet</p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              You'll see order updates and alerts here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 hover:bg-accent/50 transition-colors border-l-4",
                  getNotificationColor(notification.type || "default"),
                  !notification.read && "bg-accent/20"
                )}
              >
                <div className="flex items-start space-x-3">
                  {/* Notification Icon */}
                  <div className="flex-shrink-0 text-lg">
                    {getNotificationIcon(notification.type || "default")}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-2">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>

                        {/* Additional data display for order notifications */}
                        {notification.data &&
                          notification.type === "new_order" &&
                          notification.data.items && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium">Items: </span>
                              {notification.data.items
                                .slice(0, 2)
                                .map((item) => item.name)
                                .join(", ")}
                              {notification.data.items.length > 2 &&
                                ` +${notification.data.items.length - 2} more`}
                            </div>
                          )}

                        <p className="text-xs text-muted-foreground mt-2">
                          {formatTimeAgo(
                            notification.created_at || notification.timestamp
                          )}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 ml-2">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onMarkAsRead && onMarkAsRead(notification.id)
                            }
                            className="h-6 w-6"
                            title="Mark as read"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete && onDelete(notification.id)}
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          title="Delete notification"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Order details for payment/order notifications */}
                    {notification.data?.order_id && (
                      <div className="mt-2 text-xs text-blue-600">
                        Order #{notification.data.order_id}
                        {notification.data.total_amount && (
                          <span className="ml-2">
                            • Rs. {notification.data.total_amount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
