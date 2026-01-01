"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MapPin, Clock, Phone, Globe, Star } from "lucide-react"
import { Restaurant } from "@/types/restaurant"

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

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-right">{restaurant.name_hebrew}</h3>
            {restaurant.name_english && (
              <p className="text-muted-foreground text-sm">{restaurant.name_english}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Badge variant={getStatusBadgeVariant(restaurant.status)}>
              {restaurant.status.replace('_', ' ')}
            </Badge>
            <div className="flex items-center gap-1">
              <span>{getOpinionIcon(restaurant.host_opinion)}</span>
              <span className="text-sm">{getPriceRangeDisplay(restaurant.price_range)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline">{restaurant.cuisine_type}</Badge>
          {restaurant.location.city && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="size-3" />
              {restaurant.location.city}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {restaurant.host_comments && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm italic text-right">{restaurant.host_comments}</p>
          </div>
        )}

        {restaurant.location.address && (
          <div className="flex items-start gap-2">
            <MapPin className="size-4 mt-0.5 text-muted-foreground" />
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
              תפריט מומלץ
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
                  +{restaurant.menu_items.length - 3} פריטים נוספים
                </p>
              )}
            </div>
          </div>
        )}

        {restaurant.special_features.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">תכונות מיוחדות</h4>
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
                אתר
              </a>
            </div>
          )}
        </div>

        {restaurant.business_news && (
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">חדשות עסקיות</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 text-right">{restaurant.business_news}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}