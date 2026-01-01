"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MapPin, Clock, Phone, Globe, Star, Heart, ChefHat, Utensils, Award } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useFavorites } from "@/contexts/favorites-context"

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
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()
  const restaurantId = restaurant.name_hebrew
  const isRestaurantFavorite = isFavorite(restaurantId)

  const toggleFavorite = () => {
    if (isRestaurantFavorite) {
      removeFavorite(restaurantId)
    } else {
      addFavorite(restaurantId)
    }
  }

  return (
    <Card className="w-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-white overflow-hidden group">
      {/* Header with gradient background */}
      <div className="relative bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative">
          <div className="flex justify-between items-start gap-4 restaurant-card-header">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <ChefHat className="size-5 sm:size-6 text-orange-200" />
                <h3 className="text-xl sm:text-2xl font-bold text-right">{restaurant.name_hebrew}</h3>
              </div>
              {restaurant.name_english && (
                <p className="text-orange-100 text-base font-medium">{restaurant.name_english}</p>
              )}
            </div>
            <div className="flex flex-col gap-3 items-end">
              <button 
                onClick={toggleFavorite}
                className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors group"
              >
                <Heart className={`size-5 transition-all ${
                  isRestaurantFavorite 
                    ? 'fill-red-400 text-red-400 scale-110' 
                    : 'text-white group-hover:text-red-300'
                }`} />
              </button>
              <Badge 
                variant={getStatusBadgeVariant(restaurant.status)}
                className="bg-white/20 text-white border-white/30 font-medium"
              >
                {restaurant.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <Utensils className="size-3 ml-1" />
                {restaurant.cuisine_type}
              </Badge>
              {restaurant.location.city && (
                <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                  <MapPin className="size-3 ml-1" />
                  {restaurant.location.city}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-2xl">{getOpinionIcon(restaurant.host_opinion)}</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {getPriceRangeDisplay(restaurant.price_range)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Host Comments Section */}
        {restaurant.host_comments && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border-l-4 border-orange-500">
            <div className="flex items-start gap-3">
              <Award className="size-5 text-orange-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-orange-800 mb-1">דעת המומחה</h4>
                <p className="text-base italic text-right leading-relaxed text-gray-700">
                  "{restaurant.host_comments}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Location Section */}
        {restaurant.location.address && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-start gap-3">
              <MapPin className="size-5 text-orange-600 mt-1 flex-shrink-0" />
              <div className="text-base">
                <h4 className="font-semibold text-gray-800 mb-1">מיקום</h4>
                <p className="text-gray-700">{restaurant.location.address}</p>
                {restaurant.location.neighborhood && (
                  <p className="text-gray-500 text-sm mt-1">{restaurant.location.neighborhood}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Menu Items Section */}
        {restaurant.menu_items.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-4">
              <Star className="size-5 text-amber-600" />
              <h4 className="font-semibold text-amber-800 text-lg">תפריט מומלץ</h4>
            </div>
            <div className="space-y-3">
              {restaurant.menu_items.slice(0, 3).map((item, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 text-right">
                      <p className="font-semibold text-gray-800 text-base">{item.item_name}</p>
                      {item.description && (
                        <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.price && (
                        <span className="font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-md text-sm">
                          {item.price}
                        </span>
                      )}
                      {item.recommendation_level === 'highly_recommended' && (
                        <span className="text-lg" title="מומלץ מאוד">⭐</span>
                      )}
                      {item.recommendation_level === 'recommended' && (
                        <span className="text-lg" title="מומלץ">👌</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {restaurant.menu_items.length > 3 && (
                <div className="text-center pt-2">
                  <p className="text-sm text-amber-700 font-medium">
                    +{restaurant.menu_items.length - 3} פריטים נוספים בתפריט
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Special Features Section */}
        {restaurant.special_features.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Award className="size-5 text-blue-600" />
              <h4 className="font-semibold text-blue-800 text-lg">תכונות מיוחדות</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {restaurant.special_features.map((feature, index) => (
                <Badge 
                  key={index} 
                  className="bg-white text-blue-700 border-blue-300 hover:bg-blue-100 transition-colors text-sm py-1 px-3"
                >
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-6" />

        {/* Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 contact-grid">
          {restaurant.contact_info.hours && (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Clock className="size-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-green-600 font-medium">שעות פתיחה</p>
                <p className="text-sm font-semibold text-green-800">{restaurant.contact_info.hours}</p>
              </div>
            </div>
          )}
          {restaurant.contact_info.phone && (
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <Phone className="size-5 text-purple-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-purple-600 font-medium">טלפון</p>
                <p className="text-sm font-semibold text-purple-800 direction-ltr">{restaurant.contact_info.phone}</p>
              </div>
            </div>
          )}
          {restaurant.contact_info.website && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <Globe className="size-5 text-indigo-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-indigo-600 font-medium">אתר אינטרנט</p>
                <a 
                  href={restaurant.contact_info.website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-semibold text-indigo-800 hover:text-indigo-600 transition-colors"
                >
                  בקר באתר
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Business News */}
        {restaurant.business_news && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <TrendingUp className="size-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-800 text-lg mb-2">חדשות עסקיות</h4>
                <p className="text-base text-blue-700 text-right leading-relaxed">{restaurant.business_news}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={() => {
              // Switch to map tab and center on this restaurant
              const mapTab = document.querySelector('[value="map"]') as HTMLElement;
              mapTab?.click();
              // Note: The map centering logic would be handled by the parent component
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all"
          >
            <MapPin className="size-4" />
            הצג על המפה
          </button>
          <button
            onClick={() => {
              const query = encodeURIComponent(`${restaurant.name_hebrew} ${restaurant.location.city} restaurant`)
              window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all"
          >
            <Globe className="size-4" />
            Google Maps
          </button>
        </div>
      </CardContent>
    </Card>
  )
}