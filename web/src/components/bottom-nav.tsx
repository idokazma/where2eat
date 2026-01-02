"use client"

import { cn } from "@/lib/utils"
import { Home, Search, Map, Heart, BarChart3 } from "lucide-react"

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  favoritesCount?: number
}

const NAV_ITEMS = [
  { id: 'overview', label: 'סקירה', icon: Home },
  { id: 'search', label: 'חיפוש', icon: Search },
  { id: 'map', label: 'מפה', icon: Map },
  { id: 'favorites', label: 'מועדפים', icon: Heart },
  { id: 'analytics', label: 'נתונים', icon: BarChart3 },
]

export function BottomNav({ activeTab, onTabChange, favoritesCount = 0 }: BottomNavProps) {
  return (
    <nav className="bottom-nav md:hidden" role="navigation" aria-label="ניווט ראשי">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id
        const showBadge = item.id === 'favorites' && favoritesCount > 0

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "bottom-nav-item touch-target",
              isActive && "bottom-nav-item-active"
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="relative">
              <Icon className="size-5" />
              {showBadge && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1
                               flex items-center justify-center
                               bg-primary text-primary-foreground text-[10px] font-bold
                               rounded-full">
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// Safe area padding for devices with home indicators
export function BottomNavSpacer() {
  return <div className="h-20 md:h-0" aria-hidden="true" />
}
