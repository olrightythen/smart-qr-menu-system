"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Eye, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const OrderNotification = ({ notification, onClose, onAction }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isPinned, setIsPinned] = useState(false);
  const { token } = useAuth();

  const orderData = notification.data;

  useEffect(() => {
    if (!isPinned && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!isPinned && timeLeft === 0) {
      handleClose();
    }
  }, [timeLeft, isPinned]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(notification.id), 300);
  };

  const handleOrderAction = async (action) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/orders/${orderData.order_id}/status/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({ status: action }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      toast.success(
        `Order ${action === "confirmed" ? "accepted" : "rejected"} successfully`
      );
      onAction?.(orderData.order_id, action);
      handleClose();
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update order status");
    }
  };

  const handleViewOrder = () => {
    window.open(`/dashboard/orders?highlight=${orderData.order_id}`, "_blank");
    handleClose();
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
      fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]
      bg-card border border-border rounded-lg shadow-lg
      transform transition-all duration-300 ease-in-out
      ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
    `}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
            <h3 className="font-semibold text-sm">New Order Received</h3>
          </div>
          <div className="flex items-center space-x-2">
            {!isPinned && (
              <span className="text-xs text-muted-foreground">{timeLeft}s</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPinned(!isPinned)}
              className="h-6 w-6 p-0"
            >
              <Clock
                className={`h-3 w-3 ${
                  isPinned ? "text-orange-500" : "text-muted-foreground"
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Order Details */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              Order #{orderData.order_id}
            </span>
            <span className="text-sm text-muted-foreground">
              Table: {orderData.table_name || "N/A"}
            </span>
          </div>

          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Items:</span>
            <div className="mt-1">
              {orderData.items?.slice(0, 3).map((item, index) => (
                <div key={index} className="text-xs">
                  {item.quantity}x {item.name}
                </div>
              ))}
              {orderData.items?.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{orderData.items.length - 3} more items
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm font-medium">Total:</span>
            <span className="text-sm font-semibold">
              Rs. {parseFloat(orderData.total_amount || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={() => handleOrderAction("confirmed")}
            size="sm"
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Accept
          </Button>
          <Button
            onClick={() => handleOrderAction("cancelled")}
            variant="destructive"
            size="sm"
            className="flex-1"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Reject
          </Button>
          <Button
            onClick={handleViewOrder}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderNotification;
