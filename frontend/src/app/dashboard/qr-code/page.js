"use client";

import { useState } from "react";
import {
  QrCode,
  Download,
  Copy,
  Share2,
  Plus,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/Header";

export default function GenerateQR() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tables, setTables] = useState([
    { id: 1, name: "Table 1", qrCode: "table-1" },
    { id: 2, name: "Table 2", qrCode: "table-2" },
    { id: 3, name: "Table 3", qrCode: "table-3" },
  ]);
  const [newTableName, setNewTableName] = useState("");

  const addTable = () => {
    if (!newTableName.trim()) return;

    const newTable = {
      id: tables.length + 1,
      name: newTableName,
      qrCode: `table-${tables.length + 1}`,
    };

    setTables([...tables, newTable]);
    setNewTableName("");
  };

  const deleteTable = (id) => {
    setTables(tables.filter((table) => table.id !== id));
  };

  const regenerateQR = (id) => {
    // In a real app, this would generate a new unique QR code
    console.log("Regenerating QR for table:", id);
  };

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
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold">
                Table QR Manager
              </h1>
              <p className="text-muted-foreground">
                Generate and manage QR codes for each table
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Generate unique QR codes for each table.
                    <br />
                    Customers can scan to view the menu.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Add New Table */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-semibold mb-4">Add New Table</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Table Name/Number
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="e.g., Table 4"
                    />
                    <Button
                      onClick={addTable}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-medium mb-2">Quick Tips</h3>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li>• Each QR code is unique to its table</li>
                    <li>• Print QR codes in high quality</li>
                    <li>• Place QR codes visibly on tables</li>
                    <li>• Test scan before final placement</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Customize QR Settings */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-semibold mb-4">QR Code Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Size</label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2">
                    <option>Small (200x200)</option>
                    <option>Medium (400x400)</option>
                    <option>Large (800x800)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Format
                  </label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2">
                    <option>PNG</option>
                    <option>SVG</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Style
                  </label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2">
                    <option>Standard</option>
                    <option>Rounded</option>
                    <option>Dots</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table QR Codes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map((table) => (
              <div
                key={table.id}
                className="bg-card rounded-xl border border-border p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">{table.name}</h3>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => regenerateQR(table.id)}
                      className="text-orange-500"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTable(table.id)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="aspect-square bg-white rounded-lg flex items-center justify-center p-8 mb-4">
                  <QrCode className="w-full h-full text-black" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    PNG
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
