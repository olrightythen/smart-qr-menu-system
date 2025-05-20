"use client";

import { useState } from 'react';
import { User, Mail, Phone, MapPin, Building, Globe, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/Header';

export default function Settings() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={`${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300`}>
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="p-4 md:p-6 space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">Restaurant Information</h2>
                
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Restaurant Name</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input defaultValue="Spice Garden Restaurant" className="pl-10" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Owner Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input defaultValue="Aarav Patel" className="pl-10" />
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input defaultValue="contact@spicegarden.com" className="pl-10" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input defaultValue="+977 9876543210" className="pl-10" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input defaultValue="123 Food Street, Thamel, Kathmandu" className="pl-10" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input defaultValue="https://spicegarden.com" className="pl-10" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      defaultValue="Authentic Indian cuisine served in a modern setting. We specialize in North Indian dishes and tandoor specialties."
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">Business Hours</h2>
                
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="font-medium">{day}</span>
                    <div className="flex items-center space-x-2">
                      <Input type="time" defaultValue="10:00" className="w-32" />
                      <span>to</span>
                      <Input type="time" defaultValue="22:00" className="w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">Restaurant Logo</h2>
                
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto bg-muted rounded-xl flex items-center justify-center mb-4">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    Change Logo
                  </Button>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">Notification Settings</h2>
                
                <div className="space-y-4">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded border-input" />
                    <span>New Order Notifications</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded border-input" />
                    <span>Customer Reviews</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded border-input" />
                    <span>Daily Summary</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded border-input" />
                    <span>Marketing Updates</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button variant="outline">Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Save Changes
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}