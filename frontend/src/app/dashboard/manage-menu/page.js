"use client";

import { useState, useEffect } from "react";
import { Edit2, Trash2, Search, Filter, Plus, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/Header";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function ManageMenu() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [menuCategories, setMenuCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCategories, setFilteredCategories] = useState([]);
  const { user, token } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Fetch menu items when component mounts
  useEffect(() => {
    if (user?.id && token) {
      fetchMenuItems();
    } else {
      setIsLoading(false);
    }
  }, [user, token]);

  // Filter menu items when search term changes
  useEffect(() => {
    if (!menuCategories.length) {
      setFilteredCategories([]);
      return;
    }

    const query = searchTerm.toLowerCase().trim();
    if (!query) {
      setFilteredCategories(menuCategories);
      return;
    }

    // Filter items that match the search term
    const filtered = menuCategories
      .map((category) => {
        const matchedItems = category.items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        );

        if (matchedItems.length) {
          return { ...category, items: matchedItems };
        }
        return null;
      })
      .filter(Boolean); // Remove null categories

    setFilteredCategories(filtered);
  }, [searchTerm, menuCategories]);

  const fetchMenuItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/menu/list/${user.id}/`,
        {
          method: "GET",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch menu items");
      }

      const data = await response.json();
      setMenuCategories(data.categories || []);
      setFilteredCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      toast.error("Failed to load menu items. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvailabilityToggle = async (itemId, currentStatus) => {
    setActionInProgress(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/menu/toggle/${itemId}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update item availability");
      }

      // Update local state
      const updatedCategories = menuCategories.map((category) => ({
        ...category,
        items: category.items.map((item) =>
          item.id === itemId
            ? { ...item, is_available: !currentStatus }
            : item
        ),
      }));

      setMenuCategories(updatedCategories);
      setFilteredCategories(updatedCategories);
      toast.success("Item availability updated");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Failed to update item availability");
    } finally {
      setActionInProgress(false);
    }
  };

  const confirmDeleteItem = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setActionInProgress(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/menu/item/${itemToDelete.id}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete menu item");
      }

      // Update local state by removing the deleted item
      const updatedCategories = menuCategories
        .map((category) => {
          const updatedItems = category.items.filter(
            (item) => item.id !== itemToDelete.id
          );
          if (updatedItems.length === 0) {
            return null; // Remove category if empty
          }
          return { ...category, items: updatedItems };
        })
        .filter(Boolean); // Remove empty categories

      setMenuCategories(updatedCategories);
      setFilteredCategories(updatedCategories);
      toast.success("Menu item deleted successfully");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete menu item");
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setActionInProgress(false);
    }
  };

  const handleEditItem = (itemId) => {
    router.push(`/dashboard/edit-menu/${itemId}`);
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-bold">Manage Menu</h1>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 md:min-w-[240px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-8"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              <Button
                onClick={() => router.push("/dashboard/create-menu")}
                className="bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Items
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border p-6"
                >
                  <Skeleton className="w-1/3 h-6 mb-4" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <Skeleton className="w-full h-12" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <Skeleton className="w-full h-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <h3 className="text-xl font-medium mb-2">No menu items found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? "No items match your search. Try a different search term."
                  : "You haven't added any menu items yet."}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => router.push("/dashboard/create-menu")}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Menu
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCategories.map((category) => (
                <div
                  key={category.name}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <div className="p-4 border-b border-border">
                    <h2 className="font-medium">{category.name}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-4">Item</th>
                          <th className="text-left p-4 hidden md:table-cell">
                            Price
                          </th>
                          <th className="text-center p-4">Available</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <span className="text-muted-foreground text-xs">
                                        No img
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-muted-foreground md:hidden">
                                    Rs. {item.price}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 hidden md:table-cell">
                              Rs. {item.price}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                disabled={actionInProgress}
                                onClick={() =>
                                  handleAvailabilityToggle(
                                    item.id,
                                    item.is_available
                                  )
                                }
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  item.is_available
                                    ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                                    : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                                } transition-colors`}
                              >
                                {item.is_available ? (
                                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                {item.is_available ? "Available" : "Hidden"}
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditItem(item.id)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                                  onClick={() => confirmDeleteItem(item)}
                                  disabled={actionInProgress}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Menu Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{itemToDelete?.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={actionInProgress}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={actionInProgress}
            >
              {actionInProgress ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}