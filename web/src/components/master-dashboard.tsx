"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  Search,
  Clock,
  Map,
  TrendingUp,
  Heart,
  Filter,
  RefreshCw,
  BarChart3
} from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { RestaurantCard } from "./restaurant-card"
import { RestaurantMap } from "./restaurant-map"
import { UnifiedSearch } from "./unified-search"
import { TimelineFilterView } from "./timeline-filter-view"
import { LocationFilter } from "./location-filter"
import { CuisineFilter } from "./cuisine-filter"
import { PriceFilter } from "./price-filter"
import { useFavorites } from "@/contexts/favorites-context"
import { TrendingAnalytics } from "./trending-analytics"
import { endpoints } from "@/lib/config"

interface SearchResults {
  restaurants: Restaurant[]
  timeline_data: TimelineItem[]
  analytics: SearchAnalytics
}

interface TimelineItem {
  date: string
  restaurants: Restaurant[]
  count: number
}

interface SearchAnalytics {
  total_count: number
  filter_counts: {
    cuisine: Record<string, number>
    location: Record<string, number>
    price_range: Record<string, number>
    host_opinion: Record<string, number>
  }
  date_distribution: Record<string, number>
}

export function MasterDashboard() {
  // State management
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  // Filter states for classic view
  const [classicFilters, setClassicFilters] = useState({
    selectedCity: "all",
    selectedRegion: "all", 
    selectedNeighborhood: "all",
    selectedCuisines: [] as string[],
    selectedPriceRanges: [] as string[],
    searchTerm: ""
  })

  const { favoriteRestaurants, setAllRestaurants: setFavoriteContext } = useFavorites()

  // Load initial data
  useEffect(() => {
    loadAllRestaurants()
  }, [])

  const loadAllRestaurants = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(endpoints.restaurants.list())
      const data = await response.json()

      if (data.restaurants) {
        setAllRestaurants(data.restaurants)
        setFavoriteContext(data.restaurants)
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Determine which restaurants to display
  const displayRestaurants = useMemo(() => {
    // If we have search results, use those; otherwise use all restaurants
    const baseRestaurants = searchResults?.restaurants || allRestaurants

    // Apply classic filters if we're on overview or other classic tabs
    if (activeTab === "overview" || activeTab === "map" || activeTab === "favorites") {
      return baseRestaurants.filter(restaurant => {
        // Search term filter
        if (classicFilters.searchTerm) {
          const searchLower = classicFilters.searchTerm.toLowerCase()
          const matchesSearch = 
            restaurant.name_hebrew.toLowerCase().includes(searchLower) ||
            restaurant.name_english?.toLowerCase().includes(searchLower) ||
            restaurant.location.city?.toLowerCase().includes(searchLower) ||
            restaurant.cuisine_type.toLowerCase().includes(searchLower) ||
            restaurant.host_comments.toLowerCase().includes(searchLower)
          
          if (!matchesSearch) return false
        }

        // Location filters
        if (classicFilters.selectedCity !== "all" && restaurant.location.city !== classicFilters.selectedCity) return false
        if (classicFilters.selectedRegion !== "all" && restaurant.location.region !== classicFilters.selectedRegion) return false
        if (classicFilters.selectedNeighborhood !== "all" && restaurant.location.neighborhood !== classicFilters.selectedNeighborhood) return false

        // Cuisine filters
        if (classicFilters.selectedCuisines.length > 0 && !classicFilters.selectedCuisines.includes(restaurant.cuisine_type)) return false

        // Price range filters  
        if (classicFilters.selectedPriceRanges.length > 0 && !classicFilters.selectedPriceRanges.includes(restaurant.price_range)) return false

        return true
      })
    }

    return baseRestaurants
  }, [searchResults, allRestaurants, classicFilters, activeTab])

  // Analytics for overview
  const dashboardAnalytics = useMemo(() => {
    const restaurants = displayRestaurants
    
    const totalRestaurants = restaurants.length
    const totalEpisodes = new Set(restaurants.map(r => r.episode_info?.video_id).filter(Boolean)).size
    
    const cuisineCount: Record<string, number> = {}
    const locationCount: Record<string, number> = {}
    const opinionCount: Record<string, number> = {}
    
    restaurants.forEach(restaurant => {
      // Count cuisines
      if (restaurant.cuisine_type) {
        cuisineCount[restaurant.cuisine_type] = (cuisineCount[restaurant.cuisine_type] || 0) + 1
      }
      
      // Count locations
      if (restaurant.location.city) {
        locationCount[restaurant.location.city] = (locationCount[restaurant.location.city] || 0) + 1
      }
      
      // Count opinions
      if (restaurant.host_opinion) {
        opinionCount[restaurant.host_opinion] = (opinionCount[restaurant.host_opinion] || 0) + 1
      }
    })

    const topCuisines = Object.entries(cuisineCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const topLocations = Object.entries(locationCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return {
      totalRestaurants,
      totalEpisodes,
      topCuisines,
      topLocations,
      opinionDistribution: opinionCount
    }
  }, [displayRestaurants])

  const handleSearchResults = (results: SearchResults) => {
    setSearchResults(results)
  }

  const clearSearch = () => {
    setSearchResults(null)
  }

  const clearClassicFilters = () => {
    setClassicFilters({
      selectedCity: "all",
      selectedRegion: "all",
      selectedNeighborhood: "all", 
      selectedCuisines: [],
      selectedPriceRanges: [],
      searchTerm: ""
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="size-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-lg text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <LayoutDashboard className="size-8" />
                  מרכז הבקרה המאוחד - Where2Eat
                </h1>
                <p className="text-orange-100 mt-2">
                  חקור מסעדות עם סינון מתקדם, ציר זמן ואנליטיקה
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{dashboardAnalytics.totalRestaurants}</div>
                <div className="text-orange-200">מסעדות במערכת</div>
                <div className="text-lg font-semibold mt-1">{dashboardAnalytics.totalEpisodes}</div>
                <div className="text-orange-200">פרקים</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Card className="border-2 border-orange-200">
            <CardContent className="p-4">
              <TabsList className="grid grid-cols-2 lg:grid-cols-6 gap-2 bg-orange-100">
                <TabsTrigger 
                  value="overview" 
                  className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  <BarChart3 className="size-4" />
                  סקירה
                </TabsTrigger>
                <TabsTrigger 
                  value="search" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                >
                  <Search className="size-4" />
                  חיפוש מתקדם
                </TabsTrigger>
                <TabsTrigger 
                  value="timeline" 
                  className="flex items-center gap-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                >
                  <Clock className="size-4" />
                  ציר זמן
                </TabsTrigger>
                <TabsTrigger 
                  value="map" 
                  className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white"
                >
                  <Map className="size-4" />
                  מפה
                </TabsTrigger>
                <TabsTrigger 
                  value="favorites" 
                  className="flex items-center gap-2 data-[state=active]:bg-red-500 data-[state=active]:text-white"
                >
                  <Heart className="size-4" />
                  מועדפות ({favoriteRestaurants.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className="flex items-center gap-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
                >
                  <TrendingUp className="size-4" />
                  טרנדים
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{dashboardAnalytics.opinionDistribution.positive || 0}</div>
                  <div className="text-green-100">מסעדות מומלצות</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{dashboardAnalytics.opinionDistribution.mixed || 0}</div>
                  <div className="text-yellow-100">מסעדות מעורבות</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{dashboardAnalytics.topLocations.length}</div>
                  <div className="text-blue-100">ערים שונות</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{dashboardAnalytics.topCuisines.length}</div>
                  <div className="text-purple-100">סוגי מטבח</div>
                </CardContent>
              </Card>
            </div>

            {/* Classic Filters */}
            <Card className="border-2 border-orange-200">
              <CardHeader className="bg-gradient-to-r from-orange-100 to-amber-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="size-5 text-orange-600" />
                    מסננים קלאסיים
                  </CardTitle>
                  <Button variant="outline" onClick={clearClassicFilters} size="sm">
                    נקה מסננים
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <LocationFilter
                    restaurants={allRestaurants}
                    selectedCity={classicFilters.selectedCity}
                    selectedRegion={classicFilters.selectedRegion}
                    selectedNeighborhood={classicFilters.selectedNeighborhood}
                    onCityChange={(city) => setClassicFilters(prev => ({ ...prev, selectedCity: city }))}
                    onRegionChange={(region) => setClassicFilters(prev => ({ ...prev, selectedRegion: region }))}
                    onNeighborhoodChange={(neighborhood) => setClassicFilters(prev => ({ ...prev, selectedNeighborhood: neighborhood }))}
                  />
                  <CuisineFilter
                    restaurants={allRestaurants}
                    selectedCuisines={classicFilters.selectedCuisines}
                    onCuisineChange={(cuisines) => setClassicFilters(prev => ({ ...prev, selectedCuisines: cuisines }))}
                  />
                  <PriceFilter
                    restaurants={allRestaurants}
                    selectedPriceRanges={classicFilters.selectedPriceRanges}
                    onPriceRangeChange={(priceRanges) => setClassicFilters(prev => ({ ...prev, selectedPriceRanges: priceRanges }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Restaurant Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    תוצאות ({displayRestaurants.length} מסעדות)
                  </CardTitle>
                  {searchResults && (
                    <Button variant="outline" onClick={clearSearch} size="sm">
                      נקה חיפוש מתקדם
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayRestaurants.map((restaurant, index) => (
                  <RestaurantCard 
                    key={`${restaurant.name_hebrew}-${index}`} 
                    restaurant={restaurant}
                  />
                ))}
                {displayRestaurants.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-6xl mb-4">🍽️</div>
                    <p>לא נמצאו מסעדות המתאימות לקריטריונים</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <UnifiedSearch 
              onSearchResults={handleSearchResults}
              onLoadingChange={setSearchLoading}
            />
            
            {searchResults && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    תוצאות חיפוש מתקדם ({searchResults.restaurants.length} מסעדות)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {searchResults.restaurants.map((restaurant, index) => (
                    <RestaurantCard 
                      key={`search-${restaurant.name_hebrew}-${index}`} 
                      restaurant={restaurant}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-6">
            <TimelineFilterView
              restaurants={displayRestaurants}
              onRestaurantSelect={setSelectedRestaurant}
            />
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map" className="space-y-6">
            <RestaurantMap
              restaurants={displayRestaurants}
              selectedRestaurant={selectedRestaurant}
              onRestaurantSelect={setSelectedRestaurant}
            />
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="size-5 text-red-500" />
                  המסעדות המועדפות שלך ({favoriteRestaurants.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {favoriteRestaurants.map((restaurant, index) => (
                  <RestaurantCard 
                    key={`favorite-${restaurant.name_hebrew}-${index}`} 
                    restaurant={restaurant}
                  />
                ))}
                {favoriteRestaurants.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-6xl mb-4">❤️</div>
                    <p>עדיין לא הוספת מסעדות למועדפות</p>
                    <p className="text-sm mt-2">לחץ על הלב במסעדות כדי להוסיף אותן למועדפות</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <TrendingAnalytics 
              restaurants={displayRestaurants}
              onRestaurantFilter={(filterType, value) => {
                // Apply filter based on type
                if (filterType === 'cuisine') {
                  setClassicFilters(prev => ({ 
                    ...prev, 
                    selectedCuisines: prev.selectedCuisines.includes(value) 
                      ? prev.selectedCuisines.filter(c => c !== value)
                      : [...prev.selectedCuisines, value]
                  }))
                } else if (filterType === 'location') {
                  setClassicFilters(prev => ({ ...prev, selectedCity: value }))
                }
                // Switch to overview tab to see results
                setActiveTab('overview')
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}