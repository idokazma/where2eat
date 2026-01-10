"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Heart, Star, Phone, Globe, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useFavorites } from "@/contexts/favorites-context"
import { useLanguage } from "@/contexts/LanguageContext"
import { OptimizedImage } from "./optimized-image"
import { Separator } from "@/components/ui/separator"

interface VisualRestaurantCardProps {
  restaurant: Restaurant
  aspectRatio?: "square" | "portrait" | "landscape" | "wide"
}

function getOpinionColor(opinion: Restaurant['host_opinion']) {
  switch (opinion) {
    case 'positive':
      return 'bg-green-500'
    case 'negative':
      return 'bg-red-500'
    case 'mixed':
      return 'bg-yellow-500'
    case 'neutral':
      return 'bg-gray-500'
    default:
      return 'bg-gray-500'
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

export function VisualRestaurantCard({
  restaurant,
  aspectRatio = "landscape"
}: VisualRestaurantCardProps) {
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

  // Get restaurant image - fallback to placeholder for now
  const restaurantImage = restaurant.contact_info?.website
    ? `/api/placeholder/restaurant/${encodeURIComponent(restaurant.name_hebrew)}`
    : "/placeholder-restaurant.jpg"

  return (
    <Card
      className="overflow-hidden visual-card-hover cursor-pointer border-0 shadow-md"
      onClick={toggleExpanded}
    >
      {/* Image Section - 70% of card space */}
      <div className="relative">
        <OptimizedImage
          src={restaurantImage}
          alt={restaurant.name_hebrew}
          aspectRatio={aspectRatio}
          className="w-full"
        />

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 image-overlay-dark" />

        {/* Floating badges on image */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            onClick={toggleFavorite}
            className="p-2 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white transition-colors shadow-lg"
          >
            <Heart className={`size-5 transition-all ${
              isRestaurantFavorite
                ? 'fill-red-500 text-red-500'
                : 'text-gray-700 hover:text-red-500'
            }`} />
          </button>
        </div>

        {/* Opinion indicator */}
        <div className="absolute top-3 left-3">
          <div className={`${getOpinionColor(restaurant.host_opinion)} text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg flex items-center gap-1`}>
            <span>{getOpinionIcon(restaurant.host_opinion)}</span>
            <span className="capitalize">{restaurant.host_opinion}</span>
          </div>
        </div>

        {/* Text overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="card-title-large mb-2 text-white drop-shadow-lg">
            {restaurant.name_hebrew}
          </h3>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary" className="bg-white/20 backdrop-blur-sm text-white border-white/30">
              {restaurant.cuisine_type}
            </Badge>
            {restaurant.location.city && (
              <Badge variant="secondary" className="bg-white/20 backdrop-blur-sm text-white border-white/30 flex items-center gap-1">
                <MapPin className="size-3" />
                {restaurant.location.city}
              </Badge>
            )}
            <div className="text-white font-semibold ml-auto">
              {getPriceRangeDisplay(restaurant.price_range)}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - 30% of card space */}
      <CardContent className="p-4">
        {restaurant.host_comments && (
          <p className="text-sm text-muted-foreground italic text-right line-clamp-2 mb-2">
            "{restaurant.host_comments}"
          </p>
        )}

        {/* Expand/Collapse indicator */}
        <div className="flex items-center justify-center text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {restaurant.location.address && (
              <div className="flex items-start gap-2">
                <MapPin className="size-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <p>{restaurant.location.address}</p>
                  {restaurant.location.neighborhood && (
                    <p className="text-muted-foreground">{restaurant.location.neighborhood}</p>
                  )}
                </div>
              </div>
            )}

            {restaurant.menu_items.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Star className="size-4" />
                  {t('restaurant.recommendedMenu')}
                </h4>
                <div className="space-y-2">
                  {restaurant.menu_items.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex justify-between items-start gap-2 text-sm">
                      <div className="flex-1 text-right">
                        <p className="font-medium">{item.item_name}</p>
                        {item.description && (
                          <p className="text-muted-foreground text-xs">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.price && <span className="text-muted-foreground">{item.price}</span>}
                        {item.recommendation_level === 'highly_recommended' && <span>⭐</span>}
                        {item.recommendation_level === 'recommended' && <span>👌</span>}
                      </div>
                    </div>
                  ))}
                  {restaurant.menu_items.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      {t('restaurant.moreItems').replace('{count}', String(restaurant.menu_items.length - 3))}
                    </p>
                  )}
                </div>
              </div>
            )}

            {restaurant.special_features.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">{t('restaurant.specialFeatures')}</h4>
                <div className="flex flex-wrap gap-1">
                  {restaurant.special_features.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {restaurant.contact_info.hours && (
                <div className="flex items-center gap-1">
                  <Clock className="size-3" />
                  <span>{restaurant.contact_info.hours}</span>
                </div>
              )}
              {restaurant.contact_info.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="size-3" />
                  <span>{restaurant.contact_info.phone}</span>
                </div>
              )}
              {restaurant.contact_info.website && (
                <div className="flex items-center gap-1">
                  <Globe className="size-3" />
                  <a href={restaurant.contact_info.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {t('common.website')}
                  </a>
                </div>
              )}
            </div>

            {restaurant.business_news && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{t('restaurant.businessNews')}</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 text-right">{restaurant.business_news}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const mapTab = document.querySelector('[value="map"]') as HTMLElement;
                  mapTab?.click();
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
              >
                <MapPin className="size-3" />
                {t('common.map')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const query = encodeURIComponent(`${restaurant.name_hebrew} ${restaurant.location.city} restaurant`)
                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/90 transition-colors"
              >
                <Globe className="size-3" />
                Google
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
