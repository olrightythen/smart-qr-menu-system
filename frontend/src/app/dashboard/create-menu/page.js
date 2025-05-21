"use client";

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/Header';

export default function CreateMenu() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [menuItems, setMenuItems] = useState([{ name: '', price: '', description: '', category: '', imageUrl: '' }]);
  const [loading, setLoading] = useState(false);

  const addMenuItem = () => {
    setMenuItems([...menuItems, { name: '', price: '', description: '', category: '', imageUrl: '' }]);
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

  const handlePublishMenu = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/vendor/dashboard/create-menu/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: menuItems,  // Send the menu items data
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);  // Handle response (optional)
        setLoading(false);
        alert("Menu published successfully");
      } else {
        throw new Error('Failed to publish menu');
      }
    } catch (error) {
      setLoading(false);
      console.error(error);
      alert("An error occurred while publishing the menu.");
    }
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
                      <label className="text-sm font-medium block mb-2">Image URL</label>
                      <Input
                        type="text"
                        value={item.imageUrl}
                        onChange={(e) => handleItemChange(index, 'imageUrl', e.target.value)}
                        placeholder="e.g., https://example.com/image.jpg"
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Enter the image URL (PNG, JPG).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end space-x-4">
              <Button variant="outline">Save as Draft</Button>
              <Button
                onClick={handlePublishMenu}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={loading}
              >
                {loading ? 'Publishing...' : 'Publish Menu'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
