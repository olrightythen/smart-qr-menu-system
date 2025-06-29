"use client";

import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wifi, WifiOff, AlertCircle } from "lucide-react";

const statusColors = {
  Connected: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-800 dark:text-green-400",
    icon: Wifi,
  },
  Connecting: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-800 dark:text-orange-400",
    icon: Wifi,
  },
  Disconnected: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    icon: WifiOff,
  },
  Reconnecting: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-800 dark:text-orange-400",
    icon: Wifi,
  },
  Error: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    icon: AlertCircle,
  },
  Failed: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    icon: AlertCircle,
  },
  Timeout: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    icon: AlertCircle,
  },
  "Authentication Failed": {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    icon: AlertCircle,
  },
  "Connection Error": {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    icon: AlertCircle,
  },
  "Access Forbidden": {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-400",
    icon: AlertCircle,
  },
};

const getStatusMessage = (status) => {
  switch (status) {
    case "Connected":
      return "Real-time updates are active";
    case "Connecting":
      return "Connecting to real-time service...";
    case "Disconnected":
      return "Not connected to real-time service";
    case "Reconnecting":
      return "Attempting to reconnect...";
    case "Error":
      return "Error connecting to real-time service";
    case "Failed":
      return "Failed to connect after multiple attempts";
    case "Timeout":
      return "Connection timed out";
    case "Authentication Failed":
      return "Authentication failed. Try logging out and back in.";
    case "Connection Error":
      return "Connection error. Please try again.";
    case "Access Forbidden":
      return "Access forbidden. You may not have permission.";
    default:
      return "Unknown connection status";
  }
};

export default function ConnectionStatus({ status }) {
  // Default to Disconnected if no status is provided
  const connectionStatus = status || "Disconnected";
  const {
    bg,
    text,
    icon: Icon,
  } = statusColors[connectionStatus] || statusColors.Disconnected;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${bg} ${text} flex items-center gap-1 cursor-default`}
          >
            <Icon className="h-3 w-3" />
            <span className="text-xs font-medium">{connectionStatus}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getStatusMessage(connectionStatus)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
