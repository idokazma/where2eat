"use client"

import { Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Search,
  Map,
  Heart,
  TrendingUp
} from "lucide-react"
import { useFavorites } from "@/contexts/favorites-context"
import { useLanguage } from "@/contexts/LanguageContext"

interface NavItem {
  titleKey: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

function MobileBottomNavContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const { favoriteRestaurants } = useFavorites()

  const currentTab = searchParams.get('tab') || 'overview'

  const navItems: NavItem[] = [
    {
      titleKey: "tabs.overview",
      href: "/?tab=overview",
      icon: LayoutDashboard
    },
    {
      titleKey: "tabs.advancedSearch",
      href: "/?tab=search",
      icon: Search
    },
    {
      titleKey: "tabs.map",
      href: "/?tab=map",
      icon: Map
    },
    {
      titleKey: "tabs.favorites",
      href: "/?tab=favorites",
      icon: Heart,
      badge: favoriteRestaurants.length
    },
    {
      titleKey: "tabs.trends",
      href: "/?tab=analytics",
      icon: TrendingUp
    },
  ]

  // Don't show on admin page
  if (pathname === "/admin") {
    return null
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/40 md:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const itemTab = item.href.includes('?tab=')
            ? item.href.split('?tab=')[1]
            : 'overview'
          const isActive = pathname === "/" && currentTab === itemTab

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[56px] rounded-xl transition-all active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:bg-muted/30"
              )}
              aria-label={t(item.titleKey)}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className={cn(
                  "size-6 transition-transform",
                  isActive && "scale-110"
                )} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 size-4 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full"
                    aria-label={`${item.badge} items`}
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all max-w-[60px] truncate",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {t(item.titleKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// Wrapper with Suspense for useSearchParams
export function MobileBottomNav() {
  return (
    <Suspense fallback={null}>
      <MobileBottomNavContent />
    </Suspense>
  )
}
