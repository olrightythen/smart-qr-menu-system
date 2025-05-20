"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const timeRanges = ['Today', 'This Week', 'This Month'];

const data = [
  { name: 'Butter Chicken', orders: 45 },
  { name: 'Masala Dosa', orders: 38 },
  { name: 'Paneer Tikka', orders: 32 },
  { name: 'Biryani', orders: 28 },
  { name: 'Chole Bhature', orders: 25 },
];

export default function PopularItems() {

  return (
    <div className="bg-card rounded-xl border border-border h-full">
      <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Popular Items</h2>
      </div>

      <div className="p-6">
        <div className="h-[300px]">
          Items will be displayed here
        </div>
      </div>
    </div>
  );
}