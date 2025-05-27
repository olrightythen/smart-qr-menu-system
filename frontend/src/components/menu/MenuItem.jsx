import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useCart } from "../../context/CartContext";
import React from "react";

const MenuItem = ({ item, isPopular }) => {
  const { addToCart, recentlyAdded } = useCart();

  const getImageWithFallback = (imageUrl) => {
    return imageUrl || "/images/default-food-image.jpg";
  };

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border hover:shadow-md transition-shadow">
      <div className="aspect-video relative">
        <img
          src={getImageWithFallback(item.image)}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = "/images/default-food-image.jpg";
          }}
        />
        {!item.available && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <span className="text-lg font-medium">Currently Unavailable</span>
          </div>
        )}
        {item.isSearchResult && (
          <Badge className="absolute top-2 right-2 bg-blue-500">
            Search Result
          </Badge>
        )}
        {isPopular && !item.isSearchResult && (
          <Badge className="absolute top-2 right-2 bg-purple-500">
            Popular
          </Badge>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-medium">{item.name}</h3>
            <p className="text-xs text-muted-foreground">{item.category}</p>
          </div>
          <span className="font-medium">Rs. {item.price.toFixed(2)}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {item.description}
        </p>
        <Button
          className={`w-full ${
            recentlyAdded[item.id]
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-orange-500 hover:bg-orange-600 text-white"
          }`}
          disabled={!item.available}
          onClick={() => addToCart(item)}
        >
          {recentlyAdded[item.id] ? "Added ✓" : "Add to Cart"}
        </Button>
      </div>
    </div>
  );
};

export default MenuItem;