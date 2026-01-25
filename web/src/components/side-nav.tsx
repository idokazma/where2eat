"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Search,
  Clock,
  Map,
  TrendingUp,
  Heart,
  Settings,
  BarChart3
} from "lucide-react"
import { useFavorites } from "@/contexts/favorites-context"
import { useLanguage } from "@/contexts/LanguageContext"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface NavItem {
  title: string
  titleKey: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface SideNavProps {
  className?: string
}

export function SideNav({ className }: SideNavProps) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { favoriteRestaurants } = useFavorites()

  const navItems: NavItem[] = [
    {
      title: "Overview",
      titleKey: "tabs.overview",
      href: "/?tab=overview",
      icon: BarChart3,
    },
    {
      title: "Advanced Search",
      titleKey: "tabs.advancedSearch",
      href: "/?tab=search",
      icon: Search,
    },
    {
      title: "Timeline",
      titleKey: "tabs.timeline",
      href: "/?tab=timeline",
      icon: Clock,
    },
    {
      title: "Map",
      titleKey: "tabs.map",
      href: "/?tab=map",
      icon: Map,
    },
    {
      title: "Favorites",
      titleKey: "tabs.favorites",
      href: "/?tab=favorites",
      icon: Heart,
      badge: favoriteRestaurants.length,
    },
    {
      title: "Analytics",
      titleKey: "tabs.trends",
      href: "/?tab=analytics",
      icon: TrendingUp,
    },
  ]

  const adminItems: NavItem[] = [
    {
      title: "Admin",
      titleKey: "tabs.admin",
      href: "/admin",
      icon: Settings,
    },
  ]

  return (
    <div className={cn(
      "flex h-full w-64 flex-col gap-2 border-r border-border/40 bg-card/50 backdrop-blur-sm p-4",
      className
    )}>
      {/* Logo/Brand */}
      <div className="mb-6 px-3">
        <h2 className="text-2xl font-display font-black tracking-tight text-primary">
          Where2Eat
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t('app.heroSubtitle')}
        </p>
      </div>

      <Separator className="mb-2" />

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          // Check if current route matches (for main dashboard tabs)
          const isMainDashboard = pathname === "/"
          const currentTab = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') || 'overview'
          const itemTab = item.href.includes('?tab=') ? item.href.split('?tab=')[1] : 'overview'
          const isActive = isMainDashboard && currentTab === itemTab

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted/50",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{t(item.titleKey)}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <Badge variant="default" className="ml-auto size-5 flex items-center justify-center p-0 text-xs">
                  {item.badge}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      <Separator className="my-2" />

      {/* Admin Section */}
      <div className="space-y-1">
        {adminItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted/50",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{t(item.titleKey)}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
