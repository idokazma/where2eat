"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Heart, Phone, ChevronRight, Navigation } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useFavorites } from "@/contexts/favorites-context"
import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"

interface MobileRestaurantCardProps {
  restaurant: Restaurant
  onTap?: (restaurant: Restaurant) => void
}

function getOpinionIcon(opinion: Restaurant['host_opinion']) {
  switch (opinion) {
    case 'positive':
      return '👍'
    case 'negative':
      return '👎'
    case 'mixed':
      return '🤔'
    case 'neutral':
      return '😐'
    default:
      return '😐'
  }
}

function getPriceRangeDisplay(priceRange: Restaurant['price_range']) {
  switch (priceRange) {
    case 'budget':
      return '₪'
    case 'mid-range':
      return '₪₪'
    case 'expensive':
      return '₪₪₪'
    case 'not_mentioned':
      return '-'
    default:
      return '-'
  }
}

function getOpinionAccentClass(opinion: Restaurant['host_opinion']) {
  switch (opinion) {
    case 'positive':
      return 'accent-bar-positive'
    case 'negative':
      return 'accent-bar-negative'
    case 'mixed':
      return 'accent-bar-mixed'
    case 'neutral':
      return 'accent-bar-neutral'
    default:
      return 'accent-bar-neutral'
  }
}

function openGoogleMaps(restaurant: Restaurant) {
  const query = encodeURIComponent(`${restaurant.name_hebrew} ${restaurant.location.city || ''} restaurant`)
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
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

  const handleDirections = (e: React.MouseEvent) => {
    e.stopPropagation()
    openGoogleMaps(restaurant)
  }

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (restaurant.contact_info.phone) {
      window.location.href = `tel:${restaurant.contact_info.phone}`
    }
  }

  return (
    <Card
      className="card-interactive overflow-hidden border-0 shadow-md active:shadow-lg"
      onClick={handleCardTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardTap()
        }
      }}
      aria-label={`${restaurant.name_hebrew}, ${restaurant.cuisine_type}`}
    >
      {/* Accent Bar */}
      <div className={`h-1.5 ${getOpinionAccentClass(restaurant.host_opinion)}`} aria-hidden="true" />

      <CardContent className="p-4 space-y-3">
        {/* Header Row - Name, Opinion, Favorite */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-bold text-right leading-tight tracking-tight line-clamp-1">
              {restaurant.name_hebrew}
            </h3>
            <p className="text-caption mt-0.5">{restaurant.cuisine_type}</p>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Opinion Badge */}
            <div
              className="size-9 flex items-center justify-center bg-muted/50 rounded-full"
              aria-label={`Opinion: ${restaurant.host_opinion}`}
            >
              <span className="text-lg">{getOpinionIcon(restaurant.host_opinion)}</span>
            </div>

            {/* Favorite Button - Large Touch Target */}
            <button
              onClick={handleFavoriteToggle}
              className="size-11 flex items-center justify-center rounded-full hover:bg-muted transition-all active:scale-95"
              aria-label={isRestaurantFavorite ? t('mobile.removeFavorite') : t('mobile.addFavorite')}
              aria-pressed={isRestaurantFavorite}
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
            onClick={handleDirections}
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-primary text-primary-foreground rounded-xl text-sm font-medium active:scale-95 transition-transform"
            aria-label={t('mobile.directions')}
          >
            <Navigation className="size-4" />
            {t('mobile.directions')}
          </button>

          {restaurant.contact_info.phone && (
            <button
              onClick={handleCall}
              className="flex items-center justify-center h-12 w-12 bg-secondary text-secondary-foreground rounded-xl active:scale-95 transition-transform"
              aria-label={t('mobile.call')}
            >
              <Phone className="size-5" />
            </button>
          )}

          {/* Expand/Detail Indicator */}
          {onTap && (
            <div className="flex items-center justify-center h-12 w-12 bg-muted/50 rounded-xl">
              <ChevronRight className="size-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
