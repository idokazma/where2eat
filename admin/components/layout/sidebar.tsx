'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  FileText,
  Video,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Restaurants', href: '/dashboard/restaurants', icon: UtensilsCrossed },
  { name: 'Articles', href: '/dashboard/articles', icon: FileText },
  { name: 'Videos', href: '/dashboard/videos', icon: Video },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Audit Log', href: '/dashboard/audit', icon: FileSearch },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    if (onMobileClose) {
      onMobileClose();
    }
  }, [pathname]);

  const sidebarContent = (
    <div className="flex flex-col h-full border-r bg-card"
>
      {/* Logo & Mobile Close */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Where2Eat</span>
          </Link>
        )}
        {/* Mobile close button */}
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={onMobileClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {/* Desktop collapse button */}
        {!onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 hidden lg:flex', collapsed && 'mx-auto')}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        {!collapsed && (
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold">Admin Dashboard</p>
            <p>v1.0.0</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn(
        'hidden lg:flex transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}>
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
