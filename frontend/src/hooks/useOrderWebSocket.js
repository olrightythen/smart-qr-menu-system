"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { getWsBaseUrl } from "./useWebSocket";

export const useOrderWebSocket = (vendorId, tableNo, onOrderUpdate) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 1; // Reduced from 3 to reduce log noise
  const connectionStatusRef = useRef("disconnected");
  const lastConnectAttempt = useRef(0);

  const connect = useCallback(() => {
    const now = Date.now();

    // Prevent rapid reconnection attempts
    if (now - lastConnectAttempt.current < 2000) {
      console.log("Preventing rapid reconnection attempt");
      return false;
    }

    lastConnectAttempt.current = now;

    // Check if we've already maxed out reconnection attempts
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log(
        `Already hit max reconnection attempts (${maxReconnectAttempts}), not trying again`
      );
      return false;
    }

    // Prevent duplicate connections
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return true; // Connection exists or is in progress
    }

    // Track that we're trying to connect
    connectionStatusRef.current = "connecting";

    try {
      // Get WebSocket base URL
      const wsBaseUrl = getWsBaseUrl();

      // Use the order-specific endpoint
      const wsUrl = `${wsBaseUrl}/ws/order/${vendorId}_${tableNo}/`;
      console.log(`Connecting to order WebSocket: ${wsUrl}`);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        connectionStatusRef.current = "connected";

        console.log(
          `Order WebSocket connected for vendor ${vendorId} and table ${tableNo}`
        );

        // Send a ping after connection to verify it's working
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "ping",
                timestamp: Date.now(),
              })
            );
          }
        }, 1000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle order status updates from order-specific channel
          if (data.type === "order_status_update") {
            processOrderUpdate(data.data);
          }
          // Handle order status updates from vendor channel
          else if (data.type === "order_status") {
            processOrderUpdate(data.data);
          }
          // Handle connection established message
          else if (data.type === "connection_established") {
            console.log(
              "Order WebSocket connection established:",
              data.message
            );
          }
          // Handle pong response
          else if (data.type === "pong") {
            console.log("Received pong from server");
          }
          // Handle error messages from the server
          else if (data.type === "error") {
            console.error("WebSocket server error:", data.message);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        connectionStatusRef.current = "disconnected";
        console.log(`WebSocket connection closed with code: ${event.code}`);

        // Only reconnect for unexpected closures and if we haven't hit max attempts
        if (
          event.code !== 1000 && // Not a normal closure
          event.code !== 1001 && // Not going away
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          const delay = Math.min(
            2000 * Math.pow(1.5, reconnectAttempts.current), // Gentle backoff
            10000 // Max 10 seconds
          );
          reconnectAttempts.current++;
          console.log(
            `Reconnecting in ${delay}ms, attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log("WebSocket connection closed permanently");
          if (reconnectAttempts.current >= maxReconnectAttempts) {
            toast.error(
              "Connection issues detected. Please refresh if order status doesn't update."
            );
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("Order WebSocket error:", error);
        connectionStatusRef.current = "error";
      };

      return true;
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      connectionStatusRef.current = "error";
      return false;
    }
  }, [vendorId, tableNo, maxReconnectAttempts]);

  // Helper function to process order updates
  const processOrderUpdate = useCallback(
    (data) => {
      if (!data) {
        console.error("Received empty data in processOrderUpdate");
        return;
      }

      const { id, status } = data;
      const order_id = id;

      if (!order_id || !status) {
        console.error("Received incomplete order data:", data);
        return;
      }

      console.log(
        `Order WebSocket: Received update for order ${order_id}, status: ${status}`
      );

      // Only process orders relevant to this table
      if (
        data.table_identifier === tableNo ||
        (data.qr_code && data.qr_code === tableNo)
      ) {
        console.log("Order update matches our table, processing...");

        // Call the callback function with order data
        if (typeof onOrderUpdate === "function") {
          onOrderUpdate({
            order_id,
            status,
            order_data: data,
          });
        }

        // Update localStorage
        const trackedOrders = JSON.parse(
          localStorage.getItem("tracked_orders") || "[]"
        );

        const orderToUpdate = trackedOrders.find(
          (order) => order.id === parseInt(order_id)
        );

        let updatedOrder;
        if (orderToUpdate) {
          updatedOrder = {
            ...orderToUpdate,
            status: status,
            ...data,
          };
        } else {
          updatedOrder = {
            id: parseInt(order_id),
            status: status,
            vendor_id: parseInt(data.vendor_id || vendorId),
            table_identifier: tableNo,
            created_at: data.created_at || new Date().toISOString(),
            ...data,
          };
        }

        const updatedOrders = orderToUpdate
          ? trackedOrders.map((order) =>
              order.id === parseInt(order_id) ? updatedOrder : order
            )
          : [updatedOrder, ...trackedOrders];

        localStorage.setItem("tracked_orders", JSON.stringify(updatedOrders));

        // Store the latest update globally
        window._latestOrderUpdate = {
          orderId: parseInt(order_id),
          status: String(status),
          order_data: data,
          timestamp: Date.now(),
        };
      } else {
        console.log(`Order update ignored - not for this table (${tableNo})`);
      }
    },
    [onOrderUpdate, tableNo, vendorId]
  );

  // Cleanup function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "Component unmounting");
      } catch (err) {
        console.error("Error closing WebSocket:", err);
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttempts.current = 0; // Reset for next time
  }, []);

  useEffect(() => {
    if (vendorId && tableNo) {
      console.log("Initializing WebSocket connection for:", vendorId, tableNo);

      // Small delay to avoid StrictMode double invocation
      const timer = setTimeout(() => {
        connect();
      }, 100);

      return () => {
        clearTimeout(timer);
        disconnect();
      };
    }

    return () => {
      disconnect();
    };
  }, [vendorId, tableNo, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
    connectionStatus: connectionStatusRef.current,
    reconnectAttempts: reconnectAttempts.current,
    usingFallback: reconnectAttempts.current >= maxReconnectAttempts,
  };
};
