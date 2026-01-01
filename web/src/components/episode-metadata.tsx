"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Youtube, Calendar, Clock, MapPin, Utensils, ExternalLink } from "lucide-react"
import { Restaurant } from "@/types/restaurant"

interface EpisodeMetadataProps {
  episode: {
    video_id: string
    video_url: string
    analysis_date: string
    language: string
    total_restaurants_found: number
    processing_method: string
  }
  restaurants: Restaurant[]
  onRestaurantFilter?: (restaurantName: string) => void
}

export function EpisodeMetadata({ episode, restaurants, onRestaurantFilter }: EpisodeMetadataProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const getVideoThumbnail = (videoId: string) => {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  }

  const extractVideoTitle = (videoUrl: string) => {
    // This would ideally come from the API, but we can extract from ID for now
    return `YouTube Video ${episode.video_id}`
  }

  const getLocationSummary = () => {
    const locationMap = new Map<string, number>()
    restaurants.forEach(restaurant => {
      const city = restaurant.location?.city
      if (city) {
        locationMap.set(city, (locationMap.get(city) || 0) + 1)
      }
    })
    
    return Array.from(locationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }

  const getCuisineSummary = () => {
    const cuisineMap = new Map<string, number>()
    restaurants.forEach(restaurant => {
      const cuisine = restaurant.cuisine_type
      if (cuisine) {
        cuisineMap.set(cuisine, (cuisineMap.get(cuisine) || 0) + 1)
      }
    })
    
    return Array.from(cuisineMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }

  const getOpinionStats = () => {
    const opinionMap = new Map<string, number>()
    restaurants.forEach(restaurant => {
      const opinion = restaurant.host_opinion
      if (opinion) {
        opinionMap.set(opinion, (opinionMap.get(opinion) || 0) + 1)
      }
    })
    return opinionMap
  }

  const locationSummary = getLocationSummary()
  const cuisineSummary = getCuisineSummary()
  const opinionStats = getOpinionStats()

  return (
    <Card className="overflow-hidden border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50">
      <CardHeader className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
        <div className="flex items-start gap-4">
          <img
            src={getVideoThumbnail(episode.video_id)}
            alt="Video thumbnail"
            className="w-24 h-18 rounded-lg shadow-md object-cover"
          />
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-xl mb-2">
              <Youtube className="size-6" />
              פרטי הפרק
            </CardTitle>
            <div className="space-y-1 text-red-100">
              <div className="flex items-center gap-2">
                <Calendar className="size-4" />
                <span>תאריך ניתוח: {formatDate(episode.analysis_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4" />
                <span>שפה: {episode.language === 'he' ? 'עברית' : episode.language}</span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            asChild
            className="bg-white text-red-600 hover:bg-red-50"
          >
            <a 
              href={episode.video_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLink className="size-4" />
              צפה בסרטון
            </a>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Statistics */}
          <div className="bg-white rounded-xl p-4 border border-red-200">
            <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <Utensils className="size-5" />
              סטטיסטיקות הפרק
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">מסעדות שנמצאו:</span>
                <Badge className="bg-red-100 text-red-800">
                  {episode.total_restaurants_found}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">שיטת עיבוד:</span>
                <Badge variant="outline" className="border-red-200 text-red-700">
                  {episode.processing_method}
                </Badge>
              </div>
            </div>
          </div>

          {/* Location Distribution */}
          {locationSummary.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-red-200">
              <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <MapPin className="size-5" />
                חלוקה גיאוגרפית
              </h3>
              <div className="space-y-2">
                {locationSummary.map(([city, count]) => (
                  <div key={city} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{city}</span>
                    <Badge 
                      variant="outline" 
                      className="border-red-200 text-red-700 cursor-pointer hover:bg-red-100"
                      onClick={() => onRestaurantFilter?.(city)}
                    >
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cuisine Distribution */}
          {cuisineSummary.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-red-200">
              <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <Utensils className="size-5" />
                סוגי מטבח
              </h3>
              <div className="space-y-2">
                {cuisineSummary.map(([cuisine, count]) => (
                  <div key={cuisine} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{cuisine}</span>
                    <Badge 
                      variant="outline" 
                      className="border-red-200 text-red-700 cursor-pointer hover:bg-red-100"
                      onClick={() => onRestaurantFilter?.(cuisine)}
                    >
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Host Opinion Summary */}
        <div className="mt-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
          <h3 className="font-semibold text-red-800 mb-3">דעות המובחר בפרק</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(opinionStats.entries()).map(([opinion, count]) => {
              const opinionConfig = {
                positive: { label: 'חיובית', emoji: '👍', color: 'bg-green-100 text-green-800 border-green-200' },
                mixed: { label: 'מעורבת', emoji: '🤔', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                neutral: { label: 'ניטרלית', emoji: '😐', color: 'bg-gray-100 text-gray-800 border-gray-200' },
                negative: { label: 'שלילית', emoji: '👎', color: 'bg-red-100 text-red-800 border-red-200' }
              }
              
              const config = opinionConfig[opinion as keyof typeof opinionConfig] || opinionConfig.neutral
              
              return (
                <Badge 
                  key={opinion}
                  className={`${config.color} cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => onRestaurantFilter?.(opinion)}
                >
                  {config.emoji} {config.label} ({count})
                </Badge>
              )
            })}
          </div>
        </div>

        {/* Episode Video ID for debugging */}
        <div className="mt-4 text-xs text-gray-500 text-center">
          Video ID: {episode.video_id}
        </div>
      </CardContent>
    </Card>
  )
}