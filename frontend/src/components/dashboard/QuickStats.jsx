"use client";

import { ShoppingBag, Users, ArrowUpRight, Utensils } from 'lucide-react';

const stats = [
  {
    label: "Total Orders",
    value: "156",
    change: "+12.5%",
    icon: ShoppingBag,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/20",
  },
  {
    label: "Active Items",
    value: "32",
    change: "+3.2%",
    icon: Utensils,
    color: "text-green-500",
    bg: "bg-green-100 dark:bg-green-900/20",
  },
  {
    label: "Customers",
    value: "2,450",
    change: "+18.7%",
    icon: Users,
    color: "text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-900/20",
  },
  {
    label: "Revenue",
    value: "₹15,245",
    change: "+8.4%",
    icon: ArrowUpRight,
    color: "text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-900/20",
  },
];

export default function QuickStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl p-6 border border-border hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className={`${stat.bg} p-3 rounded-lg`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <span className="text-sm font-medium text-green-500">{stat.change}</span>
          </div>
          
          <div className="mt-4">
            <h3 className="text-2xl font-bold">{stat.value}</h3>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}