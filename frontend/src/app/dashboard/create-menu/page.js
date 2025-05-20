"use client";

import { useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/Header';

export default function CreateMenu() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [menuItems, setMenuItems] = useState([{ name: '', price: '', description: '', category: '' }]);

  const addMenuItem = () => {
    setMenuItems([...menuItems, { name: '', price: '', description: '', category: '' }]);
  };

  const removeMenuItem = (index) => {
    const newItems = menuItems.filter((_, i) => i !== index);
    setMenuItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...menuItems];
    newItems[index][field] = value;
    setMenuItems(newItems);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={`${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300`}>
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">Create Menu</h1>
            <Button onClick={addMenuItem} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-6">
            {menuItems.map((item, index) => (
              <div key={index} className="bg-card rounded-lg border border-border p-6 relative">
                <button
                  onClick={() => removeMenuItem(index)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Item Name</label>
                      <Input
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="e.g., Butter Chicken"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Price</label>
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        placeholder="e.g., 250"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Input
                        value={item.category}
                        onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                        placeholder="e.g., Main Course"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Describe your dish..."
                        className="h-32"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-2">Item Image</label>
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                        <Button variant="outline" className="w-full">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Image
                        </Button>
                        <p className="text-sm text-muted-foreground mt-2">
                          PNG, JPG up to 5MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end space-x-4">
              <Button variant="outline">Save as Draft</Button>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Publish Menu
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}