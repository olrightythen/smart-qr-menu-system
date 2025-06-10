"use client";

import { useState } from "react";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/Header";
import { NotificationProvider } from "@/context/NotificationContext";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-background">
        <DashboardSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
        />

        {/* Main content area - takes remaining space */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <DashboardHeader
            onMenuClick={toggleSidebar}
          />

          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
