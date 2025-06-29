"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  removeNotification: () => {},
  clearNotifications: () => {},
  connectionStatus: "Disconnected",
});

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { user, token } = useAuth();
  const audioRef = useRef(null);

  const handleWebSocketMessage = useCallback(
    (data) => {
      console.log("Received WebSocket notification:", data);

      try {
        // Validate required fields
        if (!data || !data.title || typeof data.title !== "string") {
          console.warn("Invalid notification data received:", data);
          return;
        }

        const notification = {
          id:
            data.id ||
            `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: data.type || "info",
          title: data.title,
          message: data.message || "",
          timestamp: data.timestamp || new Date().toISOString(),
          created_at: data.timestamp || new Date().toISOString(),
          read: false,
          data: data.data || {},
        };

        setNotifications((prev) => {
          // Check if notification already exists to prevent duplicates
          const exists = prev.some(
            (n) =>
              n.id === notification.id ||
              (n.title === notification.title &&
                n.message === notification.message &&
                Math.abs(
                  new Date(n.created_at || n.timestamp) -
                    new Date(notification.created_at)
                ) < 5000)
          );

          if (exists) {
            console.log(
              "Duplicate notification detected, skipping:",
              notification.id
            );
            return prev;
          }

          return [notification, ...prev.slice(0, 49)]; // Keep last 50 notifications
        });

        // Show toast notification based on type
        if (data.type === "new_order") {
          toast.success(
            `🛒 New order #${data.data?.order_id || "Unknown"} received!`,
            {
              duration: 5000,
              icon: "🔔",
            }
          );
        } else if (data.type === "payment") {
          toast.success(
            `💰 Payment received for order #${
              data.data?.order_id || "Unknown"
            }`,
            {
              duration: 4000,
              icon: "💳",
            }
          );
        } else if (data.type === "order_status") {
          // Suppress status update toasts when on the orders page
          const isOnOrdersPage =
            typeof window !== "undefined" &&
            window.location.pathname.includes("/dashboard/orders");

          // Only show toast if not on orders page to avoid duplicates
          if (!isOnOrdersPage) {
            toast(
              `📋 Order #${data.data?.order_id || "Unknown"} status updated`,
              {
                duration: 4000,
                icon: "📋",
              }
            );
          } else {
            console.log(
              "Suppressed order status toast on orders page:",
              data.data?.order_id
            );
          }
        }

        // Play notification sound
        if (soundEnabled && audioRef.current) {
          audioRef.current.play().catch((error) => {
            console.warn("Could not play notification sound:", error);
          });
        }

        // Browser notification (if permission granted)
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(notification.title, {
              body: notification.message,
              icon: "/favicon.ico",
              tag: `notification_${notification.id}`,
              badge: "/favicon.ico",
            });
          } catch (error) {
            console.warn("Could not show browser notification:", error);
          }
        }
      } catch (error) {
        console.error("Error processing WebSocket notification:", error);
      }
    },
    [soundEnabled]
  );

  const { connectionStatus } = useWebSocket(handleWebSocketMessage);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (!user?.id || !token) return;

    try {
      const response = await fetch("http://localhost:8000/api/notifications/", {
        headers: {
          Authorization: `Token ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const serverNotifications = data.notifications || [];
        setNotifications(serverNotifications);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [user?.id, token]);

  // Load notifications on mount
  useEffect(() => {
    if (user?.id && token) {
      fetchNotifications();
    }
  }, [user?.id, token, fetchNotifications]);

  const addNotification = useCallback((notification) => {
    try {
      const newNotification = {
        id:
          notification.id ||
          `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        read: false,
        type: "info",
        ...notification,
      };

      setNotifications((prev) => [newNotification, ...prev.slice(0, 49)]);
    } catch (error) {
      console.error("Error adding notification:", error);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId) => {
      try {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          )
        );

        if (token) {
          await fetch(
            `http://localhost:8000/api/notifications/${notificationId}/`,
            {
              method: "POST",
              headers: {
                Authorization: `Token ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
        }
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    },
    [token]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, read: true }))
      );

      if (token) {
        await fetch("http://localhost:8000/api/notifications/bulk-actions/", {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "mark_all_read" }),
        });
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [token]);

  const removeNotification = useCallback(
    async (notificationId) => {
      try {
        setNotifications((prev) =>
          prev.filter((notification) => notification.id !== notificationId)
        );

        if (token) {
          await fetch(
            `http://localhost:8000/api/notifications/${notificationId}/`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Token ${token}`,
              },
            }
          );
        }
      } catch (error) {
        console.error("Error removing notification:", error);
      }
    },
    [token]
  );

  const clearNotifications = useCallback(async () => {
    try {
      setNotifications([]);

      if (token) {
        await fetch("http://localhost:8000/api/notifications/bulk-actions/", {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "clear_all" }),
        });
      }
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  }, [token]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        console.log("Notification permission:", permission);
      });
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
    connectionStatus,
    soundEnabled,
    setSoundEnabled,
    fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="auto">
        <source src="/notification-sound.mp3" type="audio/mpeg" />
        <source src="/notification-sound.wav" type="audio/wav" />
        <source src="/notification-sound.ogg" type="audio/ogg" />
      </audio>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};
