import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";

const RecommendationItem = ({ item }) => {
  const { addToCart } = useCart();

  return (
    <div className="bg-white dark:bg-card rounded-xl overflow-hidden border border-border hover:shadow-md transition-shadow">
      <div className="aspect-video relative">
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = "/images/default-food-image.jpg";
          }}
        />
        <Badge className="absolute top-2 right-2 bg-orange-500">
          Recommended
        </Badge>
        {!item.available && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <span className="text-lg font-medium">Currently Unavailable</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium">{item.name}</h3>
          <span className="font-medium">
            Rs.
            {typeof item.price === "string"
              ? parseFloat(item.price).toFixed(2)
              : item.price.toFixed(2)}
          </span>
        </div>
        <Button
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => addToCart(item)}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default RecommendationItem;
