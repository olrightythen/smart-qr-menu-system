import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

// Helper function to get the API base URL
export const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8000";
  } else {
    // In production, use the same host but with http/https protocol
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000`;
  }
};

// Helper function to get WebSocket base URL
export const getWsBaseUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  if (process.env.NODE_ENV === "development") {
    return `${protocol}//localhost:8000`;
  } else {
    // In production, use the same host
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000`;
  }
};

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
  const lastMessageTimeRef = useRef(Date.now());

  // Update the onMessage ref when it changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // This function checks if the connection is stale
  const checkConnectionHealth = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTimeRef.current;

      // If no message received in 2 minutes, consider the connection stale
      if (timeSinceLastMessage > 120000) {
        console.warn(
          `WebSocket connection may be stale. Last message was ${timeSinceLastMessage}ms ago.`
        );
        // Force a reconnection
        disconnect();
        setTimeout(connect, 1000);
      }
    }
  }, []);

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

        // Check connection health each time we send a ping
        checkConnectionHealth();
      }
    }, 30000); // Ping every 30 seconds
  }, [checkConnectionHealth]);

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

      // Create WebSocket URL using helper function
      const wsBaseUrl = getWsBaseUrl();
      const wsUrl = `${wsBaseUrl}/ws/notifications/${user.id}/?token=${token}`;
      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);

      setConnectionStatus("Connecting");

      ws.current = new WebSocket(wsUrl);

      // Set up event handlers
      ws.current.onopen = (event) => {
        setConnectionStatus("Connected");
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
        startPingInterval();
        console.log("WebSocket connected successfully", event);
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket connection error:", error);
        // The error event doesn't provide much info, the connection will close with an error code
        // which will be handled in onclose
      };

      ws.current.onmessage = (event) => {
        try {
          // Update last message time for connection health check
          lastMessageTimeRef.current = Date.now();

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
  }, [
    user?.id,
    token,
    startPingInterval,
    stopPingInterval,
    checkConnectionHealth,
  ]);
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopPingInterval();
    isConnectingRef.current = false;

    // Reset the last message time reference when disconnecting
    lastMessageTimeRef.current = Date.now();

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
