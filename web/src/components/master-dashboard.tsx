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
  BarChart3,
  Utensils,
  MapPin,
  ThumbsUp
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
import { BottomNav, BottomNavSpacer } from "./bottom-nav"
import { StatsCard, StatsGrid } from "./stats-card"
import { RestaurantCardSkeleton } from "./ui/skeleton"

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
      const response = await fetch('http://localhost:3001/api/restaurants')
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
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="h-32 skeleton-shimmer rounded-xl" />

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
            ))}
          </div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 md:p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTZWMGg2djMwem0tNiAwSDI0VjBoNnYzMHptLTYgMEgxOFYwaDZ2MzB6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <Utensils className="size-8" />
                Where2Eat
              </h1>
              <p className="text-primary-foreground/80 mt-1 text-sm md:text-base">
                גלה מסעדות מומלצות מהפודקאסטים האהובים
              </p>
            </div>
            <div className="flex gap-4 md:gap-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold">{dashboardAnalytics.totalRestaurants}</div>
                <div className="text-primary-foreground/70 text-xs md:text-sm">מסעדות</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold">{dashboardAnalytics.totalEpisodes}</div>
                <div className="text-primary-foreground/70 text-xs md:text-sm">פרקים</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold">{favoriteRestaurants.length}</div>
                <div className="text-primary-foreground/70 text-xs md:text-sm">מועדפים</div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Desktop Tab Navigation */}
          <nav className="hidden md:block sticky top-4 z-40">
            <Card className="border shadow-sm">
              <CardContent className="p-2">
                <TabsList className="grid grid-cols-6 gap-1 bg-muted/50 p-1 rounded-lg">
                  <TabsTrigger
                    value="overview"
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all"
                  >
                    <BarChart3 className="size-4" />
                    סקירה
                  </TabsTrigger>
                  <TabsTrigger
                    value="search"
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all"
                  >
                    <Search className="size-4" />
                    חיפוש
                  </TabsTrigger>
                  <TabsTrigger
                    value="timeline"
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all"
                  >
                    <Clock className="size-4" />
                    ציר זמן
                  </TabsTrigger>
                  <TabsTrigger
                    value="map"
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all"
                  >
                    <Map className="size-4" />
                    מפה
                  </TabsTrigger>
                  <TabsTrigger
                    value="favorites"
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all"
                  >
                    <Heart className="size-4" />
                    מועדפים
                    {favoriteRestaurants.length > 0 && (
                      <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-xs">
                        {favoriteRestaurants.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="analytics"
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all"
                  >
                    <TrendingUp className="size-4" />
                    טרנדים
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>
          </nav>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 animate-fade-in">
            {/* Quick Stats */}
            <StatsGrid columns={4}>
              <StatsCard
                title="מסעדות מומלצות"
                value={dashboardAnalytics.opinionDistribution.positive || 0}
                icon={ThumbsUp}
                iconColor="text-green-600"
                subtitle={`${Math.round(((dashboardAnalytics.opinionDistribution.positive || 0) / dashboardAnalytics.totalRestaurants) * 100)}% מהמסעדות`}
              />
              <StatsCard
                title="מסעדות מעורבות"
                value={dashboardAnalytics.opinionDistribution.mixed || 0}
                icon={BarChart3}
                iconColor="text-amber-600"
              />
              <StatsCard
                title="ערים שונות"
                value={dashboardAnalytics.topLocations.length}
                icon={MapPin}
                iconColor="text-blue-600"
              />
              <StatsCard
                title="סוגי מטבח"
                value={dashboardAnalytics.topCuisines.length}
                icon={Utensils}
                iconColor="text-purple-600"
              />
            </StatsGrid>

            {/* Classic Filters */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Filter className="size-5 text-primary" />
                    מסננים
                  </CardTitle>
                  <Button variant="ghost" onClick={clearClassicFilters} size="sm" className="text-muted-foreground">
                    נקה הכל
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  תוצאות ({displayRestaurants.length} מסעדות)
                </h2>
                {searchResults && (
                  <Button variant="outline" onClick={clearSearch} size="sm">
                    נקה חיפוש
                  </Button>
                )}
              </div>

              {displayRestaurants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayRestaurants.map((restaurant, index) => (
                    <RestaurantCard
                      key={`${restaurant.name_hebrew}-${index}`}
                      restaurant={restaurant}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-6xl mb-4">🍽️</div>
                    <h3 className="text-lg font-medium text-foreground mb-2">לא נמצאו מסעדות</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                      נסה לשנות את המסננים או לחפש עם מילות מפתח אחרות
                    </p>
                    <Button variant="outline" onClick={clearClassicFilters} className="mt-4">
                      נקה מסננים
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
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
          <TabsContent value="favorites" className="space-y-6 animate-fade-in">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="size-5 text-red-500 fill-red-500" />
                המסעדות המועדפות שלך ({favoriteRestaurants.length})
              </h2>

              {favoriteRestaurants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {favoriteRestaurants.map((restaurant, index) => (
                    <RestaurantCard
                      key={`favorite-${restaurant.name_hebrew}-${index}`}
                      restaurant={restaurant}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="text-6xl mb-4">❤️</div>
                    <h3 className="text-lg font-medium text-foreground mb-2">אין מועדפים עדיין</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                      לחץ על הלב במסעדות כדי להוסיף אותן למועדפות
                    </p>
                    <Button variant="default" onClick={() => setActiveTab('overview')} className="mt-4">
                      גלה מסעדות
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6 animate-fade-in">
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

        {/* Bottom spacer for mobile nav */}
        <BottomNavSpacer />
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoritesCount={favoriteRestaurants.length}
      />
    </div>
  )
}