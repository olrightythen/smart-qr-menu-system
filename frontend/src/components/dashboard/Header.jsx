"use client";

import { useEffect, useState } from 'react';
import { Bell, ChevronDown, Menu, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { useTheme } from '../ThemeProvider';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardHeader({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { logout, user } = useAuth();
  const [restaurant_name] = user ? [user.restaurant_name] : ["No Name"];
  const [logoPreview, setLogoPreview] = useState(user?.logo || null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [notifications] = useState([
    { id: 1, text: "New order received", time: "5 minutes ago" },
    { id: 2, text: "Customer review posted", time: "1 hour ago" },
    { id: 3, text: "Daily summary available", time: "3 hours ago" },
  ]);

  const fetchLogo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `http://localhost:8000/api/vendor/${user?.id}/`,
        {
          headers: {
            Authorization: `Token ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor data");
      }

      const data = await response.json();
      const logoUrl = data.logo;
      setLogoPreview(logoUrl);
    } catch (error) {
      console.error("Error fetching logo:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch logo when component mounts
  useEffect(() => {
    if (user?.id) {
      fetchLogo();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };
  

  return (
    <header className="h-16 bg-card border-b border-border sticky top-0 z-30">
      <div className="h-full px-4 flex items-center justify-between">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-accent rounded-md"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1 px-4 text-lg font-medium">{restaurant_name}</div>

        <div className="flex items-center space-x-4">
          {/* Theme Toggle Button */}
          <Button onClick={toggleTheme} variant="ghost" size="icon">
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-orange-500 rounded-full" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start py-2"
                >
                  <span>{notification.text}</span>
                  <span className="text-xs text-muted-foreground">
                    {notification.time}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  {isLoading ? (
                    <span className="text-orange-500">Loading...</span>
                  ) : logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-orange-500">No Logo</span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/dashboard/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-500" onClick={handleLogout}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}