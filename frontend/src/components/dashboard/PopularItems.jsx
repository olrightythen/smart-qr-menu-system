"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, TrendingUp, Award } from "lucide-react";

export default function PopularItems() {
  const [popularItems, setPopularItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchPopularItems = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        setError(null);

        // Use your existing sorting endpoint to get items sorted by popularity
        const response = await fetch(
          `http://localhost:8000/api/menu/${user.id}/sort/?sort_by=popularity&order=desc&limit=5`,
          {
            headers: {
              Authorization: `Token ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch popular items");
        }

        const data = await response.json();
        setPopularItems(data.items.slice(0, 5)); // Take top 5 items
      } catch (err) {
        console.error("Error fetching popular items:", err);
        setError("Couldn't load popular items");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularItems();
  }, [user, token]);

  // Get the maximum popularity to calculate proportional widths
  const maxPopularity = Math.max(
    ...popularItems.map((item) => item.popularity || 0),
    1
  );

  return (
    <div className="bg-card rounded-xl border border-border h-full">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h2 className="text-xl font-semibold">Popular Items</h2>
        <TrendingUp className="h-5 w-5 text-orange-500" />
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {error}
          </div>
        ) : popularItems.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
            <Award className="h-12 w-12 mb-4 text-muted-foreground/50" />
            <p>No order data available yet</p>
            <p className="text-sm mt-2">
              Popular items will appear here once you have orders
            </p>
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {popularItems.map((item, index) => (
              <div key={item.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-7 h-7 rounded-full font-medium text-sm ${
                        index === 0
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500"
                          : index === 1
                          ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          : index === 2
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500"
                          : "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-base">{item.name}</h3>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-lg">
                        {item.popularity || 0}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        orders
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted/30 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{
                      width: `${
                        ((item.popularity || 0) / maxPopularity) * 100
                      }%`,
                    }}
                  />
                </div>

                {/* Item details */}
                <div className="flex justify-between text-sm text-muted-foreground px-1">
                  <div>{item.category}</div>
                  <div>Rs. {item.price}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
