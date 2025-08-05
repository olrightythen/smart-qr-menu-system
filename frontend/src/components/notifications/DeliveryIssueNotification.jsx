"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Clock,
  X,
  AlertTriangle,
  Eye,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { getApiBaseUrl } from "@/hooks/useWebSocket";

const DeliveryIssueNotification = ({ notification, onClose, onAction }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15); // Longer time for delivery issues
  const [isPinned, setIsPinned] = useState(false);
  const { token } = useAuth();

  const issueData = notification.data;

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

  const handleResolveIssue = async (resolution) => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const order_id = issueData?.order_id;

      if (!order_id) {
        console.error("Missing order_id in notification data:", issueData);
        toast.error("Cannot resolve issue: missing order ID");
        return;
      }

      console.log(
        `Resolving delivery issue for order ${order_id} with resolution: ${resolution}`
      );

      const response = await fetch(
        `${apiBaseUrl}/api/orders/${order_id}/resolve-issue/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({
            resolution_type: resolution,
            resolved_timestamp: new Date().toISOString(),
            notes:
              resolution === "investigate"
                ? "Restaurant will investigate the delivery issue"
                : "Restaurant confirms order was delivered correctly",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to resolve issue: ${response.status}`
        );
      }

      const data = await response.json();
      console.log("Issue resolution response:", data);

      const message =
        resolution === "investigate"
          ? `Investigation initiated for order #${order_id}`
          : `Delivery confirmed for order #${order_id}`;

      toast.success(message);

      // Call the onAction callback
      onAction?.(order_id, `issue_${resolution}`);

      // Close the notification
      handleClose();
    } catch (error) {
      console.error("Error resolving delivery issue:", error);
      toast.error(`Failed to resolve issue: ${error.message}`);
    }
  };

  const handleViewOrder = () => {
    if (issueData?.order_id) {
      window.open(
        `/dashboard/orders?highlight=${issueData.order_id}`,
        "_blank"
      );
    } else {
      console.error("Missing order_id in notification data:", issueData);
      toast.error("Cannot view order: missing order ID");
    }
    handleClose();
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
      fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]
      bg-card border border-red-200 dark:border-red-800 rounded-lg shadow-lg
      transform transition-all duration-300 ease-in-out
      ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
    `}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <h3 className="font-semibold text-sm text-red-800 dark:text-red-200">
              Delivery Issue Reported
            </h3>
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
                  isPinned ? "text-red-500" : "text-muted-foreground"
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

        {/* Issue Details */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              Order #{issueData?.order_id || "Unknown"}
            </span>
            <span className="text-sm text-muted-foreground">
              Table: {issueData?.table_name || "N/A"}
            </span>
          </div>

          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Customer reports not receiving order
              </span>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300">
              The customer marked this order as "not received" despite it being
              marked as delivered. Please investigate and resolve this issue.
            </p>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm font-medium">Total:</span>
            <span className="text-sm font-semibold">
              Rs. {parseFloat(issueData?.total_amount || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2">
          <Button
            onClick={() => handleResolveIssue("investigate")}
            size="sm"
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            <MessageSquare className="h-3 w-3 mr-2" />
            Investigate Issue
          </Button>
          <div className="flex space-x-2">
            <Button
              onClick={() => handleResolveIssue("confirm_delivery")}
              size="sm"
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Confirm Delivered
            </Button>
            <Button
              onClick={handleViewOrder}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Eye className="h-3 w-3 mr-1" />
              View Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryIssueNotification;
