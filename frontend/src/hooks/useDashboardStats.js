import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export const useDashboardStats = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeItems: 0,
    totalTables: 0,
    totalRevenue: 0,
    isLoading: true,
    error: null,
  });

  const { user, token } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id || !token) {
        setStats((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:8000/api/vendor/${user.id}/dashboard-stats/`,
          {
            headers: {
              Authorization: `Token ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard statistics");
        }

        const data = await response.json();

        setStats({
          totalOrders: data.total_orders || 0,
          activeItems: data.active_items || 0,
          totalTables: data.total_tables || 0,
          totalRevenue: data.total_revenue || 0,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        setStats((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to load dashboard statistics",
        }));
      }
    };

    fetchStats();
  }, [user, token]);

  return stats;
};
