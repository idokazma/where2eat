"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Filter, TrendingUp, BarChart3, MapPin, Utensils, ExternalLink } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { RestaurantCard } from "./restaurant-card"
import { EpisodeMetadata } from "./episode-metadata"

interface TimelineFilterViewProps {
  restaurants: Restaurant[]
  onRestaurantSelect?: (restaurant: Restaurant) => void
}

interface TimelineGroup {
  date: string
  episodeInfo: {
    video_id: string
    video_url: string
    analysis_date: string
    language: string
    total_restaurants_found: number
    processing_method: string
  }
  restaurants: Restaurant[]
  filteredRestaurants: Restaurant[]
}

export function TimelineFilterView({ restaurants, onRestaurantSelect }: TimelineFilterViewProps) {
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([])
  const [selectedOpinions, setSelectedOpinions] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'timeline' | 'analytics'>('timeline')

  // Group restaurants by episodes and dates
  const timelineGroups = useMemo(() => {
    const groupMap = new Map<string, TimelineGroup>()

    restaurants.forEach(restaurant => {
      if (restaurant.episode_info?.video_id) {
        const key = `${restaurant.episode_info.video_id}_${restaurant.episode_info.analysis_date}`
        
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            date: restaurant.episode_info.analysis_date,
            episodeInfo: {
              video_id: restaurant.episode_info.video_id,
              video_url: restaurant.episode_info.video_url,
              analysis_date: restaurant.episode_info.analysis_date,
              language: restaurant.episode_info.language,
              total_restaurants_found: restaurant.episode_info.total_restaurants_found || 0,
              processing_method: restaurant.episode_info.processing_method || 'unknown'
            },
            restaurants: [],
            filteredRestaurants: []
          })
        }

        groupMap.get(key)!.restaurants.push(restaurant)
      }
    })

    return Array.from(groupMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [restaurants])

  // Apply filters to each timeline group
  const filteredTimelineGroups = useMemo(() => {
    return timelineGroups.map(group => {
      const filteredRestaurants = group.restaurants.filter(restaurant => {
        // Cuisine filter
        if (selectedCuisines.length > 0 && (!restaurant.cuisine_type || !selectedCuisines.includes(restaurant.cuisine_type))) {
          return false
        }

        // Price range filter
        if (selectedPriceRanges.length > 0 && (!restaurant.price_range || !selectedPriceRanges.includes(restaurant.price_range))) {
          return false
        }

        // Opinion filter
        if (selectedOpinions.length > 0 && (!restaurant.host_opinion || !selectedOpinions.includes(restaurant.host_opinion))) {
          return false
        }

        // Location filter
        if (selectedLocations.length > 0 && !selectedLocations.some(loc =>
          restaurant.location?.city?.includes(loc) ||
          restaurant.location?.region?.includes(loc)
        )) {
          return false
        }

        return true
      })

      return {
        ...group,
        filteredRestaurants
      }
    }).filter(group => group.filteredRestaurants.length > 0) // Only show episodes with filtered results
  }, [timelineGroups, selectedCuisines, selectedPriceRanges, selectedOpinions, selectedLocations])

  // Get all unique values for filters
  const filterOptions = useMemo(() => {
    const cuisines = new Set<string>()
    const priceRanges = new Set<string>()
    const opinions = new Set<string>()
    const locations = new Set<string>()

    restaurants.forEach(restaurant => {
      if (restaurant.cuisine_type) cuisines.add(restaurant.cuisine_type)
      if (restaurant.price_range) priceRanges.add(restaurant.price_range)
      if (restaurant.host_opinion) opinions.add(restaurant.host_opinion)
      if (restaurant.location?.city) locations.add(restaurant.location.city)
      if (restaurant.location?.region) locations.add(restaurant.location.region)
    })

    return {
      cuisines: Array.from(cuisines).sort(),
      priceRanges: Array.from(priceRanges),
      opinions: Array.from(opinions),
      locations: Array.from(locations).sort()
    }
  }, [restaurants])

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalFilteredRestaurants = filteredTimelineGroups.reduce((sum, group) => 
      sum + group.filteredRestaurants.length, 0
    )

    const cuisineDistribution = new Map<string, number>()
    const locationDistribution = new Map<string, number>()
    const monthlyTrends = new Map<string, number>()

    filteredTimelineGroups.forEach(group => {
      group.filteredRestaurants.forEach(restaurant => {
        // Cuisine distribution
        const cuisine = restaurant.cuisine_type
        cuisineDistribution.set(cuisine, (cuisineDistribution.get(cuisine) || 0) + 1)

        // Location distribution
        const city = restaurant.location?.city
        if (city) {
          locationDistribution.set(city, (locationDistribution.get(city) || 0) + 1)
        }

        // Monthly trends
        const date = new Date(group.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        monthlyTrends.set(monthKey, (monthlyTrends.get(monthKey) || 0) + 1)
      })
    })

    return {
      totalFilteredRestaurants,
      totalFilteredEpisodes: filteredTimelineGroups.length,
      topCuisines: Array.from(cuisineDistribution.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topLocations: Array.from(locationDistribution.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
      monthlyTrends: Array.from(monthlyTrends.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    }
  }, [filteredTimelineGroups])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const toggleFilter = (array: string[], value: string, setter: (newArray: string[]) => void) => {
    if (array.includes(value)) {
      setter(array.filter(item => item !== value))
    } else {
      setter([...array, value])
    }
  }

  const clearAllFilters = () => {
    setSelectedCuisines([])
    setSelectedPriceRanges([])
    setSelectedOpinions([])
    setSelectedLocations([])
  }

  const hasActiveFilters = selectedCuisines.length > 0 || 
                          selectedPriceRanges.length > 0 || 
                          selectedOpinions.length > 0 || 
                          selectedLocations.length > 0

  return (
    <div className="space-y-6">
      {/* Filter Panel */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="size-6" />
              סינון מסעדות בציר הזמן
            </div>
            <div className="text-right text-purple-100">
              {analytics.totalFilteredRestaurants} מסעדות ב-{analytics.totalFilteredEpisodes} פרקים
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Cuisine Filter */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Utensils className="size-4 text-purple-500" />
                מטבח ({selectedCuisines.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {filterOptions.cuisines.map(cuisine => (
                  <Badge
                    key={cuisine}
                    variant={selectedCuisines.includes(cuisine) ? "default" : "outline"}
                    className={`cursor-pointer text-xs ${
                      selectedCuisines.includes(cuisine)
                        ? 'bg-purple-500 text-white'
                        : 'hover:bg-purple-100 border-purple-200'
                    }`}
                    onClick={() => toggleFilter(selectedCuisines, cuisine, setSelectedCuisines)}
                  >
                    {cuisine}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Location Filter */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-purple-500" />
                מיקום ({selectedLocations.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {filterOptions.locations.map(location => (
                  <Badge
                    key={location}
                    variant={selectedLocations.includes(location) ? "default" : "outline"}
                    className={`cursor-pointer text-xs ${
                      selectedLocations.includes(location)
                        ? 'bg-green-500 text-white'
                        : 'hover:bg-green-100 border-green-200'
                    }`}
                    onClick={() => toggleFilter(selectedLocations, location, setSelectedLocations)}
                  >
                    {location}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div>
              <h4 className="font-semibold mb-3">טווח מחירים ({selectedPriceRanges.length})</h4>
              <div className="space-y-1">
                {filterOptions.priceRanges.map(price => {
                  const priceConfig = {
                    budget: { label: 'זול ₪', color: 'bg-green-500' },
                    'mid-range': { label: 'בינוני ₪₪', color: 'bg-yellow-500' },
                    expensive: { label: 'יקר ₪₪₪', color: 'bg-red-500' },
                    not_mentioned: { label: 'לא צוין', color: 'bg-gray-500' }
                  }
                  
                  const config = priceConfig[price as keyof typeof priceConfig]
                  
                  return (
                    <Badge
                      key={price}
                      variant={selectedPriceRanges.includes(price) ? "default" : "outline"}
                      className={`cursor-pointer text-xs w-full justify-center ${
                        selectedPriceRanges.includes(price)
                          ? config.color + ' text-white'
                          : 'hover:bg-gray-100 border-gray-200'
                      }`}
                      onClick={() => toggleFilter(selectedPriceRanges, price, setSelectedPriceRanges)}
                    >
                      {config.label}
                    </Badge>
                  )
                })}
              </div>
            </div>

            {/* Opinion Filter */}
            <div>
              <h4 className="font-semibold mb-3">דעת המובחר ({selectedOpinions.length})</h4>
              <div className="space-y-1">
                {filterOptions.opinions.map(opinion => {
                  const opinionConfig = {
                    positive: { label: 'חיובית 👍', color: 'bg-green-500' },
                    mixed: { label: 'מעורבת 🤔', color: 'bg-yellow-500' },
                    neutral: { label: 'ניטרלית 😐', color: 'bg-gray-500' },
                    negative: { label: 'שלילית 👎', color: 'bg-red-500' }
                  }
                  
                  const config = opinionConfig[opinion as keyof typeof opinionConfig]
                  
                  return (
                    <Badge
                      key={opinion}
                      variant={selectedOpinions.includes(opinion) ? "default" : "outline"}
                      className={`cursor-pointer text-xs w-full justify-center ${
                        selectedOpinions.includes(opinion)
                          ? config.color + ' text-white'
                          : 'hover:bg-gray-100 border-gray-200'
                      }`}
                      onClick={() => toggleFilter(selectedOpinions, opinion, setSelectedOpinions)}
                    >
                      {config.label}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-purple-200">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                נקה כל המסננים
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'timeline' | 'analytics')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Calendar className="size-4" />
            תצוגת ציר זמן
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            אנליטיקה וטרנדים
          </TabsTrigger>
        </TabsList>

        {/* Timeline View */}
        <TabsContent value="timeline" className="space-y-6 mt-6">
          {filteredTimelineGroups.map((group, index) => (
            <Card key={`${group.episodeInfo.video_id}-${group.date}`} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-100 to-gray-100 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      פרק מ-{formatDate(group.date)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {group.filteredRestaurants.length} מתוך {group.restaurants.length} מסעדות מוצגות
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    <a href={group.episodeInfo.video_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4 ml-1" />
                      צפה בפרק
                    </a>
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-4">
                  {group.filteredRestaurants.map((restaurant, restaurantIndex) => (
                    <div key={`${restaurant.name_hebrew}-${restaurantIndex}`}>
                      <RestaurantCard 
                        restaurant={restaurant}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredTimelineGroups.length === 0 && (
            <Card className="text-center py-12 bg-gray-50">
              <CardContent>
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  לא נמצאו תוצאות
                </h3>
                <p className="text-gray-500">
                  נסו לשנות את המסננים כדי לראות תוצאות
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics View */}
        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Top Cuisines */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-orange-500" />
                  מטבחים פופולריים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.topCuisines.map(([cuisine, count], index) => (
                    <div key={cuisine} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                      <span className="font-medium">#{index + 1} {cuisine}</span>
                      <Badge className="bg-orange-500 text-white">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Locations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-5 text-green-500" />
                  מיקומים מובילים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.topLocations.map(([location, count], index) => (
                    <div key={location} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="font-medium">#{index + 1} {location}</span>
                      <Badge className="bg-green-500 text-white">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-blue-500" />
                  טרנדים חודשיים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.monthlyTrends.slice(-6).map(([month, count]) => (
                    <div key={month} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="font-medium">{month}</span>
                      <Badge className="bg-blue-500 text-white">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}