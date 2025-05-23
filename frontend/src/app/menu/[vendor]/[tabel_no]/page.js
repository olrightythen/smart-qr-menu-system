"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  ShoppingCart,
  Plus,
  Minus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import toast from "react-hot-toast";
import { useParams } from "next/navigation";

export default function MenuPage() {
  const params = useParams();
  const { vendor, tabel_no } = params; // Get vendor ID and table number from URL

  const [categories, setCategories] = useState(["All"]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVeg, setFilterVeg] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [vendorInfo, setVendorInfo] = useState(null);

  // Fetch menu data when component mounts
  useEffect(() => {
    fetchMenuData();
  }, [vendor]);

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
            image:
              item.image_url || null,
            isVeg: item.is_veg || false,
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

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesVeg = !filterVeg || item.isVeg;
    return matchesCategory && matchesSearch && matchesVeg && item.available;
  });

  const addToCart = (item) => {
    const existingItem = cart.find((cartItem) => cartItem.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }

    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    try {
      setCheckoutLoading(true);

      // Format cart items for the backend
      const items = cart.map((item) => ({
        id: item.id,
        quantity: item.quantity,
      }));

      console.log("Sending to backend:", {
        items,
        vendor_id: vendor,
        table_no: tabel_no,
      });

      const response = await fetch(
        "http://localhost:8000/api/initiate-payment/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            vendor_id: vendor,
            table_no: tabel_no,
          }),
        }
      );

      // Check if the response is OK
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || "Payment initiation failed";
        } catch (parseError) {
          errorMessage = `Payment failed: ${response.status} ${
            response.statusText || "Unknown error"
          }`;
        }
        throw new Error(errorMessage);
      }

      // Parse successful response
      const data = await response.json();
      console.log("Payment data received:", data);

      // Create and submit the form
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

      // Ensure all values are properly formatted as strings
      const fields = {
        amount: String(data.amount),
        tax_amount: "0",
        total_amount: String(data.amount),
        transaction_uuid: data.invoice_no,
        product_code: "EPAYTEST",
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: data.success_url,
        failure_url: data.failure_url,
        signed_field_names: "total_amount,transaction_uuid,product_code",
        signature: data.signature,
      };

      console.log("Submitting form with fields:", fields);

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

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
          <Button onClick={fetchMenuData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {vendorInfo?.restaurant_name || "Our Menu"}
            </h1>
            {vendorInfo && (
              <p className="text-xs text-muted-foreground">Table #{tabel_no}</p>
            )}
          </div>
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Your Cart</SheetTitle>
              </SheetHeader>
              <div className="mt-8">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    Your cart is empty
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-16 h-16 rounded-md object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Rs. {item.price}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span>{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="border-t border-border pt-4 mt-4">
                      <div className="flex justify-between mb-4">
                        <span className="font-medium">Total</span>
                        <span className="font-medium">
                          Rs. {cartTotal.toFixed(2)}
                        </span>
                      </div>
                      <Button
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={handleCheckout}
                        disabled={checkoutLoading}
                      >
                        {checkoutLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                            Processing...
                          </>
                        ) : (
                          "Proceed to Checkout"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterVeg ? "default" : "outline"}
              className={
                filterVeg ? "bg-green-500 hover:bg-green-600 text-white" : ""
              }
              onClick={() => setFilterVeg(!filterVeg)}
            >
              Veg Only
            </Button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className={
                selectedCategory === category
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : ""
              }
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="container mx-auto px-4 pb-8">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No menu items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-xl overflow-hidden border border-border hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video relative">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  {!item.available && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-lg font-medium">
                        Currently Unavailable
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.category}
                      </p>
                    </div>
                    <span className="font-medium">
                      Rs. {item.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {item.description}
                  </p>
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={!item.available}
                    onClick={() => addToCart(item)}
                  >
                    Add to Cart
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
