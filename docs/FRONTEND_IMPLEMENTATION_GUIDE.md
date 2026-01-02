# Frontend Implementation Guide

## For the Where2Eat Development Team

This guide provides step-by-step instructions for implementing the design improvements outlined in `WEBSITE_DESIGN_PLAN.md`. It includes code examples, component specifications, and implementation priorities.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Development Setup](#2-development-setup)
3. [Phase 1: Design System Foundation](#3-phase-1-design-system-foundation)
4. [Phase 2: Component Redesign](#4-phase-2-component-redesign)
5. [Phase 3: New Components](#5-phase-3-new-components)
6. [Phase 4: Animations & Polish](#6-phase-4-animations--polish)
7. [Testing Checklist](#7-testing-checklist)
8. [Accessibility Requirements](#8-accessibility-requirements)

---

## 1. Project Overview

### Current Tech Stack
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.1 | React Framework |
| React | 19.2.3 | UI Library |
| TypeScript | 5.x | Type Safety |
| Tailwind CSS | 4.x | Styling |
| Radix UI | Latest | Headless Components |
| Lucide React | Latest | Icons |

### Key Files to Modify
```
web/src/
├── app/
│   └── globals.css           # Theme variables (already well-configured)
├── components/
│   ├── ui/                   # Base components
│   │   ├── button.tsx        # Enhance with new variants
│   │   ├── card.tsx          # Add hover effects
│   │   ├── badge.tsx         # Add sentiment variants
│   │   └── input.tsx         # Improve search styling
│   ├── restaurant-card.tsx   # MAJOR REDESIGN
│   ├── unified-search.tsx    # Add filter chips
│   ├── master-dashboard.tsx  # Update navigation
│   └── [new components]      # See Phase 3
└── types/
    └── restaurant.ts         # Already comprehensive
```

---

## 2. Development Setup

### Prerequisites
```bash
cd web
npm install
npm run dev
```

### Development Commands
```bash
# Start dev server
npm run dev

# Type checking
npm run type-check

# Lint
npm run lint

# Build for production
npm run build
```

### Browser Testing
Test on these browsers:
- Chrome (primary)
- Safari (RTL rendering)
- Firefox
- Mobile Safari/Chrome

---

## 3. Phase 1: Design System Foundation

### 3.1 Update Tailwind Config

Create/update `web/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Custom animations
      animation: {
        'heart-pop': 'heartPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.3)' },
          '50%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      // Spacing for consistent layouts
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      // Custom shadows
      boxShadow: {
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.1), 0 4px 12px -4px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 8px 24px -4px rgba(0, 0, 0, 0.15), 0 12px 32px -8px rgba(0, 0, 0, 0.1)',
        'button': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}

export default config
```

### 3.2 Add Utility Classes to globals.css

Append to `web/src/app/globals.css`:

```css
/* ============================================
   PHASE 1: Enhanced Utility Classes
   ============================================ */

@layer components {
  /* Card Hover Effect */
  .card-interactive {
    @apply transition-all duration-200 ease-out;
  }

  .card-interactive:hover {
    @apply shadow-card-hover;
    transform: translateY(-2px);
  }

  /* Sentiment Badge Styles */
  .sentiment-positive {
    @apply bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300;
  }

  .sentiment-negative {
    @apply bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300;
  }

  .sentiment-mixed {
    @apply bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300;
  }

  .sentiment-neutral {
    @apply bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300;
  }

  /* Filter Chip */
  .filter-chip {
    @apply inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
           border border-border bg-background cursor-pointer
           transition-all duration-150 ease-out
           hover:bg-accent hover:border-primary/50;
  }

  .filter-chip-active {
    @apply bg-primary text-primary-foreground border-primary;
  }

  /* Skeleton Loading */
  .skeleton {
    @apply bg-muted animate-pulse rounded;
  }

  .skeleton-shimmer {
    @apply bg-gradient-to-r from-muted via-muted-foreground/10 to-muted
           bg-[length:200%_100%] animate-shimmer;
  }

  /* Image Container with Fallback */
  .image-container {
    @apply relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5;
  }

  /* Price Display */
  .price-indicator {
    @apply inline-flex items-center font-medium;
  }

  .price-active {
    @apply text-primary;
  }

  .price-inactive {
    @apply text-muted-foreground/40;
  }

  /* Stat Card */
  .stat-card {
    @apply bg-card rounded-xl p-4 border border-border
           flex flex-col gap-1;
  }

  .stat-value {
    @apply text-2xl font-bold text-foreground;
  }

  .stat-label {
    @apply text-sm text-muted-foreground;
  }

  /* RTL-Safe Flexbox */
  .flex-rtl {
    @apply flex flex-row-reverse;
  }

  /* Touch-Friendly Targets */
  .touch-target {
    @apply min-h-[44px] min-w-[44px];
  }
}

/* ============================================
   Custom Scrollbar for Filter Areas
   ============================================ */
.scroll-container {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
}

.scroll-container::-webkit-scrollbar {
  height: 4px;
}

.scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-container::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 2px;
}

/* ============================================
   Mobile Bottom Navigation
   ============================================ */
@layer components {
  .bottom-nav {
    @apply fixed bottom-0 left-0 right-0
           bg-background/95 backdrop-blur-md
           border-t border-border
           flex justify-around items-center
           h-16 px-4 z-50
           md:hidden;
  }

  .bottom-nav-item {
    @apply flex flex-col items-center gap-0.5
           text-muted-foreground text-xs
           p-2 rounded-lg
           transition-colors duration-150;
  }

  .bottom-nav-item-active {
    @apply text-primary bg-primary/10;
  }
}
```

---

## 4. Phase 2: Component Redesign

### 4.1 Enhanced Restaurant Card

Replace `web/src/components/restaurant-card.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  MapPin, Clock, Phone, Globe, Star, Heart,
  ChevronDown, ChevronUp, Play, ExternalLink,
  Utensils
} from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useFavorites } from "@/contexts/favorites-context"
import { cn } from "@/lib/utils"

interface RestaurantCardProps {
  restaurant: Restaurant
  variant?: 'default' | 'compact' | 'featured'
}

// Sentiment configuration
const SENTIMENT_CONFIG = {
  positive: {
    icon: '👍',
    label: 'מומלץ',
    className: 'sentiment-positive',
    iconBg: 'bg-green-500'
  },
  negative: {
    icon: '👎',
    label: 'לא מומלץ',
    className: 'sentiment-negative',
    iconBg: 'bg-red-500'
  },
  mixed: {
    icon: '🤔',
    label: 'מעורב',
    className: 'sentiment-mixed',
    iconBg: 'bg-amber-500'
  },
  neutral: {
    icon: '😐',
    label: 'ניטרלי',
    className: 'sentiment-neutral',
    iconBg: 'bg-gray-500'
  }
} as const

// Status badges
const STATUS_CONFIG = {
  open: { label: 'פתוח', variant: 'default' as const },
  closed: { label: 'סגור', variant: 'destructive' as const },
  new_opening: { label: 'פתיחה חדשה', variant: 'secondary' as const },
  closing_soon: { label: 'נסגר בקרוב', variant: 'destructive' as const },
  reopening: { label: 'נפתח מחדש', variant: 'outline' as const }
}

// Price display component
function PriceIndicator({ priceRange }: { priceRange: Restaurant['price_range'] }) {
  const levels = ['budget', 'mid-range', 'expensive']
  const activeIndex = levels.indexOf(priceRange)

  if (priceRange === 'not_mentioned') {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  return (
    <div className="price-indicator">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "text-sm",
            i <= activeIndex ? "price-active" : "price-inactive"
          )}
        >
          ₪
        </span>
      ))}
    </div>
  )
}

// Cuisine icon placeholder (replace with actual icons if available)
function CuisineIcon({ cuisine }: { cuisine: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
      <Utensils className="size-12 text-primary/40" />
    </div>
  )
}

export function RestaurantCard({ restaurant, variant = 'default' }: RestaurantCardProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const restaurantId = restaurant.name_hebrew
  const isRestaurantFavorite = isFavorite(restaurantId)
  const [isExpanded, setIsExpanded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isHeartAnimating, setIsHeartAnimating] = useState(false)

  const sentiment = SENTIMENT_CONFIG[restaurant.host_opinion]
  const status = STATUS_CONFIG[restaurant.status]

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsHeartAnimating(true)
    setTimeout(() => setIsHeartAnimating(false), 400)

    if (isRestaurantFavorite) {
      removeFavorite(restaurantId)
    } else {
      addFavorite(restaurantId)
    }
  }

  const toggleExpanded = () => setIsExpanded(!isExpanded)

  // Get Google rating stars
  const renderRating = () => {
    if (!restaurant.rating?.google_rating) return null
    const rating = restaurant.rating.google_rating
    return (
      <div className="flex items-center gap-1">
        <Star className="size-4 fill-amber-400 text-amber-400" />
        <span className="font-semibold">{rating.toFixed(1)}</span>
        {restaurant.rating.total_reviews && (
          <span className="text-muted-foreground text-sm">
            ({restaurant.rating.total_reviews})
          </span>
        )}
      </div>
    )
  }

  return (
    <Card
      className={cn(
        "w-full card-interactive cursor-pointer overflow-hidden",
        variant === 'featured' && "border-primary/50"
      )}
      onClick={toggleExpanded}
    >
      {/* Hero Image Section */}
      <div className="relative h-40 image-container">
        <CuisineIcon cuisine={restaurant.cuisine_type} />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 right-3 flex gap-2">
          <Badge variant={status.variant} className="text-xs">
            {status.label}
          </Badge>
          {restaurant.status === 'new_opening' && (
            <Badge className="bg-amber-500 text-white text-xs">חדש!</Badge>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={toggleFavorite}
          className={cn(
            "absolute top-3 left-3 p-2 rounded-full",
            "bg-white/90 dark:bg-black/50 backdrop-blur-sm",
            "transition-transform duration-200",
            "hover:scale-110",
            isHeartAnimating && "animate-heart-pop"
          )}
          aria-label={isRestaurantFavorite ? "הסר ממועדפים" : "הוסף למועדפים"}
        >
          <Heart
            className={cn(
              "size-5 transition-colors",
              isRestaurantFavorite
                ? "fill-red-500 text-red-500"
                : "text-gray-600 dark:text-gray-300"
            )}
          />
        </button>

        {/* Bottom Info on Image */}
        <div className="absolute bottom-3 right-3 left-3">
          <h3 className="text-xl font-bold text-white drop-shadow-lg text-right">
            {restaurant.name_hebrew}
          </h3>
          {restaurant.name_english && (
            <p className="text-white/80 text-sm text-right">
              {restaurant.name_english}
            </p>
          )}
        </div>
      </div>

      {/* Content Section */}
      <CardHeader className="pb-3 pt-4">
        {/* Meta Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-medium">
              {restaurant.cuisine_type}
            </Badge>
            {restaurant.location.city && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <MapPin className="size-3" />
                {restaurant.location.city}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <PriceIndicator priceRange={restaurant.price_range} />
            {renderRating()}
          </div>
        </div>

        {/* Sentiment Badge */}
        <div className="flex items-center justify-between mt-3">
          <Badge className={cn("gap-1.5", sentiment.className)}>
            <span>{sentiment.icon}</span>
            <span>{sentiment.label}</span>
          </Badge>

          <button
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={isExpanded ? "הסתר פרטים" : "הצג פרטים"}
          >
            {isExpanded ? (
              <ChevronUp className="size-5" />
            ) : (
              <ChevronDown className="size-5" />
            )}
          </button>
        </div>

        {/* Host Comment Preview */}
        {restaurant.host_comments && !isExpanded && (
          <p className="text-muted-foreground text-sm italic text-right mt-2 line-clamp-2">
            "{restaurant.host_comments}"
          </p>
        )}
      </CardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="space-y-4 animate-slide-down">
          {/* Full Host Comment */}
          {restaurant.host_comments && (
            <blockquote className="border-r-4 border-primary pr-4 py-2 bg-muted/30 rounded-lg">
              <p className="text-sm italic text-right">"{restaurant.host_comments}"</p>
            </blockquote>
          )}

          {/* Location Details */}
          {restaurant.location.address && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="text-right">
                <p className="font-medium">{restaurant.location.address}</p>
                {restaurant.location.neighborhood && (
                  <p className="text-muted-foreground">{restaurant.location.neighborhood}</p>
                )}
              </div>
            </div>
          )}

          {/* Menu Items */}
          {restaurant.menu_items.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <Star className="size-4 text-primary" />
                תפריט מומלץ
              </h4>
              <div className="grid gap-2">
                {restaurant.menu_items.slice(0, 4).map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start gap-2 text-sm bg-muted/20 rounded-lg p-2"
                  >
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-medium">{item.item_name}</span>
                        {item.recommendation_level === 'highly_recommended' && (
                          <span className="text-amber-500">⭐</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-muted-foreground text-xs mt-0.5">{item.description}</p>
                      )}
                    </div>
                    {item.price && (
                      <span className="text-muted-foreground font-medium shrink-0">
                        {item.price}
                      </span>
                    )}
                  </div>
                ))}
                {restaurant.menu_items.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{restaurant.menu_items.length - 4} פריטים נוספים
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Special Features */}
          {restaurant.special_features.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">תכונות מיוחדות</h4>
              <div className="flex flex-wrap gap-1.5">
                {restaurant.special_features.map((feature, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {restaurant.contact_info.hours && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-4" />
                <span>{restaurant.contact_info.hours}</span>
              </div>
            )}
            {restaurant.contact_info.phone && (
              <a
                href={`tel:${restaurant.contact_info.phone}`}
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="size-4" />
                <span>{restaurant.contact_info.phone}</span>
              </a>
            )}
            {restaurant.contact_info.website && (
              <a
                href={restaurant.contact_info.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Globe className="size-4" />
                <span>אתר</span>
              </a>
            )}
          </div>

          {/* Business News */}
          {restaurant.business_news && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1 text-sm">
                חדשות עסקיות
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 text-right">
                {restaurant.business_news}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {restaurant.episode_info?.video_url && (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(restaurant.episode_info?.video_url, '_blank')
                }}
              >
                <Play className="size-4" />
                צפה בפרק
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation()
                const query = encodeURIComponent(
                  `${restaurant.name_hebrew} ${restaurant.location.city || ''} restaurant`
                )
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
              }}
            >
              <MapPin className="size-4" />
              פתח במפות
            </Button>
            {restaurant.google_places?.google_url && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(restaurant.google_places?.google_url, '_blank')
                }}
              >
                <ExternalLink className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
```

### 4.2 Skeleton Loading Component

Create `web/src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("skeleton-shimmer rounded-md", className)} />
  )
}

export function RestaurantCardSkeleton() {
  return (
    <div className="w-full rounded-xl border border-border overflow-hidden">
      {/* Image skeleton */}
      <Skeleton className="h-40 w-full rounded-none" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="flex justify-between">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>

        {/* Badges */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>

        {/* Sentiment */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Comment */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

export function SearchSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>
    </div>
  )
}
```

---

## 5. Phase 3: New Components

### 5.1 Filter Chips Component

Create `web/src/components/filter-chips.tsx`:

```tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

interface FilterOption {
  id: string
  label: string
  icon?: React.ReactNode
  count?: number
}

interface FilterChipsProps {
  options: FilterOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  multiSelect?: boolean
  className?: string
}

export function FilterChips({
  options,
  selected,
  onChange,
  multiSelect = true,
  className
}: FilterChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10)
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [options])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 200
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    })
  }

  const toggleOption = (optionId: string) => {
    if (multiSelect) {
      if (selected.includes(optionId)) {
        onChange(selected.filter(id => id !== optionId))
      } else {
        onChange([...selected, optionId])
      }
    } else {
      onChange(selected.includes(optionId) ? [] : [optionId])
    }
  }

  const clearAll = () => onChange([])

  return (
    <div className={cn("relative", className)}>
      {/* Scroll Arrows */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                     bg-gradient-to-l from-transparent via-background to-background
                     pl-4 pr-2 py-2"
          aria-label="גלול ימינה"
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                     bg-gradient-to-r from-transparent via-background to-background
                     pr-4 pl-2 py-2"
          aria-label="גלול שמאלה"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      {/* Chips Container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scroll-container py-1 px-1"
        onScroll={checkScroll}
      >
        {/* Clear All Button */}
        {selected.length > 0 && (
          <button
            onClick={clearAll}
            className="filter-chip bg-destructive/10 text-destructive hover:bg-destructive/20 shrink-0"
          >
            <X className="size-3" />
            נקה הכל ({selected.length})
          </button>
        )}

        {/* Filter Options */}
        {options.map((option) => {
          const isSelected = selected.includes(option.id)
          return (
            <button
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={cn(
                "filter-chip shrink-0",
                isSelected && "filter-chip-active"
              )}
              aria-pressed={isSelected}
            >
              {option.icon}
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  isSelected ? "bg-white/20" : "bg-muted"
                )}>
                  {option.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

### 5.2 Sentiment Badge Component

Create `web/src/components/sentiment-badge.tsx`:

```tsx
import { cn } from "@/lib/utils"
import { ThumbsUp, ThumbsDown, HelpCircle, Minus } from "lucide-react"

type Sentiment = 'positive' | 'negative' | 'mixed' | 'neutral'

interface SentimentBadgeProps {
  sentiment: Sentiment
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SENTIMENT_MAP = {
  positive: {
    icon: ThumbsUp,
    emoji: '👍',
    label: 'מומלץ',
    className: 'sentiment-positive',
    color: 'text-green-600 dark:text-green-400'
  },
  negative: {
    icon: ThumbsDown,
    emoji: '👎',
    label: 'לא מומלץ',
    className: 'sentiment-negative',
    color: 'text-red-600 dark:text-red-400'
  },
  mixed: {
    icon: HelpCircle,
    emoji: '🤔',
    label: 'מעורב',
    className: 'sentiment-mixed',
    color: 'text-amber-600 dark:text-amber-400'
  },
  neutral: {
    icon: Minus,
    emoji: '😐',
    label: 'ניטרלי',
    className: 'sentiment-neutral',
    color: 'text-gray-600 dark:text-gray-400'
  }
}

const SIZE_MAP = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2'
}

const ICON_SIZE_MAP = {
  sm: 'size-3',
  md: 'size-4',
  lg: 'size-5'
}

export function SentimentBadge({
  sentiment,
  showLabel = true,
  size = 'md',
  className
}: SentimentBadgeProps) {
  const config = SENTIMENT_MAP[sentiment]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        config.className,
        SIZE_MAP[size],
        className
      )}
    >
      <span>{config.emoji}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

// For use in analytics/charts
export function SentimentIcon({
  sentiment,
  size = 'md'
}: {
  sentiment: Sentiment
  size?: 'sm' | 'md' | 'lg'
}) {
  const config = SENTIMENT_MAP[sentiment]
  const Icon = config.icon

  return (
    <Icon className={cn(ICON_SIZE_MAP[size], config.color)} />
  )
}
```

### 5.3 Stats Card Component

Create `web/src/components/stats-card.tsx`:

```tsx
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className
}: StatsCardProps) {
  return (
    <div className={cn("stat-card", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{title}</p>
          <p className="stat-value">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="size-5 text-primary" />
          </div>
        )}
      </div>

      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium mt-2",
          trend.isPositive ? "text-green-600" : "text-red-600"
        )}>
          <span>{trend.isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
          <span className="text-muted-foreground">מהשבוע שעבר</span>
        </div>
      )}
    </div>
  )
}
```

### 5.4 Image with Fallback Component

Create `web/src/components/image-with-fallback.tsx`:

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Utensils, ImageOff } from "lucide-react"

interface ImageWithFallbackProps {
  src?: string | null
  alt: string
  className?: string
  fallbackIcon?: React.ReactNode
  cuisineType?: string
}

// Gradient backgrounds based on cuisine
const CUISINE_GRADIENTS: Record<string, string> = {
  'אסייאתי': 'from-red-500/20 to-orange-500/10',
  'איטלקי': 'from-green-500/20 to-red-500/10',
  'ים תיכוני': 'from-blue-500/20 to-cyan-500/10',
  'מקסיקני': 'from-yellow-500/20 to-red-500/10',
  'יפני': 'from-pink-500/20 to-red-500/10',
  'הודי': 'from-orange-500/20 to-yellow-500/10',
  'ישראלי': 'from-blue-500/20 to-white/10',
  'default': 'from-primary/20 to-primary/5'
}

export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackIcon,
  cuisineType
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const gradient = cuisineType
    ? (CUISINE_GRADIENTS[cuisineType] || CUISINE_GRADIENTS.default)
    : CUISINE_GRADIENTS.default

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br",
          gradient,
          className
        )}
      >
        {fallbackIcon || (
          <Utensils className="size-12 text-muted-foreground/50" />
        )}
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <div className={cn(
          "absolute inset-0 skeleton-shimmer",
          "bg-gradient-to-br",
          gradient
        )} />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={cn(
          "object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}
```

---

## 6. Phase 4: Animations & Polish

### 6.1 Page Transitions

Add to layout or page components:

```tsx
// In components that need transitions
import { motion, AnimatePresence } from 'framer-motion'

// Note: Install framer-motion if using advanced animations
// npm install framer-motion

// Simple CSS-based alternative (already in globals.css)
<div className="animate-fade-in">
  {/* Content */}
</div>
```

### 6.2 Loading States Pattern

```tsx
// Usage pattern for data fetching
function RestaurantList() {
  const { data, isLoading, error } = useRestaurants()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error.message} />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data?.map((restaurant) => (
        <RestaurantCard key={restaurant.name_hebrew} restaurant={restaurant} />
      ))}
    </div>
  )
}
```

---

## 7. Testing Checklist

### Visual Testing
- [ ] Cards render correctly with all data states
- [ ] Empty states display properly
- [ ] Loading skeletons match final layout
- [ ] Dark mode colors are readable
- [ ] RTL layout is correct for all components
- [ ] Responsive breakpoints work (320px, 768px, 1024px, 1440px)

### Interaction Testing
- [ ] Favorite toggle animates correctly
- [ ] Card expansion is smooth
- [ ] Filter chips scroll horizontally on mobile
- [ ] Touch targets are minimum 44px
- [ ] Hover states work on desktop

### Accessibility Testing
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader announces card content properly
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] ARIA labels are present and accurate

### Performance Testing
- [ ] Lighthouse score > 90
- [ ] Images lazy load correctly
- [ ] No layout shift on load
- [ ] Animations run at 60fps

---

## 8. Accessibility Requirements

### ARIA Labels
```tsx
// All interactive elements need labels
<button aria-label="הוסף למועדפים">
<button aria-label="הצג פרטים נוספים">
<input aria-label="חיפוש מסעדות">
```

### Focus Management
```tsx
// Focus trap for modals
// Visible focus indicators
// Skip links for navigation
```

### Screen Reader Support
```tsx
// Announce dynamic content
<div role="status" aria-live="polite">
  {`נמצאו ${count} מסעדות`}
</div>
```

---

## Quick Start Commands

```bash
# 1. Install any missing dependencies
cd web && npm install

# 2. Start development server
npm run dev

# 3. Open in browser
# http://localhost:3000

# 4. Test responsive design
# Use Chrome DevTools device toolbar

# 5. Check accessibility
# Use axe DevTools browser extension
```

---

## Component File Summary

| Component | File Path | Priority |
|-----------|-----------|----------|
| RestaurantCard | `components/restaurant-card.tsx` | High |
| Skeleton | `components/ui/skeleton.tsx` | High |
| FilterChips | `components/filter-chips.tsx` | High |
| SentimentBadge | `components/sentiment-badge.tsx` | Medium |
| StatsCard | `components/stats-card.tsx` | Medium |
| ImageWithFallback | `components/image-with-fallback.tsx` | Medium |

---

## Questions?

Refer to:
- `WEBSITE_DESIGN_PLAN.md` for design rationale
- Tailwind CSS docs: https://tailwindcss.com
- Radix UI docs: https://radix-ui.com
- Lucide Icons: https://lucide.dev
