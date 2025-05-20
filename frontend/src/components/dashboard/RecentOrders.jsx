"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const orders = [
  {
    id: "ORD001",
    customer: "Rahul Sharma",
    items: "Butter Chicken, Naan",
    amount: "₹450",
    status: "completed",
    time: "10 mins ago"
  },
  {
    id: "ORD002",
    customer: "Priya Patel",
    items: "Masala Dosa, Coffee",
    amount: "₹180",
    status: "preparing",
    time: "15 mins ago"
  },
  {
    id: "ORD003",
    customer: "Amit Kumar",
    items: "Paneer Tikka, Roti",
    amount: "₹350",
    status: "pending",
    time: "20 mins ago"
  },
  {
    id: "ORD004",
    customer: "Neha Singh",
    items: "Biryani, Raita",
    amount: "₹280",
    status: "completed",
    time: "25 mins ago"
  },
  {
    id: "ORD005",
    customer: "Vikram Reddy",
    items: "Chole Bhature",
    amount: "₹160",
    status: "preparing",
    time: "30 mins ago"
  }
];

const statusStyles = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  preparing: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
};

export default function RecentOrders() {
  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold">Recent Orders</h2>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.id}</TableCell>
                <TableCell>{order.customer}</TableCell>
                <TableCell>{order.items}</TableCell>
                <TableCell>{order.amount}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusStyles[order.status]}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.time}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}