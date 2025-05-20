"use client";

import { useState } from 'react';
import { Plus, Tag, Calendar, Users, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/Header';

const offers = [
  {
    id: 1,
    title: "Weekend Special",
    discount: "20% OFF",
    code: "WEEKEND20",
    validFrom: "2024-03-15",
    validTo: "2024-03-17",
    usageCount: 45,
    status: "active"
  },
  {
    id: 2,
    title: "First Order",
    discount: "₹100 OFF",
    code: "FIRST100",
    validFrom: "2024-03-01",
    validTo: "2024-03-31",
    usageCount: 128,
    status: "active"
  },
  {
    id: 3,
    title: "Happy Hours",
    discount: "15% OFF",
    code: "HAPPY15",
    validFrom: "2024-03-10",
    validTo: "2024-03-20",
    usageCount: 67,
    status: "expired"
  }
];

export default function Offers() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={`${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300`}>
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">Offers & Discounts</h1>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Offer
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Tag className="h-6 w-6 text-orange-500" />
                </div>
                <span className="text-sm font-medium text-green-500">+12.5%</span>
              </div>
              <h3 className="text-2xl font-bold">24</h3>
              <p className="text-sm text-muted-foreground">Active Offers</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Users className="h-6 w-6 text-green-500" />
                </div>
                <span className="text-sm font-medium text-green-500">+8.2%</span>
              </div>
              <h3 className="text-2xl font-bold">1,240</h3>
              <p className="text-sm text-muted-foreground">Offer Redemptions</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Percent className="h-6 w-6 text-blue-500" />
                </div>
                <span className="text-sm font-medium text-green-500">+15.7%</span>
              </div>
              <h3 className="text-2xl font-bold">₹24,500</h3>
              <p className="text-sm text-muted-foreground">Total Savings Given</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-500" />
                </div>
                <span className="text-sm font-medium text-red-500">-2.3%</span>
              </div>
              <h3 className="text-2xl font-bold">18.5%</h3>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4">Offer</th>
                    <th className="text-left p-4">Code</th>
                    <th className="text-left p-4">Validity</th>
                    <th className="text-left p-4">Usage</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-right p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr key={offer.id} className="border-b border-border">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{offer.title}</div>
                          <div className="text-sm text-muted-foreground">{offer.discount}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <code className="px-2 py-1 bg-muted rounded text-sm">
                          {offer.code}
                        </code>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div>{new Date(offer.validFrom).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">to</div>
                          <div>{new Date(offer.validTo).toLocaleDateString()}</div>
                        </div>
                      </td>
                      <td className="p-4">{offer.usageCount} times</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          offer.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {offer.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}