"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import toast from "react-hot-toast";

// Create the context with default values
export const CartContext = createContext({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  recentlyAdded: {},
  clearCart: () => {},
  cartTotal: 0,
});

// Create the provider component
export const CartProvider = ({
  children,
  vendorId,
  tableNo,
  onUpdateRecommendations,
}) => {
  const [cart, setCart] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState({});
  const timeoutRefs = useRef({});
  const initialLoadCompleted = useRef(false);
  const previousCartJSON = useRef("");

  // Prevent excessive recommendation updates with debounce
  const recommendationsTimeoutRef = useRef(null);
  const pendingCartItemsRef = useRef(null);

  // Calculate cart total
  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Load cart from localStorage on initial mount
  useEffect(() => {
    if (initialLoadCompleted.current) return;

    try {
      const cartKey = `cart_${vendorId}_${tableNo}`;
      const savedCart = localStorage.getItem(cartKey);

      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        previousCartJSON.current = savedCart;

        // Update recommendations based on loaded cart
        if (parsedCart.length > 0 && onUpdateRecommendations) {
          const cartItemIds = parsedCart.map((item) => item.id);
          pendingCartItemsRef.current = cartItemIds;
          triggerRecommendationsUpdate();
        }
      }
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
    }

    initialLoadCompleted.current = true;
  }, [vendorId, tableNo, onUpdateRecommendations]);

  // Save cart to localStorage when it changes
  useEffect(() => {
    if (!initialLoadCompleted.current) return;

    try {
      const cartKey = `cart_${vendorId}_${tableNo}`;
      const currentCartJSON = JSON.stringify(cart);

      if (currentCartJSON !== previousCartJSON.current) {
        localStorage.setItem(cartKey, currentCartJSON);
        previousCartJSON.current = currentCartJSON;
      }
    } catch (error) {
      console.error("Error saving cart to localStorage:", error);
    }
  }, [cart, vendorId, tableNo]);

  // Clean up timeouts when component unmounts
  useEffect(() => {
    return () => {
      // Clear all timeouts
      Object.values(timeoutRefs.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });

      if (recommendationsTimeoutRef.current) {
        clearTimeout(recommendationsTimeoutRef.current);
      }
    };
  }, []);

  // Debounced recommendations update
  const triggerRecommendationsUpdate = useCallback(() => {
    if (recommendationsTimeoutRef.current) {
      clearTimeout(recommendationsTimeoutRef.current);
    }

    recommendationsTimeoutRef.current = setTimeout(() => {
      if (pendingCartItemsRef.current && onUpdateRecommendations) {
        onUpdateRecommendations(pendingCartItemsRef.current);
        pendingCartItemsRef.current = null;
      }
      recommendationsTimeoutRef.current = null;
    }, 500); // 500ms debounce
  }, [onUpdateRecommendations]);

  const addToCart = useCallback(
    (item) => {
      setCart((prevCart) => {
        const existingItem = prevCart.find(
          (cartItem) => cartItem.id === item.id
        );
        let updatedCart;

        if (existingItem) {
          updatedCart = prevCart.map((cartItem) =>
            cartItem.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          );
        } else {
          updatedCart = [...prevCart, { ...item, quantity: 1 }];
        }

        // Update recommendations queue
        const cartItemIds = updatedCart.map((item) => item.id);
        pendingCartItemsRef.current = cartItemIds;
        triggerRecommendationsUpdate();

        return updatedCart;
      });

      // Clear any existing timeout for this item
      if (timeoutRefs.current[item.id]) {
        clearTimeout(timeoutRefs.current[item.id]);
      }

      // Set recently added indicator
      setRecentlyAdded((prev) => ({ ...prev, [item.id]: true }));

      // Store the timeout reference
      timeoutRefs.current[item.id] = setTimeout(() => {
        setRecentlyAdded((prev) => ({ ...prev, [item.id]: false }));
        delete timeoutRefs.current[item.id];
      }, 2000);

      toast.success(`${item.name} added to cart`);
    },
    [triggerRecommendationsUpdate]
  );

  const removeFromCart = useCallback(
    (itemId) => {
      setCart((prevCart) => {
        const updatedCart = prevCart.filter((item) => item.id !== itemId);

        // Update recommendations if needed
        if (updatedCart.length > 0) {
          const cartItemIds = updatedCart.map((item) => item.id);
          pendingCartItemsRef.current = cartItemIds;
          triggerRecommendationsUpdate();
        }

        return updatedCart;
      });
    },
    [triggerRecommendationsUpdate]
  );

  const updateQuantity = useCallback(
    (itemId, newQuantity) => {
      if (newQuantity < 1) {
        removeFromCart(itemId);
        return;
      }

      setCart((prevCart) => {
        const updatedCart = prevCart.map((item) =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        );

        // Update recommendations queue
        const cartItemIds = updatedCart.map((item) => item.id);
        pendingCartItemsRef.current = cartItemIds;
        triggerRecommendationsUpdate();

        return updatedCart;
      });
    },
    [removeFromCart, triggerRecommendationsUpdate]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    pendingCartItemsRef.current = null;
  }, []);

  // Check for pending cart clearance (after returning from successful payment)
  useEffect(() => {
    const clearCartKey = `clear_cart_${vendorId}_${tableNo}`;
    const shouldClearCart = localStorage.getItem(clearCartKey);

    if (shouldClearCart === "true") {
      clearCart();
      localStorage.removeItem(clearCartKey);
      toast.success("Payment successful! Your order has been placed.");
    }
  }, [vendorId, tableNo, clearCart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        recentlyAdded,
        clearCart,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Custom hook to use cart context
export const useCart = () => useContext(CartContext);
