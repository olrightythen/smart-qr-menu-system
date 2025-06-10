"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileEdit,
  QrCode,
  ShoppingBag,
  Star,
  Tag,
  Settings,
  LogOut,
  ChevronRight,
  PlusSquare,
  Menu,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: PlusSquare, label: "Create Menu", href: "/dashboard/create-menu" },
  { icon: FileEdit, label: "Manage Menu", href: "/dashboard/manage-menu" },
  { icon: QrCode, label: "Generate QR", href: "/dashboard/qr-code" },
  { icon: ShoppingBag, label: "Orders", href: "/dashboard/orders" },
  // { icon: Star, label: 'Reviews', href: '/dashboard/reviews' },
  // { icon: Tag, label: 'Offers', href: '/dashboard/offers' },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

// Memoized navigation item component
const NavItem = ({ icon: Icon, label, href, isActive, isOpen }) => (
  <Link
    href={href}
    className={cn(
      "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors hover:bg-accent",
      isActive
        ? "bg-accent text-orange-500"
        : "text-muted-foreground"
    )}
    aria-label={!isOpen ? label : undefined}
  >
    <Icon className="h-5 w-5 flex-shrink-0" />
    {isOpen && <span className="truncate">{label}</span>}
  </Link>
);

// Memoized toggle button component
const ToggleButton = ({ isOpen, onToggle, className, ariaLabel }) => (
  <button
    onClick={onToggle}
    className={className}
    aria-label={ariaLabel}
  >
    {className.includes("lg:flex") ? (
      <ChevronRight
        className={cn(
          "h-4 w-4 transition-transform",
          isOpen ? "rotate-180" : "rotate-0"
        )}
      />
    ) : (
      <Menu className="h-5 w-5" />
    )}
  </button>
);

export default function DashboardSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  const isActive = useCallback(
    (href) => {
      if (href === "/dashboard") {
        return pathname === "/dashboard";
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  // Memoize navigation items with active state
  const navigationItems = useMemo(() => 
    navItems.map(item => ({
      ...item,
      isActive: isActive(item.href)
    })), 
    [isActive]
  );

  // Memoize sidebar classes - Fixed positioning for mobile, relative for desktop
  const sidebarClasses = useMemo(() => cn(
    // Mobile: fixed overlay, Desktop: relative in layout
    "lg:relative fixed top-0 left-0 h-full bg-card border-r border-border z-50 transition-all duration-300",
    isOpen ? "w-64" : "w-20",
    // Mobile transforms
    "transform lg:transform-none",
    isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
  ), [isOpen]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside className={sidebarClasses} role="navigation" aria-label="Main navigation">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link 
            href="/dashboard" 
            className="flex items-center space-x-3 min-w-0"
            aria-label="Smart Menu Dashboard"
          >
            <QrCode className="h-8 w-8 text-orange-500 flex-shrink-0" />
            {isOpen && (
              <span className="font-bold text-xl truncate">Smart Menu</span>
            )}
          </Link>
          
          <ToggleButton
            isOpen={isOpen}
            onToggle={onToggle}
            className="lg:hidden p-2 hover:bg-accent rounded-md"
            ariaLabel="Toggle menu"
          />
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto" role="menu">
          {navigationItems.map(({ icon, label, href, isActive: active }) => (
            <NavItem
              key={href}
              icon={icon}
              label={label}
              href={href}
              isActive={active}
              isOpen={isOpen}
            />
          ))}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-red-500 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors"
            aria-label={isOpen ? "Logout" : "Logout"}
            role="menuitem"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {isOpen && <span className="truncate">Logout</span>}
          </button>
        </nav>

        {/* Desktop toggle button */}
        <ToggleButton
          isOpen={isOpen}
          onToggle={onToggle}
          className="hidden lg:flex absolute -right-3 top-20 bg-card border border-border rounded-full p-1.5 hover:bg-accent transition-colors"
          ariaLabel={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        />
      </aside>
    </>
  );
}
