"use client";

import { useState } from "react";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/Header";
import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import PopularItems from "@/components/dashboard/PopularItems";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div
        className={`${
          isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
        } transition-all duration-300`}
      >
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Menu Item
            </Button>
          </div>

          <QuickStats />

          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <RecentOrders />
            </div>
            <div className="lg:col-span-2">
              <PopularItems />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
