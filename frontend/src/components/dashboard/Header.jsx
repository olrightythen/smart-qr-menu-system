"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Bell, ChevronDown, Menu, Moon, Sun, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { NotificationPanel } from "../notifications/NotificationPanel";
import OrderNotification from "../notifications/OrderNotification";
import { useNotifications } from "@/context/NotificationContext";
import Link from "next/link";

const DashboardHeader = ({ onMenuClick }) => {
  const { theme, toggleTheme } = useTheme();
  const { logout, user, token } = useAuth();
  const [logo, setLogo] = useState(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [orderNotifications, setOrderNotifications] = useState([]);
  const router = useRouter();

  // Memoize restaurant name to prevent re-renders
  const restaurantName = useMemo(() => {
    return user?.restaurant_name || "No Name";
  }, [user?.restaurant_name]);

  // Use notification context
  const {
    notifications,
    unreadCount,
    markAsRead,
    removeNotification,
    markAllAsRead,
    clearNotifications,
    connectionStatus,
  } = useNotifications();

  // Optimized logo fetching with caching
  const fetchLogo = useCallback(async () => {
    if (!user?.id || !token || logoLoaded) return;

    try {
      const response = await fetch(`http://localhost:8000/api/vendor/${user.id}/`, {
        headers: {
          Authorization: `Token ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch vendor data");
      }

      const data = await response.json();
      setLogo(data.logo || null);
      setConnectionError(false);
    } catch (error) {
      console.error("Error fetching logo:", error);
      setConnectionError(true);
    } finally {
      setLogoLoaded(true);
    }
  }, [user?.id, token, logoLoaded]);

  // Memoized connection status to prevent flickering
  const ConnectionStatus = useMemo(() => {
    const isWebSocketConnected = connectionStatus === "Connected";
    
    if (connectionError) {
      return (
        <div className="flex items-center space-x-2 text-red-600 text-sm">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="hidden sm:inline">Backend Disconnected</span>
        </div>
      );
    }

    if (!logoLoaded && user?.id && token) {
      return (
        <div className="flex items-center space-x-2 text-blue-600 text-sm">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="hidden sm:inline">Loading...</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2 text-sm">
        <div
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isWebSocketConnected
              ? "bg-green-500"
              : "bg-yellow-500 animate-pulse"
          }`}
        ></div>
        <span
          className={`hidden sm:inline transition-colors duration-300 ${
            isWebSocketConnected ? "text-green-600" : "text-yellow-600"
          }`}
        >
          {connectionStatus}
        </span>
      </div>
    );
  }, [connectionStatus, connectionError, logoLoaded, user?.id, token]);

  // Memoized logo display to prevent flickering
  const LogoDisplay = useMemo(() => {
    if (!logoLoaded && user?.id && token) {
      return (
        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <span className="text-orange-500 text-xs animate-pulse">...</span>
        </div>
      );
    }

    if (logo) {
      return (
        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden">
          <img
            src={logo}
            alt="Logo"
            className="w-full h-full object-cover transition-opacity duration-300"
            onLoad={() => {
              // Ensure smooth loading
            }}
            onError={() => {
              console.warn("Logo failed to load");
              setLogo(null);
            }}
          />
        </div>
      );
    }

    return (
      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
        <span className="text-orange-500 text-xs font-medium">
          {restaurantName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }, [logo, logoLoaded, user?.id, token, restaurantName]);

  // Optimized notification handling
  useEffect(() => {
    const newOrderNotifications = notifications.filter(
      (n) => n.type === "new_order" && !n.read && 
      !orderNotifications.some(on => on.id === n.id)
    );

    if (newOrderNotifications.length > 0) {
      setOrderNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const uniqueNew = newOrderNotifications.filter(n => !existingIds.has(n.id));
        return [...prev, ...uniqueNew];
      });
    }
  }, [notifications]);

  const handleOrderNotificationClose = useCallback((notificationId) => {
    setOrderNotifications(prev => prev.filter(n => n.id !== notificationId));
    markAsRead(notificationId);
  }, [markAsRead]);

  const handleOrderAction = useCallback((orderId, action) => {
    console.log(`Order ${orderId} ${action}`);
    // Additional logic for order actions can be added here
  }, []);

  // Only fetch logo once when user and token are available
  useEffect(() => {
    if (user?.id && token && !logoLoaded) {
      fetchLogo();
    }
  }, [user?.id, token, fetchLogo, logoLoaded]);

  const handleLogout = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  return (
    <>
      <header className="h-16 bg-card border-b border-border sticky top-0 z-30">
        <div className="h-full px-4 flex items-center justify-between">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-accent rounded-md transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center space-x-4 flex-1 px-4">
            <div className="text-lg font-medium truncate">{restaurantName}</div>
            {ConnectionStatus}
          </div>

          <div className="flex items-center space-x-2">
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

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative transition-colors"
                onClick={toggleNotifications}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-in fade-in duration-200">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <NotificationPanel
                  notifications={notifications}
                  onClose={() => setShowNotifications(false)}
                  onMarkAsRead={markAsRead}
                  onDelete={removeNotification}
                  onMarkAllAsRead={markAllAsRead}
                  onClearAll={clearNotifications}
                />
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 transition-colors">
                  {LogoDisplay}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500" onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Order Notification Popups */}
      {orderNotifications.map((notification) => (
        <OrderNotification
          key={notification.id}
          notification={notification}
          onClose={handleOrderNotificationClose}
          onAction={handleOrderAction}
        />
      ))}
    </>
  );
};

export default DashboardHeader;
