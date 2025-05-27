"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { useParams } from "next/navigation";
import { CartProvider } from "@/context/CartContext";
import MenuContent from "@/components/menu/MenuContent";

// Main wrapper that provides cart context
export default function MenuPage() {
  const params = useParams();
  const { vendor, tabel_no } = params;

  const [categories, setCategories] = useState(["All"]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendorInfo, setVendorInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] =
    useState(false);

  // Modify the fetchRecommendations function
  const fetchRecommendations = async (cartItemIds) => {
    try {
      // If cart is empty, clear recommendations immediately
      if (!cartItemIds || cartItemIds.length === 0) {
        setRecommendations([]);
        return;
      }

      setIsLoadingRecommendations(true);

      const response = await fetch(
        `http://localhost:8000/api/menu/${vendor}/recommendations/?items=${cartItemIds.join(
          ","
        )}&limit=3`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch recommendations");
      }

      const data = await response.json();

      setRecommendations(
        data.recommendations.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price),
          image_url: item.image_url || null,
          available: item.is_available,
          similarity_score: item.similarity_score || null,
        }))
      );
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setRecommendations([]); // Clear recommendations on error
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // Fetch menu data
  const fetchMenuData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:8000/api/public-menu/${vendor}/`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch menu data");
      }

      const data = await response.json();

      // Set vendor information
      if (data.vendor_info) {
        setVendorInfo(data.vendor_info);
        document.title = `Menu - ${data.vendor_info.restaurant_name}`;
      }

      // Extract all menu items from categories
      const allItems = [];
      const categorySet = new Set(["All"]);

      data.categories.forEach((category) => {
        category.items.forEach((item) => {
          // Add category to our unique set
          categorySet.add(category.name);

          // Format the item for our app
          allItems.push({
            id: item.id,
            name: item.name,
            category: category.name,
            price: parseFloat(item.price),
            description: item.description || "",
            image: item.image_url || null,
            available: item.is_available,
          });
        });
      });

      setMenuItems(allItems);
      setCategories(Array.from(categorySet));
    } catch (err) {
      console.error("Error fetching menu data:", err);
      setError("Failed to load menu. Please try again.");
      toast.error("Failed to load menu. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch menu data when component mounts
  useEffect(() => {
    fetchMenuData();
  }, [vendor]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500" />
          <p className="mt-4 text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Menu Unavailable</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button
            onClick={fetchMenuData}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CartProvider
      vendorId={vendor}
      tableNo={tabel_no}
      onUpdateRecommendations={fetchRecommendations}
    >
      <MenuContent
        categories={categories}
        menuItems={menuItems}
        setMenuItems={setMenuItems} // Pass the setter function
        vendorInfo={vendorInfo}
        vendor={vendor}
        tabel_no={tabel_no}
        recommendations={recommendations}
        setRecommendations={setRecommendations}
        fetchMenuData={fetchMenuData}
        isLoadingRecommendations={isLoadingRecommendations}
      />
    </CartProvider>
  );
}
