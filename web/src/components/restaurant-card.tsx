"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  MapPin, Clock, Phone, Globe, Star, Heart,
  ChevronDown, ChevronUp, Play, ExternalLink,
  Utensils, Sparkles
} from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useFavorites } from "@/contexts/favorites-context"
import { cn } from "@/lib/utils"
import { SentimentBadge } from "./sentiment-badge"
import { ImageWithFallback } from "./image-with-fallback"

interface RestaurantCardProps {
  restaurant: Restaurant
  variant?: 'default' | 'compact' | 'featured'
}

// Status badge configuration
const STATUS_CONFIG = {
  open: { label: 'פתוח', variant: 'default' as const, className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' },
  closed: { label: 'סגור', variant: 'destructive' as const, className: '' },
  new_opening: { label: 'חדש!', variant: 'default' as const, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  closing_soon: { label: 'נסגר בקרוב', variant: 'destructive' as const, className: '' },
  reopening: { label: 'נפתח מחדש', variant: 'outline' as const, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' }
}

// Price indicator component
function PriceIndicator({ priceRange }: { priceRange: Restaurant['price_range'] }) {
  const levels = ['budget', 'mid-range', 'expensive']
  const activeIndex = levels.indexOf(priceRange)

  if (priceRange === 'not_mentioned') {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  return (
    <div className="price-indicator" title={`רמת מחיר: ${priceRange}`}>
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

// Google rating display
function RatingDisplay({ rating }: { rating?: Restaurant['rating'] }) {
  if (!rating?.google_rating) return null

  return (
    <div className="flex items-center gap-1" title="דירוג Google">
      <Star className="size-4 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-sm">{rating.google_rating.toFixed(1)}</span>
      {rating.total_reviews && (
        <span className="text-muted-foreground text-xs">
          ({rating.total_reviews.toLocaleString()})
        </span>
      )}
    </div>
  )
}

export function RestaurantCard({ restaurant, variant = 'default' }: RestaurantCardProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const restaurantId = restaurant.name_hebrew
  const isRestaurantFavorite = isFavorite(restaurantId)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHeartAnimating, setIsHeartAnimating] = useState(false)

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

  const isNewOrSpecial = restaurant.status === 'new_opening' || restaurant.status === 'reopening'

  return (
    <Card
      className={cn(
        "w-full card-interactive cursor-pointer overflow-hidden",
        variant === 'featured' && "ring-2 ring-primary/20",
        restaurant.status === 'closed' && "opacity-75"
      )}
      onClick={toggleExpanded}
    >
      {/* Hero Image Section */}
      <div className="relative h-40 image-container">
        <ImageWithFallback
          src={null} // Will use fallback - add actual image URL when available
          alt={restaurant.name_hebrew}
          cuisineType={restaurant.cuisine_type}
          className="w-full h-full"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Top Badges Row */}
        <div className="absolute top-3 right-3 left-3 flex justify-between items-start">
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={status.variant}
              className={cn("text-xs shadow-sm", status.className)}
            >
              {status.label}
            </Badge>
            {isNewOrSpecial && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs shadow-sm border-0">
                <Sparkles className="size-3 mr-1" />
                חדש
              </Badge>
            )}
          </div>

          {/* Favorite Button */}
          <button
            onClick={toggleFavorite}
            className={cn(
              "p-2 rounded-full shadow-lg transition-all duration-200",
              "bg-white/90 dark:bg-black/50 backdrop-blur-sm",
              "hover:scale-110 active:scale-95",
              isHeartAnimating && "animate-heart-pop"
            )}
            aria-label={isRestaurantFavorite ? "הסר ממועדפים" : "הוסף למועדפים"}
          >
            <Heart
              className={cn(
                "size-5 transition-colors duration-200",
                isRestaurantFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-gray-600 dark:text-gray-300 hover:text-red-400"
              )}
            />
          </button>
        </div>

        {/* Restaurant Name on Image */}
        <div className="absolute bottom-3 right-3 left-3">
          <h3 className="text-xl font-bold text-white drop-shadow-lg text-right leading-tight">
            {restaurant.name_hebrew}
          </h3>
          {restaurant.name_english && (
            <p className="text-white/80 text-sm text-right mt-0.5">
              {restaurant.name_english}
            </p>
          )}
        </div>
      </div>

      {/* Content Section */}
      <CardHeader className="pb-3 pt-4">
        {/* Meta Row: Cuisine, Location, Price, Rating */}
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
            <RatingDisplay rating={restaurant.rating} />
          </div>
        </div>

        {/* Sentiment + Expand Row */}
        <div className="flex items-center justify-between mt-3">
          <SentimentBadge sentiment={restaurant.host_opinion} size="md" />

          <button
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={isExpanded ? "הסתר פרטים" : "הצג פרטים"}
          >
            <span className="text-xs">{isExpanded ? 'פחות' : 'עוד'}</span>
            {isExpanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        </div>

        {/* Host Comment Preview (when collapsed) */}
        {restaurant.host_comments && !isExpanded && (
          <p className="text-muted-foreground text-sm italic text-right mt-2 line-clamp-2">
            &ldquo;{restaurant.host_comments}&rdquo;
          </p>
        )}
      </CardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="space-y-4 animate-slide-down pt-0">
          {/* Full Host Comment */}
          {restaurant.host_comments && (
            <blockquote className="quote-block">
              <p className="text-sm italic text-right">&ldquo;{restaurant.host_comments}&rdquo;</p>
            </blockquote>
          )}

          {/* Location Details */}
          {restaurant.location.address && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="size-4 mt-0.5 text-primary shrink-0" />
              <div className="text-right">
                <p className="font-medium">{restaurant.location.address}</p>
                {restaurant.location.neighborhood && (
                  <p className="text-muted-foreground text-xs">{restaurant.location.neighborhood}</p>
                )}
                {restaurant.location.region && (
                  <p className="text-muted-foreground text-xs">אזור: {restaurant.location.region}</p>
                )}
              </div>
            </div>
          )}

          {/* Menu Items */}
          {restaurant.menu_items.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <Utensils className="size-4 text-primary" />
                מנות מומלצות
              </h4>
              <div className="grid gap-2">
                {restaurant.menu_items.slice(0, 4).map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-start gap-2 text-sm bg-muted/30 rounded-lg p-2.5"
                  >
                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        <span className="font-medium truncate">{item.item_name}</span>
                        {item.recommendation_level === 'highly_recommended' && (
                          <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
                        )}
                      </div>
                      {item.description && (
                        <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {item.price && (
                      <span className="text-muted-foreground font-medium shrink-0 text-xs">
                        {item.price}
                      </span>
                    )}
                  </div>
                ))}
                {restaurant.menu_items.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{restaurant.menu_items.length - 4} מנות נוספות
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
          <div className="flex flex-wrap gap-4 text-sm">
            {restaurant.contact_info.hours && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-4" />
                <span>{restaurant.contact_info.hours}</span>
              </div>
            )}
            {restaurant.contact_info.phone && (
              <a
                href={`tel:${restaurant.contact_info.phone}`}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
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
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
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
                📰 חדשות עסקיות
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
              מפות Google
            </Button>
            {restaurant.google_places?.google_url && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(restaurant.google_places?.google_url, '_blank')
                }}
                title="פתח ב-Google"
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

// Compact variant for list views
export function RestaurantCardCompact({ restaurant }: { restaurant: Restaurant }) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const restaurantId = restaurant.name_hebrew
  const isRestaurantFavorite = isFavorite(restaurantId)

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRestaurantFavorite) {
      removeFavorite(restaurantId)
    } else {
      addFavorite(restaurantId)
    }
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
      {/* Image Thumbnail */}
      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
        <ImageWithFallback
          src={null}
          alt={restaurant.name_hebrew}
          cuisineType={restaurant.cuisine_type}
          className="w-full h-full"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{restaurant.name_hebrew}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{restaurant.cuisine_type}</span>
              {restaurant.location.city && (
                <>
                  <span>•</span>
                  <span>{restaurant.location.city}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={toggleFavorite} className="p-1 shrink-0">
            <Heart
              className={cn(
                "size-4",
                isRestaurantFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground"
              )}
            />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <SentimentBadge sentiment={restaurant.host_opinion} size="sm" showLabel={false} />
          <PriceIndicator priceRange={restaurant.price_range} />
          {restaurant.rating?.google_rating && (
            <span className="text-xs text-muted-foreground">
              ⭐ {restaurant.rating.google_rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
