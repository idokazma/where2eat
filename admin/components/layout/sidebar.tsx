'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  ShieldCheck,
  X,
  Rss,
  GitBranch,
  Microscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pipelineApi } from '@/lib/api';
import { queryKeys, REFETCH_INTERVALS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badgeKey?: 'failed' | 'processing';
}

const sections: NavSection[] = [
  {
    label: '',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Content',
    items: [
      { name: 'Restaurants', href: '/dashboard/restaurants', icon: UtensilsCrossed },
      { name: 'Articles', href: '/dashboard/articles', icon: FileText },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      { name: 'Pipeline', href: '/dashboard/pipeline', icon: GitBranch, badgeKey: 'processing' },
      { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: Rss },
      { name: 'Deep Dive', href: '/dashboard/deepdive', icon: Microscope },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
      { name: 'Verification', href: '/dashboard/verification', icon: ShieldCheck },
      { name: 'Audit Log', href: '/dashboard/audit', icon: FileSearch },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Fetch pipeline overview for badges
  const { data: overviewData } = useQuery({
    queryKey: queryKeys.pipeline.overview(),
    queryFn: () => pipelineApi.getOverview(),
    refetchInterval: REFETCH_INTERVALS.pipelineHistory,
  });
  const overview = overviewData?.overview;
  const failedCount = overview?.failed_24h ?? overview?.failed ?? 0;
  const processingCount = overview?.processing ?? 0;

  // Close mobile menu on route change
  useEffect(() => {
    if (onMobileClose) {
      onMobileClose();
    }
  }, [pathname]);

  const getBadge = (badgeKey?: string) => {
    if (!badgeKey || collapsed) return null;
    if (badgeKey === 'failed' && failedCount > 0) {
      return (
        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-[10px]">
          {failedCount}
        </Badge>
      );
    }
    if (badgeKey === 'processing' && processingCount > 0) {
      return (
        <span className="ml-auto flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      );
    }
    return null;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full border-r bg-card">
      {/* Logo & Mobile Close */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Where2Eat</span>
          </Link>
        )}
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
      <nav className="flex-1 overflow-y-auto p-2">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className={sIdx > 0 ? 'mt-4' : ''}>
            {section.label && !collapsed && (
              <div className="px-3 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {section.label}
                </span>
              </div>
            )}
            {collapsed && section.label && (
              <div className="h-px bg-border mx-2 mb-2" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent relative',
                      isActive
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground',
                      collapsed && 'justify-center'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                    {getBadge(item.badgeKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
