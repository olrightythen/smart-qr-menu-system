"use client";

import { useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/Header';

const orders = [
  {
    id: "ORD001",
    customer: "Rahul Sharma",
    items: [
      { name: "Butter Chicken", quantity: 1 },
      { name: "Naan", quantity: 2 }
    ],
    total: "450",
    status: "completed",
    time: "10 mins ago",
    payment: "eSewa"
  },
  {
    id: "ORD002",
    customer: "Priya Patel",
    items: [
      { name: "Masala Dosa", quantity: 1 },
      { name: "Coffee", quantity: 1 }
    ],
    total: "180",
    status: "preparing",
    time: "15 mins ago",
    payment: "Cash"
  },
  {
    id: "ORD003",
    customer: "Amit Kumar",
    items: [
      { name: "Paneer Tikka", quantity: 1 },
      { name: "Roti", quantity: 4 }
    ],
    total: "350",
    status: "pending",
    time: "20 mins ago",
    payment: "eSewa"
  }
];

const statusStyles = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  preparing: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
};

export default function Orders() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={`${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300`}>
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">Orders</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4">Order ID</th>
                    <th className="text-left p-4">Customer</th>
                    <th className="text-left p-4">Items</th>
                    <th className="text-left p-4">Total</th>
                    <th className="text-left p-4">Payment</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border">
                      <td className="p-4 font-medium">{order.id}</td>
                      <td className="p-4">{order.customer}</td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="text-sm">
                              {item.quantity}x {item.name}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">Rs. {order.total}</td>
                      <td className="p-4">{order.payment}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{order.time}</td>
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