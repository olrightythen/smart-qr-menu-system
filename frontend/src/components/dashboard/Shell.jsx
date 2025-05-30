"use client";

import { useState } from "react";
import DashboardSidebar from "./Sidebar";
import DashboardHeader from "./Header";

export default function DashboardShell({ children }) {
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

        {children}
      </div>
    </div>
  );
}
