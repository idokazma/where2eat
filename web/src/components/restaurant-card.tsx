"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MapPin, Clock, Phone, Globe, Star, Heart, ChevronDown, ChevronUp } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useFavorites } from "@/contexts/favorites-context"
import { useLanguage } from "@/contexts/LanguageContext"
import { useState } from "react"

interface RestaurantCardProps {
  restaurant: Restaurant
}

function getStatusBadgeVariant(status: Restaurant['status']) {
  switch (status) {
    case 'open':
      return 'default'
    case 'new_opening':
      return 'secondary'
    case 'closing_soon':
      return 'destructive'
    case 'reopening':
      return 'outline'
    case 'closed':
      return 'destructive'
    default:
      return 'default'
  }
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

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const { t } = useLanguage()
  const restaurantId = restaurant.name_hebrew
  const isRestaurantFavorite = isFavorite(restaurantId)
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRestaurantFavorite) {
      removeFavorite(restaurantId)
    } else {
      addFavorite(restaurantId)
    }
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <Card className="w-full card-interactive overflow-hidden border-0 shadow-md" onClick={toggleExpanded}>
      {/* Accent bar based on host opinion */}
      <div className={`h-1.5 ${getOpinionAccentClass(restaurant.host_opinion)}`} aria-hidden="true" />

      <CardHeader className="pb-3 pt-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Restaurant name with display font */}
            <h3 className="font-display text-xl font-bold text-right leading-tight tracking-tight">
              {restaurant.name_hebrew}
            </h3>
            {/* Cuisine as subtle label */}
            <span className="text-caption block mt-1">{restaurant.cuisine_type}</span>
            {restaurant.host_comments && (
              <p className="text-muted-foreground text-sm italic text-right mt-2 line-clamp-2 leading-relaxed">
                &ldquo;{restaurant.host_comments}&rdquo;
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            {/* Price as large decorative element */}
            <span className="font-display text-3xl font-light text-primary/30 leading-none">
              {getPriceRangeDisplay(restaurant.price_range)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFavorite}
                className="p-2 rounded-full hover:bg-muted transition-all hover:scale-110"
                aria-label={isRestaurantFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`size-5 transition-all ${
                  isRestaurantFavorite
                    ? 'fill-red-500 text-red-500 scale-110'
                    : 'text-muted-foreground hover:text-red-500'
                }`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {restaurant.location.city && (
            <Badge variant="secondary" className="flex items-center gap-1.5 text-xs rounded-full px-3">
              <MapPin className="size-3" />
              {restaurant.location.city}
            </Badge>
          )}
          <div className="flex items-center gap-1.5 mr-auto bg-muted/50 px-2.5 py-1 rounded-full">
            <span className="text-base">{getOpinionIcon(restaurant.host_opinion)}</span>
          </div>
          {/* Expand indicator */}
          <button
            className="p-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-5 pt-0 animate-reveal-up" style={{ animationDuration: '0.3s' }}>
          {/* Address Section */}
          {restaurant.location.address && (
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="size-4 text-primary" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{restaurant.location.address}</p>
                {restaurant.location.neighborhood && (
                  <p className="text-muted-foreground text-xs mt-0.5">{restaurant.location.neighborhood}</p>
                )}
              </div>
            </div>
          )}

          {/* Menu Items Section */}
          {restaurant.menu_items.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Star className="size-4 text-amber-500" />
                {t('restaurant.recommendedMenu')}
              </h4>
              <div className="space-y-2">
                {restaurant.menu_items.slice(0, 3).map((item, index) => (
                  <div key={index} className="flex justify-between items-start gap-3 text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex-1 text-right">
                      <p className="font-medium">{item.item_name}</p>
                      {item.description && (
                        <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.price && <span className="text-muted-foreground text-xs">{item.price}</span>}
                      {item.recommendation_level === 'highly_recommended' && <span className="text-lg">⭐</span>}
                      {item.recommendation_level === 'recommended' && <span className="text-lg">👌</span>}
                    </div>
                  </div>
                ))}
                {restaurant.menu_items.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    {t('restaurant.moreItems').replace('{count}', String(restaurant.menu_items.length - 3))}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Special Features */}
          {restaurant.special_features.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">{t('restaurant.specialFeatures')}</h4>
              <div className="flex flex-wrap gap-1.5">
                {restaurant.special_features.map((feature, index) => (
                  <Badge key={index} variant="secondary" className="text-xs rounded-full px-3">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-4" />

          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {restaurant.contact_info.hours && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>{restaurant.contact_info.hours}</span>
              </div>
            )}
            {restaurant.contact_info.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                <span>{restaurant.contact_info.phone}</span>
              </div>
            )}
            {restaurant.contact_info.website && (
              <div className="flex items-center gap-1.5">
                <Globe className="size-3.5" />
                <a href={restaurant.contact_info.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  {t('common.website')}
                </a>
              </div>
            )}
          </div>

          {/* Business News */}
          {restaurant.business_news && (
            <div className="bg-info/10 rounded-xl p-4 border border-info/20">
              <h4 className="font-semibold text-info mb-1.5 text-sm">{t('restaurant.businessNews')}</h4>
              <p className="text-sm text-info/80 text-right leading-relaxed">{restaurant.business_news}</p>
            </div>
          )}

          {/* Action Buttons - Refined Design */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const mapTab = document.querySelector('[value="map"]') as HTMLElement;
                mapTab?.click();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-md active:scale-[0.98]"
            >
              <MapPin className="size-4" />
              {t('common.map')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const query = encodeURIComponent(`${restaurant.name_hebrew} ${restaurant.location.city} restaurant`)
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all hover:shadow-md active:scale-[0.98]"
            >
              <Globe className="size-4" />
              {t('restaurant.googleMaps')}
            </button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}