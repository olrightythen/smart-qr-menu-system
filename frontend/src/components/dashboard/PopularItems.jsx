"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";

export default function PopularItems() {
  const [popularItems, setPopularItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [windowWidth, setWindowWidth] = useState(0);
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Track window width for responsive adjustments
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  // Theme-aware colors
  const colors = useMemo(
    () => ({
      barFill: isDark ? "rgba(255, 138, 76, 0.8)" : "rgba(255, 138, 76, 0.8)",
      barStroke: isDark ? "rgba(255, 138, 76, 1)" : "rgba(255, 138, 76, 1)",
      gridStroke: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      tooltipBg: isDark
        ? "rgba(30, 30, 30, 0.95)"
        : "rgba(255, 255, 255, 0.95)",
      tooltipBorder: isDark ? "#444" : "#eaeaea",
      tooltipText: isDark ? "#fff" : "#333",
      axisColor: isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)",
      rankBg: isDark ? "rgba(255, 138, 76, 0.2)" : "rgba(255, 138, 76, 0.15)",
      rankText: isDark ? "rgba(255, 138, 76, 1)" : "rgba(255, 138, 76, 1)",
      itemBg: isDark ? "rgba(50, 50, 50, 0.3)" : "rgba(250, 250, 250, 0.8)",
      itemBgHover: isDark ? "rgba(60, 60, 60, 0.5)" : "rgba(245, 245, 245, 1)",
      emptyIconColor: isDark
        ? "rgba(255, 138, 76, 0.5)"
        : "rgba(255, 138, 76, 0.7)",
    }),
    [isDark]
  );

  // Generate unique gradient ID
  const gradientId = useMemo(
    () => `popularItemsGradient-${Math.random().toString(36).substring(2, 9)}`,
    []
  );

  useEffect(() => {
    const fetchPopularItems = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `http://localhost:8000/api/menu/${user.id}/sort/?sort_by=popularity&order=desc&limit=5`,
          {
            headers: {
              Authorization: `Token ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch popular items");
        }

        const data = await response.json();
        setPopularItems(data.items.slice(0, 5)); // Take top 5 items
      } catch (err) {
        console.error("Error fetching popular items:", err);
        setError("Couldn't load popular items");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularItems();
  }, [user, token]);

  // Prepare chart data for Recharts with responsive name truncation
  const chartData = useMemo(() => {
    const maxNameLength = isMobile ? 8 : isTablet ? 10 : 12;

    return popularItems.map((item) => ({
      name: item.name,
      orders: item.popularity || 0,
      shortName:
        item.name.length > maxNameLength
          ? `${item.name.substring(0, maxNameLength - 2)}...`
          : item.name,
    }));
  }, [popularItems, isMobile, isTablet]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = popularItems.find((item) => item.name === label);

      return (
        <div
          className="p-2 sm:p-3 shadow-lg rounded-lg border transition-all max-w-[200px] sm:max-w-none"
          style={{
            backgroundColor: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            color: colors.tooltipText,
          }}
        >
          <p className="font-medium text-xs sm:text-sm mb-1 break-words">
            {label}
          </p>
          <p className="text-xs sm:text-sm">
            <span className="font-semibold">{payload[0].value}</span> orders
          </p>
          {item && <p className="text-xs mt-1">Price: Rs. {item.price}</p>}
        </div>
      );
    }

    return null;
  };

  // Responsive chart height
  const chartHeight = isMobile ? 250 : isTablet ? 280 : 300;

  // Responsive margins
  const chartMargins = {
    top: 20,
    right: isMobile ? 5 : 10,
    left: isMobile ? 5 : 10,
    bottom: isMobile ? 40 : 30,
  };

  return (
    <div className="bg-card rounded-xl border border-border h-full shadow-sm transition-all hover:shadow-md">
      <div className="p-3 sm:p-4 lg:p-6 border-b border-border flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold">Popular Items</h2>
        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
      </div>

      <div className="p-3 sm:p-4 lg:p-6">
        {isLoading ? (
          <div
            className="flex items-center justify-center"
            style={{ height: `${chartHeight}px` }}
          >
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height: `${chartHeight}px` }}
          >
            <div className="flex flex-col items-center">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 mb-2 text-orange-500/70" />
              <p className="text-sm sm:text-base text-center">{error}</p>
            </div>
          </div>
        ) : popularItems.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-muted-foreground"
            style={{ height: `${chartHeight}px` }}
          >
            <TrendingUp
              className="h-8 w-8 sm:h-12 sm:w-12 mb-4"
              style={{ color: colors.emptyIconColor }}
            />
            <p className="font-medium text-sm sm:text-base">
              No order data available yet
            </p>
            <p className="text-xs sm:text-sm mt-2 text-center max-w-[250px] px-4">
              Popular items will appear here once you have orders
            </p>
          </div>
        ) : (
          <>
            <div style={{ height: chartHeight }}>
              <svg style={{ height: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="rgba(255, 138, 76, 0.9)"
                      stopOpacity={0.9}
                    />
                    <stop
                      offset="95%"
                      stopColor="rgba(255, 138, 76, 0.7)"
                      stopOpacity={0.7}
                    />
                  </linearGradient>
                </defs>
              </svg>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={chartMargins}
                  barCategoryGap={isMobile ? 8 : 15}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={colors.gridStroke}
                  />
                  <XAxis
                    dataKey="shortName"
                    angle={isMobile ? -45 : -45}
                    textAnchor="end"
                    height={isMobile ? 50 : 60}
                    tickMargin={isMobile ? 5 : 10}
                    tick={{
                      fill: colors.axisColor,
                      fontSize: isMobile ? 10 : 12,
                    }}
                    axisLine={{ stroke: colors.gridStroke }}
                    tickLine={{ stroke: colors.gridStroke }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fill: colors.axisColor,
                      fontSize: isMobile ? 10 : 12,
                    }}
                    axisLine={{ stroke: colors.gridStroke }}
                    tickLine={{ stroke: colors.gridStroke }}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                  />
                  <Bar
                    dataKey="orders"
                    fill={`url(#${gradientId})`}
                    stroke={colors.barStroke}
                    strokeWidth={1}
                    radius={[isMobile ? 4 : 6, isMobile ? 4 : 6, 0, 0]}
                    animationDuration={1500}
                  >
                    <LabelList
                      dataKey="orders"
                      position="top"
                      fill={colors.axisColor}
                      fontSize={isMobile ? 9 : 11}
                      fontWeight={500}
                      offset={5}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 sm:mt-6 lg:mt-8 space-y-2 sm:space-y-3">
              {popularItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 sm:p-3 rounded-lg transition-all hover:scale-[1.01] cursor-default"
                  style={{
                    backgroundColor: colors.itemBg,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.itemBgHover;
                    e.currentTarget.style.transform = "scale(1.01)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.itemBg;
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div
                      className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full font-medium text-xs sm:text-sm flex-shrink-0"
                      style={{
                        backgroundColor: colors.rankBg,
                        color: colors.rankText,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Rs. {item.price}
                      </p>
                    </div>
                  </div>
                  <div className="text-right bg-orange-500/10 py-1 px-2 sm:px-3 rounded-full flex-shrink-0">
                    <span className="font-semibold text-orange-600 text-sm">
                      {item.popularity || 0}
                    </span>
                    <span className="text-xs text-orange-600 ml-1">
                      {isMobile ? "" : "orders"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
