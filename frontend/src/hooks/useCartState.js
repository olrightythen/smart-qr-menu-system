"use client";

import { useState } from 'react';

export const useCartState = () => {
  // Initialize cart state
  const [cart, setCart] = useState([]);
  
  return {
    cart,
    setCart
  };
};