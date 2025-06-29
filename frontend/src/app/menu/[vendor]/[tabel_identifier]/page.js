"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Clock, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { useParams, useRouter } from "next/navigation";
import { CartProvider } from "@/context/CartContext";
import MenuContent from "@/components/menu/MenuContent";

// Main wrapper that provides cart context
export default function MenuPage() {
  const params = useParams();
  const router = useRouter();
  const { vendor, tabel_identifier } = params;

  const [categories, setCategories] = useState(["All"]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendorInfo, setVendorInfo] = useState(null);
  const [tableInfo, setTableInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] =
    useState(false);
  const [tableStatus, setTableStatus] = useState(null); // Track table booking status
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modify the fetchRecommendations function
  const fetchRecommendations = async (cartItemIds) => {
    try {
      // If cart is empty, clear recommendations immediately
      if (!cartItemIds || cartItemIds.length === 0) {
        setRecommendations([]);
        return;
      }

      setIsLoadingRecommendations(true);

      const response = await fetch(
        `http://localhost:8000/api/menu/${vendor}/recommendations/?items=${cartItemIds.join(
          ","
        )}&limit=3`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch recommendations");
      }

      const data = await response.json();

      setRecommendations(
        data.recommendations.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price),
          image_url: item.image_url || null,
          available: item.is_available,
          similarity_score: item.similarity_score || null,
        }))
      );
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setRecommendations([]); // Clear recommendations on error
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // Fetch menu data
  const fetchMenuData = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Check table availability using qr_code identifier
      const tableResponse = await fetch(
        `http://localhost:8000/api/public-table/${vendor}/${tabel_identifier}/`
      );

      if (!tableResponse.ok) {
        throw new Error("Table not found or inactive");
      }

      const tableData = await tableResponse.json();

      if (!tableData.is_active) {
        setError(
          "This table is currently unavailable. Please contact the restaurant."
        );
        return;
      }

      // Check if table has an active order
      if (tableData.has_active_order) {
        // Check if the current user is the one with the active order
        const currentOrderId = localStorage.getItem("current_order_id");
        const lastOrderTable = localStorage.getItem("last_order_table");
        const lastOrderVendor = localStorage.getItem("last_order_vendor");

        // Allow access if this is the same user's order
        if (
          currentOrderId === tableData.active_order_id?.toString() ||
          (lastOrderTable === tabel_identifier && lastOrderVendor === vendor)
        ) {
          console.log("User has active order at this table, allowing access");
        } else {
          // Table is booked by another user
          setTableStatus({
            isBooked: true,
            activeOrderId: tableData.active_order_id,
          });
          setError(null); // Clear error since this is not an error, just booked
          setLoading(false);
          return;
        }
      } else {
        // No active order, clear any previous booked status
        console.log("No active order detected, clearing table booking status");
        setTableStatus(null);

        // Clear table booking info from localStorage if table is free
        const lastOrderTable = localStorage.getItem("last_order_table");
        const lastOrderVendor = localStorage.getItem("last_order_vendor");
        if (lastOrderTable === tabel_identifier && lastOrderVendor === vendor) {
          console.log("Clearing localStorage table booking info");
          localStorage.removeItem("last_order_table");
          localStorage.removeItem("last_order_vendor");
          localStorage.removeItem("current_order_id");
        }
      }

      // Store table information
      setTableInfo({
        id: tableData.table_id,
        name: tableData.name,
        qr_code: tableData.qr_code,
        is_active: tableData.is_active,
        has_active_order: tableData.has_active_order,
        active_order_id: tableData.active_order_id,
      });

      // Store current table and vendor info for future reference
      localStorage.setItem("last_order_table", tabel_identifier);
      localStorage.setItem("last_order_vendor", vendor);

      const response = await fetch(
        `http://localhost:8000/api/public-menu/${vendor}/`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch menu data");
      }

      const data = await response.json();

      // Set vendor information
      if (data.vendor_info) {
        setVendorInfo(data.vendor_info);
        document.title = `Menu - ${data.vendor_info.restaurant_name}`;
      }

      // Extract all menu items from categories
      const allItems = [];
      const categorySet = new Set(["All"]);

      data.categories.forEach((category) => {
        category.items.forEach((item) => {
          // Add category to our unique set
          categorySet.add(category.name);

          // Format the item for our app
          allItems.push({
            id: item.id,
            name: item.name,
            category: category.name,
            price: parseFloat(item.price),
            description: item.description || "",
            image: item.image_url || null,
            available: item.is_available,
          });
        });
      });

      setMenuItems(allItems);
      setCategories(Array.from(categorySet));
    } catch (err) {
      console.error("Error fetching menu data:", err);
      setError("Failed to load menu. Please try again.");
      toast.error("Failed to load menu. Please try again.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // WebSocket connection to listen for table order updates
  const connectTableWebSocket = () => {
    if (!vendor || !tabel_identifier) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const wsBaseUrl = getWsBaseUrl();
      const wsUrl = `${wsBaseUrl}/ws/table/${vendor}/${tabel_identifier}/`;

      console.log("Connecting to table WebSocket:", wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("Table WebSocket connected");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Table WebSocket message:", data);

          if (data.type === "table_status_update") {
            // Refresh table data when we get updates
            console.log("Table status update received, refreshing data");
            fetchMenuData();
          } else if (data.type === "order_status_update") {
            // Check if this order affects our table
            if (
              data.data &&
              ["completed", "cancelled", "rejected"].includes(data.data.status)
            ) {
              console.log(
                "Order completed/cancelled/rejected, refreshing table status"
              );
              fetchMenuData();
            }
          }
        } catch (error) {
          console.error("Error parsing table WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log("Table WebSocket disconnected:", event.code, event.reason);

        // Try to reconnect after a delay if not intentionally closed
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect table WebSocket...");
            connectTableWebSocket();
          }, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("Table WebSocket error:", error);
      };
    } catch (error) {
      console.error("Error creating table WebSocket:", error);
    }
  };

  // Clean up WebSocket connections
  const disconnectTableWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Intentional disconnect");
      wsRef.current = null;
    }
  };

  // Fetch menu data when component mounts
  useEffect(() => {
    fetchMenuData();

    // Listen for localStorage changes (when order is completed in another tab)
    const handleStorageChange = (e) => {
      console.log("localStorage change detected:", e.key, e.newValue);

      // If table booking info is cleared, refresh to check availability
      if (e.key === "last_order_table" && e.newValue === null) {
        console.log("Table booking cleared, refreshing menu data");
        fetchMenuData();
      }

      // If current order is cleared, refresh to check availability
      if (e.key === "current_order_id" && e.newValue === null) {
        console.log("Current order cleared, refreshing menu data");
        fetchMenuData();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Listen for page visibility changes to refresh when user returns
    const handleVisibilityChange = () => {
      if (!document.hidden && tableStatus?.isBooked) {
        console.log(
          "Page became visible and table is booked, checking availability"
        );
        fetchMenuData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [vendor, tabel_identifier]);

  // Auto-refresh when table is booked to check if it becomes available
  useEffect(() => {
    let refreshInterval;

    if (tableStatus?.isBooked) {
      // Check every 3 seconds if table becomes available (more frequent for cancelled orders)
      refreshInterval = setInterval(() => {
        console.log("Checking if table is still booked...");
        fetchMenuData();
      }, 3000);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [tableStatus?.isBooked]);

  // Handle navigation to order tracking
  const handleViewOrderTracking = () => {
    if (tableStatus?.activeOrderId) {
      localStorage.setItem(
        "current_order_id",
        tableStatus.activeOrderId.toString()
      );
      router.push("/order-tracking");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500" />
          <p className="mt-4 text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  // Show table booked message
  if (tableStatus?.isBooked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <ChefHat className="h-16 w-16 mx-auto text-orange-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              Table Currently Occupied
            </h2>
            <p className="text-muted-foreground mb-4">
              This table has an active order in progress. Please wait for the
              current order to be completed.
            </p>
            <div className="flex items-center justify-center gap-2 text-orange-600 font-medium">
              <Clock className="h-5 w-5" />
              <span>Estimated wait time: 15-30 minutes</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => fetchMenuData(true)}
              disabled={isRefreshing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check Availability Again"
              )}
            </Button>

            {tableStatus.activeOrderId && (
              <Button
                onClick={handleViewOrderTracking}
                variant="outline"
                className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                Track Current Order
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              This page will automatically refresh every 3 seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Menu Unavailable</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button
            onClick={fetchMenuData}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CartProvider
      vendorId={vendor}
      tableNo={tabel_identifier}
      onUpdateRecommendations={fetchRecommendations}
    >
      <MenuContent
        categories={categories}
        menuItems={menuItems}
        setMenuItems={setMenuItems}
        vendorInfo={vendorInfo}
        vendor={vendor}
        tabel_identifier={tabel_identifier}
        tableInfo={tableInfo}
        recommendations={recommendations}
        setRecommendations={setRecommendations}
        fetchMenuData={fetchMenuData}
        isLoadingRecommendations={isLoadingRecommendations}
      />
    </CartProvider>
  );
}
