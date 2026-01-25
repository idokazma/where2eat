# Mobile UI/UX Improvement Plan for Where2Eat

**Version**: 1.0
**Date**: 2026-01-25
**Current Stack**: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui

---

## Executive Summary

This document outlines a comprehensive mobile-first UI/UX transformation for the Where2Eat restaurant discovery app. The plan addresses critical mobile usability issues with the current desktop-centric design and provides actionable implementation steps using the existing tech stack.

**Key Priorities**:
1. Replace desktop sidebar with mobile-optimized bottom navigation
2. Optimize touch interactions and thumb-zone accessibility
3. Streamline restaurant discovery flow for small screens
4. Enhance map integration for mobile contexts
5. Improve performance and reduce data usage

---

## 1. Mobile-First Navigation Architecture

### 1.1 Current Issues
- **Desktop Sidebar**: Fixed 256px sidebar (w-64) consumes ~40% of mobile screen width
- **Tab Navigation**: Hidden tabs with URL-based routing not mobile-friendly
- **Hamburger Menu**: No hamburger menu implementation
- **Touch Targets**: Navigation items at 44x40px (py-2.5) - borderline for accessibility

### 1.2 Proposed Solution: Bottom Tab Bar

**Component**: `/web/src/components/mobile-bottom-nav.tsx`

```tsx
"use client"

import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Home, Search, MapPin, Heart, TrendingUp } from "lucide-react"
import { useFavorites } from "@/contexts/favorites-context"
import { useLanguage } from "@/contexts/LanguageContext"

interface NavItem {
  titleKey: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const { favoriteRestaurants } = useFavorites()

  const currentTab = searchParams.get('tab') || 'overview'

  const navItems: NavItem[] = [
    { titleKey: "tabs.overview", href: "/?tab=overview", icon: Home },
    { titleKey: "tabs.advancedSearch", href: "/?tab=search", icon: Search },
    { titleKey: "tabs.map", href: "/?tab=map", icon: MapPin },
    {
      titleKey: "tabs.favorites",
      href: "/?tab=favorites",
      icon: Heart,
      badge: favoriteRestaurants.length
    },
    { titleKey: "tabs.trends", href: "/?tab=analytics", icon: TrendingUp },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/40 pb-safe md:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const itemTab = item.href.includes('?tab=') ? item.href.split('?tab=')[1] : 'overview'
          const isActive = pathname === "/" && currentTab === itemTab

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[56px] rounded-lg transition-all active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:bg-muted/30"
              )}
              aria-label={t(item.titleKey)}
            >
              <div className="relative">
                <Icon className={cn(
                  "size-6 transition-transform",
                  isActive && "scale-110"
                )} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all",
                isActive ? "opacity-100 scale-100" : "opacity-60 scale-95"
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
```

**Implementation in Layout**:
```tsx
// /web/src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <ClientLayout>
          <FavoritesProvider>
            <div className="flex min-h-screen">
              {/* Desktop Sidebar - hidden on mobile */}
              <SideNav className="hidden md:flex" />

              {/* Main Content with bottom padding for mobile nav */}
              <main className="flex-1 overflow-auto pb-20 md:pb-0">
                {children}
              </main>

              {/* Mobile Bottom Navigation */}
              <MobileBottomNav />
            </div>
          </FavoritesProvider>
        </ClientLayout>
      </body>
    </html>
  )
}
```

**Tailwind CSS Utilities to Add** (`globals.css`):
```css
@layer utilities {
  /* Safe area support for notched devices */
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }

  /* Thumb zone accessibility */
  .thumb-zone-primary {
    /* Bottom 1/3 of screen - easiest to reach */
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
  }

  .thumb-zone-secondary {
    /* Middle 1/3 - moderate reach */
    margin-bottom: 2rem;
  }

  /* Minimum touch target size */
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

### 1.3 Responsive Sidebar Behavior

Update `SideNav` component:
```tsx
// /web/src/components/side-nav.tsx
export function SideNav({ className }: { className?: string }) {
  return (
    <div className={cn(
      "flex h-full w-64 flex-col gap-2 border-r border-border/40 bg-card/50 backdrop-blur-sm p-4",
      className // Allow hiding on mobile
    )}>
      {/* Existing sidebar content */}
    </div>
  )
}
```

### 1.4 Secondary Navigation: Hamburger Menu

**Component**: `/web/src/components/mobile-menu-drawer.tsx`

```tsx
"use client"

import { useState } from "react"
import { Menu, X, Settings, Info, Share2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { LanguageToggle } from "./language-toggle"
import { useLanguage } from "@/contexts/LanguageContext"
import Link from "next/link"

export function MobileMenuDrawer() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden touch-target"
          aria-label="Open menu"
        >
          <Menu className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader className="text-right">
          <SheetTitle className="font-display text-2xl">
            {t('app.heroTitle')}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Language Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('settings.language')}</span>
            <LanguageToggle />
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t('menu.quickActions')}
            </h3>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                navigator.share?.({
                  title: 'Where2Eat',
                  text: t('share.text'),
                  url: window.location.href
                })
              }}
            >
              <Share2 className="size-5" />
              {t('menu.share')}
            </Button>
          </div>

          {/* Settings Link */}
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
          >
            <Settings className="size-5 text-muted-foreground" />
            <span>{t('tabs.admin')}</span>
          </Link>

          {/* About Link */}
          <Link
            href="/about"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
          >
            <Info className="size-5 text-muted-foreground" />
            <span>{t('menu.about')}</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

**Add to Hero Header** (in `master-dashboard.tsx`):
```tsx
<div className="absolute top-4 right-4 z-10 flex items-start gap-3">
  <ConnectivityCheck />
  <LanguageToggle className="hidden md:flex" />
  <MobileMenuDrawer />
</div>
```

---

## 2. Touch-Friendly Restaurant Card Optimization

### 2.1 Current Issues
- **Collapsible Design**: Requires precise tapping on small expand button
- **Nested Buttons**: Multiple clickable elements within card can cause mis-taps
- **Dense Layout**: Information density too high for mobile screens
- **Fixed Height**: No optimization for vertical scrolling patterns

### 2.2 Mobile-Optimized Restaurant Card

**Component**: `/web/src/components/mobile-restaurant-card.tsx`

```tsx
"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Heart, Phone, Globe, ChevronRight } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useFavorites } from "@/contexts/favorites-context"
import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"

interface MobileRestaurantCardProps {
  restaurant: Restaurant
  onTap?: (restaurant: Restaurant) => void
}

export function MobileRestaurantCard({ restaurant, onTap }: MobileRestaurantCardProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const { t } = useLanguage()
  const restaurantId = restaurant.name_hebrew
  const isRestaurantFavorite = isFavorite(restaurantId)

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRestaurantFavorite) {
      removeFavorite(restaurantId)
    } else {
      addFavorite(restaurantId)
    }
  }

  const handleCardTap = () => {
    onTap?.(restaurant)
  }

  return (
    <Card
      className="card-interactive overflow-hidden border-0 shadow-md active:shadow-lg"
      onClick={handleCardTap}
    >
      {/* Accent Bar */}
      <div className={`h-1.5 ${getOpinionAccentClass(restaurant.host_opinion)}`} />

      <CardContent className="p-4 space-y-3">
        {/* Header Row - Name, Opinion, Favorite */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl font-bold text-right leading-tight tracking-tight truncate">
              {restaurant.name_hebrew}
            </h3>
            <p className="text-caption mt-1">{restaurant.cuisine_type}</p>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Opinion Badge */}
            <div className="size-10 flex items-center justify-center bg-muted/50 rounded-full">
              <span className="text-xl">{getOpinionIcon(restaurant.host_opinion)}</span>
            </div>

            {/* Favorite Button - Large Touch Target */}
            <button
              onClick={handleFavoriteToggle}
              className="size-10 flex items-center justify-center rounded-full hover:bg-muted transition-all active:scale-95 touch-target"
              aria-label={isRestaurantFavorite ? t('favorites.remove') : t('favorites.add')}
            >
              <Heart className={cn(
                "size-6 transition-all",
                isRestaurantFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground"
              )} />
            </button>
          </div>
        </div>

        {/* Location & Price Row */}
        <div className="flex items-center justify-between gap-3">
          {restaurant.location.city && (
            <Badge variant="secondary" className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5">
              <MapPin className="size-3" />
              {restaurant.location.city}
            </Badge>
          )}
          <span className="font-display text-2xl font-light text-primary/40 flex-shrink-0">
            {getPriceRangeDisplay(restaurant.price_range)}
          </span>
        </div>

        {/* Host Comment - Truncated */}
        {restaurant.host_comments && (
          <p className="text-sm text-muted-foreground italic text-right line-clamp-2 leading-relaxed">
            &ldquo;{restaurant.host_comments}&rdquo;
          </p>
        )}

        {/* Quick Actions - Large Touch Targets */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openGoogleMaps(restaurant)
            }}
            className="flex-1 flex items-center justify-center gap-2 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium active:scale-95 transition-transform touch-target"
          >
            <MapPin className="size-4" />
            {t('common.directions')}
          </button>

          {restaurant.contact_info.phone && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.location.href = `tel:${restaurant.contact_info.phone}`
              }}
              className="flex items-center justify-center h-11 w-11 bg-secondary text-secondary-foreground rounded-xl active:scale-95 transition-transform touch-target"
              aria-label={t('common.call')}
            >
              <Phone className="size-5" />
            </button>
          )}

          {/* Expand Indicator */}
          <div className="flex items-center justify-center h-11 w-11 bg-muted/50 rounded-xl">
            <ChevronRight className="size-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper functions (same as original)
function getOpinionAccentClass(opinion: Restaurant['host_opinion']) {
  // ... existing implementation
}

function getOpinionIcon(opinion: Restaurant['host_opinion']) {
  // ... existing implementation
}

function getPriceRangeDisplay(priceRange: Restaurant['price_range']) {
  // ... existing implementation
}

function openGoogleMaps(restaurant: Restaurant) {
  const query = encodeURIComponent(`${restaurant.name_hebrew} ${restaurant.location.city} restaurant`)
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
}
```

### 2.3 Responsive Card Usage

Update `master-dashboard.tsx` to use responsive cards:
```tsx
{layoutMode === "list" && (
  <div className="space-y-3 stagger-reveal">
    {displayRestaurants.map((restaurant, index) => (
      <>
        {/* Mobile Card */}
        <div className="md:hidden">
          <MobileRestaurantCard
            key={`mobile-${restaurant.name_hebrew}-${index}`}
            restaurant={restaurant}
            onTap={() => router.push(`/restaurant/${encodeURIComponent(restaurant.name_hebrew)}`)}
          />
        </div>

        {/* Desktop Card */}
        <div className="hidden md:block">
          <RestaurantCard
            key={`desktop-${restaurant.name_hebrew}-${index}`}
            restaurant={restaurant}
          />
        </div>
      </>
    ))}
  </div>
)}
```

### 2.4 Full-Screen Restaurant Detail Modal

**Component**: `/web/src/components/restaurant-detail-modal.tsx`

```tsx
"use client"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Restaurant } from "@/types/restaurant"
import { X, MapPin, Phone, Globe, Star, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/contexts/LanguageContext"

interface RestaurantDetailModalProps {
  restaurant: Restaurant | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RestaurantDetailModal({ restaurant, open, onOpenChange }: RestaurantDetailModalProps) {
  const { t } = useLanguage()

  if (!restaurant) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] rounded-t-3xl p-0 flex flex-col"
      >
        {/* Header with close button */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border/40 p-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">
            {restaurant.name_hebrew}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="touch-target"
          >
            <X className="size-6" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="space-y-6 py-6">
            {/* Quick Info */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="px-3 py-1.5">
                {restaurant.cuisine_type}
              </Badge>
              {restaurant.location.city && (
                <Badge variant="outline" className="px-3 py-1.5 flex items-center gap-1">
                  <MapPin className="size-3" />
                  {restaurant.location.city}
                </Badge>
              )}
              <span className="font-display text-2xl text-primary/40">
                {getPriceRangeDisplay(restaurant.price_range)}
              </span>
            </div>

            {/* Host Comment */}
            {restaurant.host_comments && (
              <div className="bg-muted/30 rounded-2xl p-4">
                <p className="text-base text-right leading-relaxed italic">
                  &ldquo;{restaurant.host_comments}&rdquo;
                </p>
                <div className="flex items-center justify-end gap-2 mt-3">
                  <span className="text-2xl">{getOpinionIcon(restaurant.host_opinion)}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(`opinion.${restaurant.host_opinion}`)}
                  </span>
                </div>
              </div>
            )}

            {/* Address */}
            {restaurant.location.address && (
              <div>
                <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                  <MapPin className="size-5 text-primary" />
                  {t('restaurant.address')}
                </h3>
                <div className="bg-muted/20 rounded-xl p-4 text-right">
                  <p className="font-medium">{restaurant.location.address}</p>
                  {restaurant.location.neighborhood && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {restaurant.location.neighborhood}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Menu Items */}
            {restaurant.menu_items.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                  <Star className="size-5 text-amber-500" />
                  {t('restaurant.recommendedMenu')}
                </h3>
                <div className="space-y-3">
                  {restaurant.menu_items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-muted/20 rounded-xl p-4 text-right"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-base">{item.item_name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {item.recommendation_level === 'highly_recommended' && (
                          <span className="text-2xl">⭐</span>
                        )}
                      </div>
                      {item.price && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {item.price}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Special Features */}
            {restaurant.special_features.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-right">
                  {t('restaurant.specialFeatures')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.special_features.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1.5">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Contact Info */}
            <div className="space-y-3">
              {restaurant.contact_info.hours && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="size-5 text-muted-foreground" />
                  <span>{restaurant.contact_info.hours}</span>
                </div>
              )}
              {restaurant.contact_info.phone && (
                <a
                  href={`tel:${restaurant.contact_info.phone}`}
                  className="flex items-center gap-3 text-sm text-primary hover:underline"
                >
                  <Phone className="size-5" />
                  <span>{restaurant.contact_info.phone}</span>
                </a>
              )}
              {restaurant.contact_info.website && (
                <a
                  href={restaurant.contact_info.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-primary hover:underline"
                >
                  <Globe className="size-5" />
                  <span>{t('common.website')}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer with Actions */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-md border-t border-border/40 p-4 safe-area-inset-bottom">
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 h-14 text-base rounded-2xl"
              onClick={() => openGoogleMaps(restaurant)}
            >
              <MapPin className="size-5 mr-2" />
              {t('common.directions')}
            </Button>
            {restaurant.contact_info.phone && (
              <Button
                size="lg"
                variant="secondary"
                className="h-14 px-6 rounded-2xl"
                onClick={() => window.location.href = `tel:${restaurant.contact_info.phone}`}
              >
                <Phone className="size-5" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

---

## 3. Mobile Map Integration

### 3.1 Current Issues
- **Fixed Height**: Map locked at h-96 (384px) - too large on mobile
- **Controls**: Default Google Maps controls not optimized for touch
- **Info Windows**: Desktop-style info windows cramped on mobile
- **Location Services**: No integration with device location/GPS

### 3.2 Mobile-Optimized Map Component

**Component**: `/web/src/components/mobile-map-view.tsx`

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Restaurant } from "@/types/restaurant"
import { MapPin, Navigation, Crosshair, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MobileRestaurantCard } from "./mobile-restaurant-card"
import { RestaurantDetailModal } from "./restaurant-detail-modal"

interface MobileMapViewProps {
  restaurants: Restaurant[]
}

export function MobileMapView({ restaurants }: MobileMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([])

  // Request user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.warn('Location access denied:', error)
        }
      )
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.google) return

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      zoom: userLocation ? 13 : 8,
      center: userLocation || { lat: 31.7683, lng: 35.2137 },
      disableDefaultUI: true, // Remove default controls for mobile
      gestureHandling: 'greedy', // Better touch handling
      styles: [
        {
          featureType: 'poi.business',
          stylers: [{ visibility: 'off' }] // Hide competing restaurants
        }
      ]
    })

    setMap(mapInstance)
  }, [userLocation])

  // Add user location marker
  useEffect(() => {
    if (!map || !userLocation) return

    new window.google.maps.Marker({
      position: userLocation,
      map: map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: 8
      },
      title: 'Your Location'
    })
  }, [map, userLocation])

  const centerOnUser = () => {
    if (map && userLocation) {
      map.setCenter(userLocation)
      map.setZoom(14)
    }
  }

  const findNearbyRestaurants = () => {
    if (!userLocation) return

    // Calculate distances and sort
    const withDistances = restaurants.map(r => ({
      ...r,
      distance: calculateDistance(
        userLocation.lat,
        userLocation.lng,
        r.location.latitude || 0,
        r.location.longitude || 0
      )
    }))

    const sorted = withDistances
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)

    setNearbyRestaurants(sorted)
    setViewMode('list')
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] md:h-auto md:min-h-[500px]">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg"
        style={{
          display: viewMode === 'map' ? 'block' : 'none',
          minHeight: '60vh'
        }}
      />

      {/* List View */}
      {viewMode === 'list' && (
        <div className="h-full overflow-y-auto px-4 pb-20 space-y-3">
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-3 z-10">
            <h3 className="font-semibold text-lg text-right">
              {nearbyRestaurants.length > 0
                ? `מסעדות קרובות (${nearbyRestaurants.length})`
                : 'כל המסעדות'
              }
            </h3>
          </div>
          {(nearbyRestaurants.length > 0 ? nearbyRestaurants : restaurants).map((restaurant, index) => (
            <MobileRestaurantCard
              key={index}
              restaurant={restaurant}
              onTap={(r) => setSelectedRestaurant(r)}
            />
          ))}
        </div>
      )}

      {/* Floating Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* View Toggle */}
        <Button
          size="icon"
          className="size-12 rounded-full shadow-lg bg-card hover:bg-card/90 touch-target"
          onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
        >
          {viewMode === 'map' ? <List className="size-6" /> : <MapPin className="size-6" />}
        </Button>

        {/* Center on User */}
        {userLocation && viewMode === 'map' && (
          <Button
            size="icon"
            className="size-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground touch-target"
            onClick={centerOnUser}
          >
            <Crosshair className="size-6" />
          </Button>
        )}
      </div>

      {/* Find Nearby Button */}
      {userLocation && (
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <Button
            size="lg"
            className="w-full h-14 rounded-2xl shadow-xl text-base"
            onClick={findNearbyRestaurants}
          >
            <Navigation className="size-5 mr-2" />
            מצא מסעדות בקרבתי
          </Button>
        </div>
      )}

      {/* Restaurant Detail Modal */}
      <RestaurantDetailModal
        restaurant={selectedRestaurant}
        open={selectedRestaurant !== null}
        onOpenChange={(open) => !open && setSelectedRestaurant(null)}
      />
    </div>
  )
}

// Helper function
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}
```

---

## 4. Mobile Filter & Search Experience

### 4.1 Current Issues
- **Multiple Filter Dropdowns**: Cramped on mobile screens
- **No Quick Filters**: Users need to drill down for common searches
- **Filter State**: No visual indication of active filters
- **Search UX**: Search bar buried in filter sections

### 4.2 Mobile Filter Sheet

**Component**: `/web/src/components/mobile-filter-sheet.tsx`

```tsx
"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Filter, X, MapPin, Utensils, DollarSign } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface MobileFilterSheetProps {
  restaurants: Restaurant[]
  filters: {
    selectedCity: string
    selectedCuisines: string[]
    selectedPriceRanges: string[]
  }
  onFiltersChange: (filters: any) => void
  onClear: () => void
}

export function MobileFilterSheet({
  restaurants,
  filters,
  onFiltersChange,
  onClear
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false)

  // Extract unique values
  const cities = Array.from(new Set(restaurants.map(r => r.location.city).filter(Boolean)))
  const cuisines = Array.from(new Set(restaurants.map(r => r.cuisine_type)))
  const priceRanges = ['budget', 'mid-range', 'expensive']

  // Count active filters
  const activeFilterCount =
    (filters.selectedCity !== 'all' ? 1 : 0) +
    filters.selectedCuisines.length +
    filters.selectedPriceRanges.length

  const toggleCuisine = (cuisine: string) => {
    onFiltersChange({
      ...filters,
      selectedCuisines: filters.selectedCuisines.includes(cuisine)
        ? filters.selectedCuisines.filter(c => c !== cuisine)
        : [...filters.selectedCuisines, cuisine]
    })
  }

  const togglePriceRange = (price: string) => {
    onFiltersChange({
      ...filters,
      selectedPriceRanges: filters.selectedPriceRanges.includes(price)
        ? filters.selectedPriceRanges.filter(p => p !== price)
        : [...filters.selectedPriceRanges, price]
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="relative h-12 px-4 rounded-2xl"
        >
          <Filter className="size-5 mr-2" />
          סינון
          {activeFilterCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-2 -right-2 size-6 flex items-center justify-center p-0"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-2xl font-display">סינון מסעדות</SheetTitle>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClear()
                  setOpen(false)
                }}
              >
                נקה הכל
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Filter Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Location Section */}
            <div>
              <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                <MapPin className="size-5 text-primary" />
                מיקום
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filters.selectedCity === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 rounded-full"
                  onClick={() => onFiltersChange({ ...filters, selectedCity: 'all' })}
                >
                  הכל
                </Button>
                {cities.map(city => (
                  <Button
                    key={city}
                    variant={filters.selectedCity === city ? 'default' : 'outline'}
                    size="sm"
                    className="h-10 rounded-full"
                    onClick={() => onFiltersChange({ ...filters, selectedCity: city })}
                  >
                    {city}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Cuisine Section */}
            <div>
              <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                <Utensils className="size-5 text-primary" />
                סוג מטבח
              </h3>
              <div className="flex flex-wrap gap-2">
                {cuisines.map(cuisine => {
                  const isSelected = filters.selectedCuisines.includes(cuisine)
                  return (
                    <Button
                      key={cuisine}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-10 rounded-full"
                      onClick={() => toggleCuisine(cuisine)}
                    >
                      {cuisine}
                      {isSelected && <X className="size-3 mr-1" />}
                    </Button>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Price Range Section */}
            <div>
              <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                <DollarSign className="size-5 text-primary" />
                טווח מחירים
              </h3>
              <div className="flex gap-2">
                {priceRanges.map(price => {
                  const isSelected = filters.selectedPriceRanges.includes(price)
                  return (
                    <Button
                      key={price}
                      variant={isSelected ? 'default' : 'outline'}
                      size="lg"
                      className="flex-1 h-14 rounded-2xl"
                      onClick={() => togglePriceRange(price)}
                    >
                      {getPriceDisplay(price)}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer with Apply Button */}
        <SheetFooter className="p-6 border-t">
          <Button
            size="lg"
            className="w-full h-14 text-base rounded-2xl"
            onClick={() => setOpen(false)}
          >
            הצג תוצאות
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function getPriceDisplay(price: string) {
  const displays = {
    'budget': '₪',
    'mid-range': '₪₪',
    'expensive': '₪₪₪'
  }
  return displays[price] || price
}
```

### 4.3 Quick Filter Chips

Add above restaurant list in `master-dashboard.tsx`:
```tsx
<div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide md:hidden">
  <MobileFilterSheet
    restaurants={allRestaurants}
    filters={classicFilters}
    onFiltersChange={setClassicFilters}
    onClear={clearClassicFilters}
  />

  {/* Quick Filter Chips */}
  <Button
    variant="outline"
    size="sm"
    className="rounded-full flex-shrink-0"
    onClick={() => setClassicFilters({ ...classicFilters, selectedCity: 'תל אביב' })}
  >
    תל אביב
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="rounded-full flex-shrink-0"
    onClick={() => setClassicFilters({ ...classicFilters, selectedCuisines: ['Italian'] })}
  >
    איטלקי
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="rounded-full flex-shrink-0"
    onClick={() => setClassicFilters({ ...classicFilters, selectedPriceRanges: ['budget'] })}
  >
    ₪ זול
  </Button>
</div>
```

---

## 5. Performance Optimization for Mobile

### 5.1 Image Optimization

**Update**: Use Next.js Image component with responsive sizing

```tsx
// /web/src/components/restaurant-image.tsx
"use client"

import Image from "next/image"
import { useState } from "react"

interface RestaurantImageProps {
  src: string
  alt: string
  priority?: boolean
}

export function RestaurantImage({ src, alt, priority = false }: RestaurantImageProps) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className="relative aspect-wide overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className={`object-cover transition-all duration-300 ${
          isLoading ? 'scale-110 blur-sm' : 'scale-100 blur-0'
        }`}
        onLoadingComplete={() => setIsLoading(false)}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
    </div>
  )
}
```

### 5.2 Lazy Loading & Virtual Scrolling

Install react-virtuoso for efficient list rendering:
```bash
npm install react-virtuoso
```

**Component**: `/web/src/components/virtualized-restaurant-list.tsx`

```tsx
"use client"

import { Virtuoso } from 'react-virtuoso'
import { Restaurant } from "@/types/restaurant"
import { MobileRestaurantCard } from "./mobile-restaurant-card"

interface VirtualizedRestaurantListProps {
  restaurants: Restaurant[]
  onRestaurantTap?: (restaurant: Restaurant) => void
}

export function VirtualizedRestaurantList({
  restaurants,
  onRestaurantTap
}: VirtualizedRestaurantListProps) {
  return (
    <Virtuoso
      data={restaurants}
      totalCount={restaurants.length}
      itemContent={(index, restaurant) => (
        <div className="px-4 pb-3">
          <MobileRestaurantCard
            restaurant={restaurant}
            onTap={onRestaurantTap}
          />
        </div>
      )}
      style={{ height: 'calc(100vh - 10rem)' }}
      overscan={200}
    />
  )
}
```

### 5.3 Reduced Data Mode

**Component**: `/web/src/components/data-saver-toggle.tsx`

```tsx
"use client"

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Wifi, WifiOff } from "lucide-react"

export function DataSaverToggle() {
  const [dataSaver, setDataSaver] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('dataSaver') === 'true'
    setDataSaver(saved)
  }, [])

  const handleToggle = (checked: boolean) => {
    setDataSaver(checked)
    localStorage.setItem('dataSaver', checked.toString())

    // Dispatch event for other components to listen
    window.dispatchEvent(new CustomEvent('dataSaverChange', { detail: checked }))
  }

  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-lg">
      <div className="flex items-center gap-3">
        {dataSaver ? <WifiOff className="size-5" /> : <Wifi className="size-5" />}
        <div>
          <Label htmlFor="data-saver" className="text-sm font-medium">
            מצב חיסכון בנתונים
          </Label>
          <p className="text-xs text-muted-foreground">
            הפחת שימוש בתמונות ואנימציות
          </p>
        </div>
      </div>
      <Switch
        id="data-saver"
        checked={dataSaver}
        onCheckedChange={handleToggle}
      />
    </div>
  )
}
```

Use in components:
```tsx
useEffect(() => {
  const handleDataSaverChange = (e: CustomEvent) => {
    setImageQuality(e.detail ? 'low' : 'high')
  }

  window.addEventListener('dataSaverChange', handleDataSaverChange as any)
  return () => window.removeEventListener('dataSaverChange', handleDataSaverChange as any)
}, [])
```

### 5.4 Progressive Web App Enhancements

Update `manifest.json`:
```json
{
  "name": "Where2Eat - Restaurant Discovery",
  "short_name": "Where2Eat",
  "description": "Discover recommended restaurants from Hebrew food podcasts",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FBF9F7",
  "theme_color": "#F97066",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["food", "lifestyle"],
  "screenshots": [
    {
      "src": "/screenshots/mobile-home.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

---

## 6. Accessibility Enhancements

### 6.1 ARIA Labels and Roles

Update all interactive elements:
```tsx
// Example: Mobile Bottom Nav
<Link
  href={item.href}
  role="tab"
  aria-label={t(item.titleKey)}
  aria-current={isActive ? 'page' : undefined}
  className="..."
>
  {/* content */}
</Link>
```

### 6.2 Screen Reader Announcements

**Component**: `/web/src/components/screen-reader-announcer.tsx`

```tsx
"use client"

import { useEffect, useRef } from "react"

interface ScreenReaderAnnouncerProps {
  message: string
  politeness?: 'polite' | 'assertive'
}

export function ScreenReaderAnnouncer({
  message,
  politeness = 'polite'
}: ScreenReaderAnnouncerProps) {
  const announcerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (announcerRef.current && message) {
      announcerRef.current.textContent = message
    }
  }, [message])

  return (
    <div
      ref={announcerRef}
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    />
  )
}

// Usage in master-dashboard.tsx
const [announcement, setAnnouncement] = useState('')

useEffect(() => {
  if (displayRestaurants.length > 0) {
    setAnnouncement(`נמצאו ${displayRestaurants.length} מסעדות`)
  }
}, [displayRestaurants])

return (
  <>
    <ScreenReaderAnnouncer message={announcement} />
    {/* rest of component */}
  </>
)
```

### 6.3 Keyboard Navigation

Add keyboard support to mobile components:
```tsx
// Mobile Restaurant Card
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleCardTap()
  }
}

return (
  <Card
    onClick={handleCardTap}
    onKeyDown={handleKeyDown}
    tabIndex={0}
    role="button"
    aria-label={`${restaurant.name_hebrew}, ${restaurant.cuisine_type}`}
  >
    {/* content */}
  </Card>
)
```

### 6.4 High Contrast Mode

Add to `globals.css`:
```css
@media (prefers-contrast: high) {
  :root {
    --border: oklch(0.3 0 0);
    --primary: oklch(0.4 0.25 35);
    --muted-foreground: oklch(0.3 0 0);
  }

  .dark {
    --border: oklch(0.7 0 0);
    --primary: oklch(0.7 0.25 35);
  }

  /* Increase all border widths */
  * {
    border-width: 2px;
  }

  /* Remove subtle effects */
  .card-interactive:hover {
    box-shadow: 0 0 0 3px var(--primary);
  }
}
```

---

## 7. Swipe Gestures

### 7.1 Install Gesture Library

```bash
npm install react-use-gesture
```

### 7.2 Swipeable Restaurant Cards

```tsx
"use client"

import { useGesture } from '@use-gesture/react'
import { useSpring, animated } from '@react-spring/web'

export function SwipeableRestaurantCard({ restaurant, onSwipeLeft, onSwipeRight }) {
  const [{ x }, api] = useSpring(() => ({ x: 0 }))

  const bind = useGesture({
    onDrag: ({ down, movement: [mx], direction: [xDir], velocity: [vx] }) => {
      const trigger = vx > 0.2
      const dir = xDir < 0 ? -1 : 1

      if (!down && trigger) {
        if (dir === -1) {
          onSwipeLeft?.(restaurant)
        } else {
          onSwipeRight?.(restaurant)
        }
      }

      api.start({
        x: down ? mx : 0,
        immediate: down
      })
    },
  })

  return (
    <animated.div
      {...bind()}
      style={{ x, touchAction: 'pan-y' }}
    >
      <MobileRestaurantCard restaurant={restaurant} />
    </animated.div>
  )
}
```

### 7.3 Pull-to-Refresh

```tsx
"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

export function PullToRefresh({ onRefresh }) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const threshold = 80

  useEffect(() => {
    let startY = 0

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0) return

      const currentY = e.touches[0].clientY
      const distance = currentY - startY

      if (distance > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(distance, threshold * 1.5))
        setPulling(distance > threshold)
      }
    }

    const handleTouchEnd = () => {
      if (pullDistance > threshold) {
        onRefresh()
      }
      setPullDistance(0)
      setPulling(false)
      startY = 0
    }

    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, onRefresh])

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-center transition-all z-50"
      style={{
        height: pullDistance,
        opacity: pullDistance / threshold
      }}
    >
      <div className={`p-3 bg-card rounded-full shadow-lg ${pulling ? 'animate-spin' : ''}`}>
        <RefreshCw className="size-6 text-primary" />
      </div>
    </div>
  )
}
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Priority: Critical**

1. **Mobile Bottom Navigation** (Day 1-2)
   - Create `MobileBottomNav` component
   - Update layout.tsx with responsive navigation
   - Test on iOS and Android devices

2. **Mobile Restaurant Card** (Day 3-4)
   - Implement `MobileRestaurantCard` with touch targets
   - Add swipe gestures for quick actions
   - Test touch interaction patterns

3. **Responsive Layout Adjustments** (Day 5)
   - Hide desktop sidebar on mobile
   - Add bottom padding for mobile nav
   - Test on multiple screen sizes

### Phase 2: Enhanced Interactions (Week 2)
**Priority: High**

1. **Restaurant Detail Modal** (Day 1-2)
   - Create full-screen bottom sheet modal
   - Implement sticky footer with CTAs
   - Add safe area insets

2. **Mobile Filter Sheet** (Day 3-4)
   - Build slide-up filter interface
   - Add quick filter chips
   - Implement filter state management

3. **Mobile Map View** (Day 5)
   - Optimize map for touch controls
   - Add user location features
   - Implement nearby restaurants finder

### Phase 3: Performance & PWA (Week 3)
**Priority: High**

1. **Image Optimization** (Day 1)
   - Implement Next.js Image component
   - Add responsive image sizing
   - Lazy load below-fold images

2. **Virtual Scrolling** (Day 2)
   - Integrate react-virtuoso
   - Test with large restaurant lists
   - Optimize scroll performance

3. **PWA Enhancements** (Day 3-4)
   - Update manifest.json
   - Add install prompts
   - Test offline functionality

4. **Data Saver Mode** (Day 5)
   - Implement data saver toggle
   - Reduce image quality when enabled
   - Disable animations in data saver mode

### Phase 4: Accessibility & Polish (Week 4)
**Priority: Medium**

1. **ARIA Labels & Screen Reader** (Day 1-2)
   - Add comprehensive ARIA labels
   - Implement screen reader announcements
   - Test with VoiceOver and TalkBack

2. **Keyboard Navigation** (Day 3)
   - Add keyboard support to mobile components
   - Test tab order and focus indicators

3. **High Contrast Mode** (Day 4)
   - Implement high contrast styles
   - Test with system accessibility settings

4. **Gesture Enhancements** (Day 5)
   - Add pull-to-refresh
   - Implement swipe actions
   - Polish animations

### Phase 5: Testing & Optimization (Week 5)
**Priority: Medium**

1. **Device Testing**
   - iOS Safari (iPhone SE, 12, 14, 15)
   - Android Chrome (various screen sizes)
   - Tablet layouts (iPad, Android tablets)

2. **Performance Audits**
   - Lighthouse mobile scores (target: 90+)
   - Core Web Vitals optimization
   - Bundle size reduction

3. **User Testing**
   - Conduct mobile usability tests
   - Gather feedback on touch interactions
   - Iterate based on findings

---

## 9. Tailwind CSS Mobile Utilities Reference

### Touch Target Sizes
```css
/* Minimum 44x44px touch targets */
.touch-target {
  @apply min-w-[44px] min-h-[44px] flex items-center justify-center;
}

.touch-target-lg {
  @apply min-w-[56px] min-h-[56px];
}
```

### Responsive Spacing
```css
/* Mobile-first padding */
.container-mobile {
  @apply px-4 py-3 md:px-6 md:py-4;
}

/* Bottom nav clearance */
.pb-nav {
  @apply pb-20 md:pb-0;
}
```

### Typography Scale
```css
/* Mobile-optimized text sizes */
.text-mobile-h1 {
  @apply text-2xl md:text-4xl font-display font-bold;
}

.text-mobile-body {
  @apply text-base md:text-lg leading-relaxed;
}
```

### Thumb Zone Layout
```css
/* Bottom third - primary actions */
.thumb-zone-primary {
  @apply fixed bottom-0 left-0 right-0 p-4 pb-safe;
}

/* Top third - secondary actions */
.thumb-zone-secondary {
  @apply fixed top-0 left-0 right-0 p-4 pt-safe;
}
```

### Gesture Animations
```css
@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 10. Testing Checklist

### Device Testing
- [ ] iPhone SE (375px width)
- [ ] iPhone 12/13/14 (390px width)
- [ ] iPhone 14 Pro Max (430px width)
- [ ] Samsung Galaxy S21 (360px width)
- [ ] Samsung Galaxy S21 Ultra (412px width)
- [ ] iPad Mini (768px width)
- [ ] iPad Pro (1024px width)

### Touch Interaction Testing
- [ ] All buttons minimum 44x44px
- [ ] Swipe gestures work smoothly
- [ ] Pull-to-refresh functions correctly
- [ ] Bottom nav doesn't interfere with scrolling
- [ ] Modal sheets dismiss properly
- [ ] Map pinch-zoom works

### Performance Testing
- [ ] Lighthouse mobile score > 90
- [ ] First Contentful Paint < 1.8s
- [ ] Time to Interactive < 3.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Virtual scrolling handles 1000+ items

### Accessibility Testing
- [ ] VoiceOver navigation (iOS)
- [ ] TalkBack navigation (Android)
- [ ] Keyboard navigation works
- [ ] High contrast mode functional
- [ ] Focus indicators visible
- [ ] Color contrast ratios pass WCAG AA

### Cross-Browser Testing
- [ ] Safari iOS (latest 2 versions)
- [ ] Chrome Android (latest 2 versions)
- [ ] Samsung Internet
- [ ] Firefox Mobile

---

## 11. Key Metrics & Success Criteria

### User Experience Metrics
- **Task Completion Rate**: >95% for "Find nearby restaurant"
- **Average Time to Restaurant Detail**: <3 seconds
- **Filter Application Speed**: <500ms
- **Map Load Time**: <2 seconds

### Performance Metrics
- **Mobile Lighthouse Score**: >90
- **First Input Delay**: <100ms
- **Bundle Size**: <300KB initial load
- **Image Load Time**: <1s on 4G

### Engagement Metrics
- **Mobile Bounce Rate**: <40%
- **Average Session Duration**: >2 minutes
- **Pages per Session**: >3
- **Return User Rate**: >30%

---

## 12. Additional Resources

### Design References
- [iOS Human Interface Guidelines - Touch](https://developer.apple.com/design/human-interface-guidelines/touchs)
- [Material Design - Touch Targets](https://m3.material.io/foundations/interaction/states/state-layers)
- [WCAG 2.1 Mobile Accessibility](https://www.w3.org/WAI/standards-guidelines/mobile/)

### Code Examples
- [Next.js Mobile Optimization](https://nextjs.org/docs/advanced-features/mobile-optimization)
- [React Spring Gestures](https://use-gesture.netlify.app/)
- [Radix UI Mobile Patterns](https://www.radix-ui.com/primitives/docs/components/dialog#mobile-considerations)

### Testing Tools
- Chrome DevTools Device Mode
- BrowserStack for real device testing
- Lighthouse CI for automated audits
- axe DevTools for accessibility testing

---

## Appendix A: Component File Structure

```
web/src/components/
├── mobile/
│   ├── mobile-bottom-nav.tsx
│   ├── mobile-menu-drawer.tsx
│   ├── mobile-restaurant-card.tsx
│   ├── mobile-filter-sheet.tsx
│   ├── mobile-map-view.tsx
│   └── restaurant-detail-modal.tsx
├── shared/
│   ├── restaurant-card.tsx (desktop)
│   ├── restaurant-image.tsx
│   ├── virtualized-restaurant-list.tsx
│   └── data-saver-toggle.tsx
└── accessibility/
    ├── screen-reader-announcer.tsx
    └── skip-to-content.tsx
```

---

## Appendix B: Environment Variables

```env
# Mobile-specific configurations
NEXT_PUBLIC_ENABLE_MOBILE_GESTURES=true
NEXT_PUBLIC_ENABLE_DATA_SAVER=true
NEXT_PUBLIC_MAP_DEFAULT_ZOOM=13
NEXT_PUBLIC_IMAGE_QUALITY_MOBILE=75
NEXT_PUBLIC_VIRTUAL_SCROLL_THRESHOLD=50
```

---

## Conclusion

This mobile UI/UX improvement plan transforms Where2Eat from a desktop-first application into a mobile-optimized, touch-friendly restaurant discovery experience. The implementation focuses on:

1. **Thumb-zone optimization** for one-handed use
2. **Bottom navigation** for primary actions
3. **Large touch targets** (minimum 44x44px)
4. **Swipe gestures** for natural interactions
5. **Performance optimization** with lazy loading and virtual scrolling
6. **Accessibility** built-in from the start

The phased approach allows for incremental improvements while maintaining development velocity. Priority is given to foundational changes that have the highest impact on mobile usability.

**Next Steps**: Begin with Phase 1 (Foundation) and gather user feedback after each phase to validate improvements and adjust the roadmap as needed.
