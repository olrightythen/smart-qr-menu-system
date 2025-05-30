// Create: frontend/src/components/dashboard/SalesReport.jsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SalesReport() {
  const [salesData, setSalesData] = useState(null);
  const [timeframe, setTimeframe] = useState("week");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, token } = useAuth();

  useEffect(() => {
    if (user?.id && token) {
      fetchSalesData();
    }
  }, [user, token, timeframe]);

  const fetchSalesData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/sales-report/?timeframe=${timeframe}`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch sales data");
      }

      const data = await response.json();
      setSalesData(data);
    } catch (err) {
      console.error("Error fetching sales data:", err);
      setError("Could not load sales data");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatPercentage = (value) => {
    const num = parseFloat(value || 0);
    return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
  };

  // Add this function to format dates better
  const formatDate = (dateStr, timeframe) => {
    const date = new Date(dateStr);
    if (timeframe === "day") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
      });
    } else if (timeframe === "week") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading sales data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !salesData) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="text-center text-muted-foreground">
          <p>{error || "No sales data available"}</p>
          <Button onClick={fetchSalesData} className="mt-4" variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Sales Report</h2>
        </div>
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-background/50 rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span
                className={`text-xs font-medium ${
                  salesData.revenue_change >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {formatPercentage(salesData.revenue_change)}
              </span>
            </div>
            <h3 className="text-2xl font-bold">
              {formatCurrency(salesData.total_revenue)}
            </h3>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
              <span
                className={`text-xs font-medium ${
                  salesData.orders_change >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {formatPercentage(salesData.orders_change)}
              </span>
            </div>
            <h3 className="text-2xl font-bold">{salesData.total_orders}</h3>
            <p className="text-sm text-muted-foreground">Total Orders</p>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <span
                className={`text-xs font-medium ${
                  salesData.avg_order_change >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {formatPercentage(salesData.avg_order_change)}
              </span>
            </div>
            <h3 className="text-2xl font-bold">
              {formatCurrency(salesData.avg_order_value)}
            </h3>
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="h-5 w-5 text-orange-500" />
            </div>
            <h3 className="text-2xl font-bold">
              {salesData.peak_hour || "N/A"}
            </h3>
            <p className="text-sm text-muted-foreground">Peak Hour</p>
          </div>
        </div>

        {/* Daily Breakdown */}
        {salesData.daily_breakdown && salesData.daily_breakdown.length > 0 ? (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {timeframe === "day" ? "Today's Activity" : "Daily Breakdown"}
            </h3>
            <div className="space-y-2">
              {salesData.daily_breakdown.map((day, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
                >
                  <div>
                    <p className="font-medium">
                      {formatDate(day.date, timeframe)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {day.orders} orders
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(day.revenue)}
                    </p>
                    <div className="w-24 bg-muted rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            salesData.max_daily_revenue > 0
                              ? (day.revenue / salesData.max_daily_revenue) *
                                  100
                              : 0,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {timeframe === "day" ? "Today's Activity" : "Daily Breakdown"}
            </h3>
            <div className="text-center py-8 text-muted-foreground">
              <p>No sales data available for this {timeframe}</p>
              <p className="text-sm mt-1">
                Data will appear here once you have orders
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
