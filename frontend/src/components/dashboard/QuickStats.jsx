"use client";

import {
  ShoppingBag,
  Users,
  ArrowUpRight,
  Utensils,
  Loader2,
} from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCurrency } from "@/lib/utils";

export default function QuickStats() {
  const {
    totalOrders,
    activeItems,
    totalTables,
    totalRevenue,
    isLoading,
    error,
  } = useDashboardStats();

  // Define stats with dynamic data
  const stats = [
    {
      label: "Total Orders",
      value: isLoading ? "-" : totalOrders.toString(),
      icon: ShoppingBag,
      color: "text-blue-500",
      bg: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      label: "Active Items",
      value: isLoading ? "-" : activeItems.toString(),
      icon: Utensils,
      color: "text-green-500",
      bg: "bg-green-100 dark:bg-green-900/20",
    },
    {
      label: "Tables",
      value: isLoading ? "-" : totalTables.toString(),
      color: "text-purple-500",
      icon: Users,
      bg: "bg-purple-100 dark:bg-purple-900/20",
    },
    {
      label: "Revenue",
      value: isLoading ? "-" : formatCurrency(totalRevenue),
      icon: ArrowUpRight,
      color: "text-orange-500",
      bg: "bg-orange-100 dark:bg-orange-900/20",
    },
  ];

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl p-6 border border-border hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className={`${stat.bg} p-3 rounded-lg`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <>
                <div className="flex items-center">
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading...</span>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
