import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export const useWebSocket = (onMessage) => {
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [messageHistory, setMessageHistory] = useState([]);
  const ws = useRef(null);
  const { user, token } = useAuth();
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const onMessageRef = useRef(onMessage);
  const pingIntervalRef = useRef(null);
  const isConnectingRef = useRef(false);

  // Update the onMessage ref when it changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: "ping",
            timestamp: Date.now(),
          })
        );
      }
    }, 30000); // Ping every 30 seconds
  }, []);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log("Connection attempt already in progress");
      return;
    }

    // Don't connect if already connected
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    if (!user?.id || !token) {
      console.log("Missing user or token for WebSocket connection");
      setConnectionStatus("Disconnected");
      return;
    }

    isConnectingRef.current = true;

    try {
      // Clean up any existing connection
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }

      // Create WebSocket URL - ensure proper format
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//localhost:8000/ws/notifications/${user.id}/?token=${token}`;

      setConnectionStatus("Connecting");
      console.log(`Attempting WebSocket connection to: ${wsUrl}`);

      ws.current = new WebSocket(wsUrl);

      // Set up event handlers
      ws.current.onopen = (event) => {
        setConnectionStatus("Connected");
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
        startPingInterval();
        console.log("WebSocket connected successfully", event);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data);

          setMessageHistory((prev) => [...prev.slice(-49), data]);

          // Handle different message types
          if (data.type === "pong") {
            console.log(
              "Received pong from server at",
              new Date(data.server_timestamp)
            );
            return;
          }

          if (data.type === "connection_established") {
            console.log("WebSocket connection established:", data.message);
            return;
          }

          if (data.type === "notification_read_response") {
            console.log(
              `Notification ${data.notification_id} read status: ${data.success}`
            );
            return;
          }

          if (data.type === "error") {
            console.error("WebSocket server error:", data.message);
            return;
          }

          // Call onMessage for actual notifications
          if (onMessageRef.current && data.type === "vendor_notification") {
            console.log("Received vendor notification:", data.data);
            onMessageRef.current(data.data);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.current.onclose = (event) => {
        isConnectingRef.current = false;
        setConnectionStatus("Disconnected");
        stopPingInterval();
        console.log(
          "WebSocket disconnected - Code:",
          event.code,
          "Reason:",
          event.reason
        );

        // Handle different close codes
        if (event.code === 4001) {
          console.error("WebSocket authentication failed");
          setConnectionStatus("Authentication Failed");
          return;
        }

        if (event.code === 4002) {
          console.error("WebSocket connection error");
          setConnectionStatus("Connection Error");
          return;
        }

        if (event.code === 4003) {
          console.error("WebSocket access forbidden");
          setConnectionStatus("Access Forbidden");
          return;
        }

        // Don't reconnect if intentionally closed
        if (event.code === 1000) {
          console.log("WebSocket intentionally closed");
          return;
        }

        // Attempt to reconnect if not intentionally closed
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          );
          reconnectAttempts.current += 1;

          console.log(
            `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );
          setConnectionStatus("Reconnecting");

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error("Max reconnection attempts reached");
          setConnectionStatus("Failed");
        }
      };

      ws.current.onerror = (error) => {
        isConnectingRef.current = false;
        console.error("WebSocket error occurred:", error);
        console.error("WebSocket readyState:", ws.current?.readyState);
        console.error("WebSocket URL:", ws.current?.url);
        setConnectionStatus("Error");
      };

      // Set a connection timeout
      setTimeout(() => {
        if (ws.current && ws.current.readyState === WebSocket.CONNECTING) {
          console.warn("WebSocket connection timeout");
          ws.current.close();
          isConnectingRef.current = false;
          setConnectionStatus("Timeout");
        }
      }, 10000); // 10 second timeout
    } catch (error) {
      isConnectingRef.current = false;
      console.error("Error creating WebSocket connection:", error);
      setConnectionStatus("Error");
    }
  }, [user?.id, token, startPingInterval, stopPingInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopPingInterval();
    isConnectingRef.current = false;

    if (ws.current) {
      ws.current.close(1000, "Intentional disconnect");
      ws.current = null;
    }

    setConnectionStatus("Disconnected");
    reconnectAttempts.current = 0;
  }, [stopPingInterval]);

  const sendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message));
        console.log("Message sent via WebSocket:", message);
        return true;
      } catch (error) {
        console.error("Error sending WebSocket message:", error);
        return false;
      }
    } else {
      console.warn(
        "WebSocket is not connected, cannot send message:",
        message,
        "ReadyState:",
        ws.current?.readyState
      );
      return false;
    }
  }, []);

  // Connect when user and token are available
  useEffect(() => {
    let mounted = true;

    if (user?.id && token && mounted) {
      // Small delay to ensure proper initialization
      const connectTimeout = setTimeout(connect, 100);
      return () => clearTimeout(connectTimeout);
    } else {
      disconnect();
    }

    return () => {
      mounted = false;
      disconnect();
    };
  }, [user?.id, token]); // Removed connect/disconnect from deps to prevent infinite loops

  return {
    connectionStatus,
    messageHistory,
    sendMessage,
    connect,
    disconnect,
  };
};
