"use client";

import QuickStats from "@/components/dashboard/QuickStats";
import RecentOrders from "@/components/dashboard/RecentOrders";
import PopularItems from "@/components/dashboard/PopularItems";
import SalesReport from "@/components/dashboard/SalesReport";
import PaymentSummary from "@/components/dashboard/PaymentSummary";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <Link href="/dashboard/create-menu">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Menu Item
          </Button>
        </Link>
      </div>

      <QuickStats />

      {/* Sales Report - Full Width */}
      <SalesReport />

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <RecentOrders />
        </div>
        <div className="lg:col-span-2">
          <PopularItems />
        </div>
      </div>

      {/* Payment Summary - Full Width */}
      <PaymentSummary />
    </main>
  );
}
