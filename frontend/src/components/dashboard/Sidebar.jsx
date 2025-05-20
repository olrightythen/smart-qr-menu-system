"use client";

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FileEdit, QrCode, ShoppingBag, Star, 
  Tag, Settings, LogOut, ChevronRight, PlusSquare, Menu
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: PlusSquare, label: 'Create Menu', href: '/dashboard/create-menu' },
  { icon: FileEdit, label: 'Manage Menu', href: '/dashboard/manage-menu' },
  { icon: QrCode, label: 'Generate QR', href: '/dashboard/qr-code' },
  { icon: ShoppingBag, label: 'Orders', href: '/dashboard/orders' },
  // { icon: Star, label: 'Reviews', href: '/dashboard/reviews' },
  // { icon: Tag, label: 'Offers', href: '/dashboard/offers' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default function DashboardSidebar({ isOpen, onToggle }) {
  const pathname = usePathname();
  
  const isActive = useCallback((href) => {
    // Exact match for dashboard, path-based match for others
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  }, [pathname]);

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={onToggle}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-full bg-card border-r border-border z-50 transition-all duration-300",
        isOpen ? "w-64" : "w-20",
        "transform lg:transform-none",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <QrCode className="h-8 w-8 text-orange-500" />
            {isOpen && <span className="font-bold text-xl">Smart Menu</span>}
          </Link>
          <button 
            onClick={onToggle}
            className="lg:hidden p-2 hover:bg-accent rounded-md"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors hover:bg-accent",
                isActive(href) ? "bg-accent text-orange-500" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {isOpen && <span>{label}</span>}
            </Link>
          ))}

          <button 
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-red-500 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
            {isOpen && <span>Logout</span>}
          </button>
        </nav>

        <button
          onClick={onToggle}
          className="hidden lg:flex absolute -right-3 top-20 bg-card border border-border rounded-full p-1.5 hover:bg-accent transition-colors"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            isOpen ? "rotate-180" : "rotate-0"
          )} />
        </button>
      </aside>
    </>
  );
}
