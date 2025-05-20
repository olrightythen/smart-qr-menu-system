"use client";

import { useState } from 'react';
import { QrCode, Download, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/Header';

export default function GenerateQR() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={`${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300`}>
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="p-4 md:p-6 space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold">Generate QR Code</h1>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-semibold mb-4">Your Menu QR Code</h2>
              
              <div className="aspect-square bg-white rounded-lg flex items-center justify-center p-8 mb-6">
                <QrCode className="w-full h-full text-foreground" />
              </div>

              <div className="space-y-4">
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">Customize QR Code</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Size</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2">
                      <option>Small (200x200)</option>
                      <option>Medium (400x400)</option>
                      <option>Large (800x800)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Format</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2">
                      <option>PNG</option>
                      <option>JPG</option>
                      <option>SVG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Style</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2">
                      <option>Standard</option>
                      <option>Rounded</option>
                      <option>Dots</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">Print Instructions</h2>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Print in high quality for better scanning</li>
                  <li>• Ensure good contrast with background</li>
                  <li>• Minimum size: 2x2 inches</li>
                  <li>• Keep QR code clean and undamaged</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}