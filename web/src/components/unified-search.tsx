"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Calendar, TrendingUp, Filter, X, RefreshCw } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { endpoints, getApiUrl } from "@/lib/config"
import { useLanguage } from "@/contexts/LanguageContext"

interface UnifiedSearchProps {
  onSearchResults: (results: SearchResults) => void
  onLoadingChange?: (loading: boolean) => void
}

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

interface SearchFilters {
  searchTerm: string
  location: string
  cuisine: string[]
  priceRange: string[]
  hostOpinion: string[]
  dateStart: string
  dateEnd: string
  episodeId: string
  sortBy: string
  sortDirection: 'asc' | 'desc'
}

export function UnifiedSearch({ onSearchResults, onLoadingChange }: UnifiedSearchProps) {
  const { t } = useLanguage()
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    location: '',
    cuisine: [],
    priceRange: [],
    hostOpinion: [],
    dateStart: '',
    dateEnd: '',
    episodeId: '',
    sortBy: 'published_at',
    sortDirection: 'desc'
  })

  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<{
    locations: string[]
    cuisines: string[]
    episodes: string[]
  }>({ locations: [], cuisines: [], episodes: [] })

  const [searchHistory, setSearchHistory] = useState<string[]>([])

  // Load suggestions and search history on mount
  useEffect(() => {
    loadSuggestions()
    loadSearchHistory()
  }, [])

  const loadSuggestions = async () => {
    try {
      const response = await fetch(endpoints.restaurants.list())
      const data = await response.json()
      
      if (data.restaurants) {
        const locations = new Set<string>()
        const cuisines = new Set<string>()
        const episodes = new Set<string>()

        data.restaurants.forEach((restaurant: Restaurant) => {
          if (restaurant.location?.city) locations.add(restaurant.location?.city)
          if (restaurant.cuisine_type) cuisines.add(restaurant.cuisine_type)
          if (restaurant.episode_info?.video_id) episodes.add(restaurant.episode_info.video_id)
        })

        setSuggestions({
          locations: Array.from(locations).sort(),
          cuisines: Array.from(cuisines).sort(),
          episodes: Array.from(episodes)
        })
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }

  const loadSearchHistory = () => {
    const history = localStorage.getItem('where2eat-search-history')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (error) {
        console.error('Failed to load search history:', error)
      }
    }
  }

  const saveSearchHistory = (searchTerm: string) => {
    if (!searchTerm.trim()) return
    
    const newHistory = [searchTerm, ...searchHistory.filter(h => h !== searchTerm)].slice(0, 10)
    setSearchHistory(newHistory)
    localStorage.setItem('where2eat-search-history', JSON.stringify(newHistory))
  }

  const performSearch = async () => {
    setIsLoading(true)
    onLoadingChange?.(true)

    try {
      const params = new URLSearchParams()
      
      if (filters.searchTerm) {
        params.append('q', filters.searchTerm)
        saveSearchHistory(filters.searchTerm)
      }
      if (filters.location) params.append('location', filters.location)
      if (filters.cuisine.length > 0) {
        filters.cuisine.forEach(c => params.append('cuisine', c))
      }
      if (filters.priceRange.length > 0) {
        filters.priceRange.forEach(p => params.append('price_range', p))
      }
      if (filters.hostOpinion.length > 0) {
        filters.hostOpinion.forEach(h => params.append('host_opinion', h))
      }
      if (filters.dateStart) params.append('date_start', filters.dateStart)
      if (filters.dateEnd) params.append('date_end', filters.dateEnd)
      if (filters.episodeId) params.append('episode_id', filters.episodeId)
      
      params.append('sort_by', filters.sortBy)
      params.append('sort_direction', filters.sortDirection)
      params.append('limit', '50') // Increased limit for comprehensive results

      const response = await fetch(getApiUrl(`/api/restaurants/search?${params}`))
      const data = await response.json()

      if (response.ok) {
        onSearchResults({
          restaurants: data.restaurants || [],
          timeline_data: data.timeline_data || [],
          analytics: data.analytics || {
            total_count: 0,
            filter_counts: { cuisine: {}, location: {}, price_range: {}, host_opinion: {} },
            date_distribution: {}
          }
        })
      } else {
        throw new Error(data.error || 'Search failed')
      }
    } catch (error) {
      console.error('Search error:', error)
      // Show error state
      onSearchResults({
        restaurants: [],
        timeline_data: [],
        analytics: {
          total_count: 0,
          filter_counts: { cuisine: {}, location: {}, price_range: {}, host_opinion: {} },
          date_distribution: {}
        }
      })
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      location: '',
      cuisine: [],
      priceRange: [],
      hostOpinion: [],
      dateStart: '',
      dateEnd: '',
      episodeId: '',
      sortBy: 'published_at',
      sortDirection: 'desc'
    })
  }

  const hasActiveFilters = useMemo(() => {
    return filters.searchTerm || 
           filters.location || 
           filters.cuisine.length > 0 || 
           filters.priceRange.length > 0 || 
           filters.hostOpinion.length > 0 || 
           filters.dateStart || 
           filters.dateEnd || 
           filters.episodeId
  }, [filters])

  const toggleArrayFilter = (array: string[], value: string, setter: (newArray: string[]) => void) => {
    if (array.includes(value)) {
      setter(array.filter(item => item !== value))
    } else {
      setter([...array, value])
    }
  }

  // Trigger search when filters change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasActiveFilters || filters.sortBy !== 'published_at') {
        performSearch()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [filters])

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
        <CardTitle className="flex items-center gap-2">
          <Search className="size-6" />
          {t('search.title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick">{t('search.quickSearch')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('search.advancedSearch')}</TabsTrigger>
            <TabsTrigger value="timeline">{t('search.timelineSearch')}</TabsTrigger>
          </TabsList>
          
          {/* Quick Search Tab */}
          <TabsContent value="quick" className="space-y-4 mt-6">
            <div className="relative">
              <Search className="absolute right-4 top-4 size-5 text-blue-400" />
              <Input
                placeholder={t('search.placeholder')}
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="pr-12 text-right text-lg py-6 border-2 border-blue-200 focus:border-blue-400 rounded-xl bg-blue-50/30"
              />
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">{t('search.recentSearches')}</h4>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.slice(0, 5).map((term, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-100 border-blue-200"
                      onClick={() => setFilters(prev => ({ ...prev, searchTerm: term }))}
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Advanced Search Tab */}
          <TabsContent value="advanced" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Location Filter */}
              <div>
                <h4 className="font-medium mb-3">מיקום</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={filters.location === '' ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilters(prev => ({ ...prev, location: '' }))}
                  >
                    כל המיקומים
                  </Badge>
                  {suggestions.locations.map(location => (
                    <Badge
                      key={location}
                      variant={filters.location === location ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setFilters(prev => ({ ...prev, location }))}
                    >
                      {location}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Cuisine Filter */}
              <div>
                <h4 className="font-medium mb-3">סוג מטבח</h4>
                <div className="flex flex-wrap gap-2">
                  {suggestions.cuisines.map(cuisine => (
                    <Badge
                      key={cuisine}
                      variant={filters.cuisine.includes(cuisine) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleArrayFilter(filters.cuisine, cuisine, (newCuisines) => 
                        setFilters(prev => ({ ...prev, cuisine: newCuisines }))
                      )}
                    >
                      {cuisine} {filters.cuisine.includes(cuisine) && '✓'}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div>
                <h4 className="font-medium mb-3">טווח מחירים</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'budget', label: 'זול ₪', color: 'bg-green-500' },
                    { value: 'mid-range', label: 'בינוני ₪₪', color: 'bg-yellow-500' },
                    { value: 'expensive', label: 'יקר ₪₪₪', color: 'bg-red-500' }
                  ].map(price => (
                    <Badge
                      key={price.value}
                      variant={filters.priceRange.includes(price.value) ? "default" : "outline"}
                      className={`cursor-pointer ${filters.priceRange.includes(price.value) ? price.color + ' text-white' : ''}`}
                      onClick={() => toggleArrayFilter(filters.priceRange, price.value, (newPrices) => 
                        setFilters(prev => ({ ...prev, priceRange: newPrices }))
                      )}
                    >
                      {price.label} {filters.priceRange.includes(price.value) && '✓'}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Host Opinion Filter */}
              <div>
                <h4 className="font-medium mb-3">דעת המובחר</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'positive', label: 'חיובית 👍', color: 'bg-green-500' },
                    { value: 'mixed', label: 'מעורבת 🤔', color: 'bg-yellow-500' },
                    { value: 'neutral', label: 'ניטרלית 😐', color: 'bg-gray-500' },
                    { value: 'negative', label: 'שלילית 👎', color: 'bg-red-500' }
                  ].map(opinion => (
                    <Badge
                      key={opinion.value}
                      variant={filters.hostOpinion.includes(opinion.value) ? "default" : "outline"}
                      className={`cursor-pointer ${filters.hostOpinion.includes(opinion.value) ? opinion.color + ' text-white' : ''}`}
                      onClick={() => toggleArrayFilter(filters.hostOpinion, opinion.value, (newOpinions) => 
                        setFilters(prev => ({ ...prev, hostOpinion: newOpinions }))
                      )}
                    >
                      {opinion.label} {filters.hostOpinion.includes(opinion.value) && '✓'}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Timeline Search Tab */}
          <TabsContent value="timeline" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">תאריך התחלה</label>
                <Input
                  type="date"
                  value={filters.dateStart}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateStart: e.target.value }))}
                  className="border-2 border-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">תאריך סיום</label>
                <Input
                  type="date"
                  value={filters.dateEnd}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateEnd: e.target.value }))}
                  className="border-2 border-blue-200"
                />
              </div>
            </div>

            {/* Episode Filter */}
            <div>
              <h4 className="font-medium mb-3">פרק ספציפי</h4>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={filters.episodeId === '' ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilters(prev => ({ ...prev, episodeId: '' }))}
                >
                  כל הפרקים
                </Badge>
                {suggestions.episodes.slice(0, 10).map(episodeId => (
                  <Badge
                    key={episodeId}
                    variant={filters.episodeId === episodeId ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilters(prev => ({ ...prev, episodeId }))}
                  >
                    {episodeId.substring(0, 8)}...
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quick Date Ranges */}
            <div>
              <h4 className="font-medium mb-3">טווחי זמן מהירים</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'השבוע האחרון', days: 7 },
                  { label: 'החודש האחרון', days: 30 },
                  { label: '3 חודשים אחרונים', days: 90 },
                  { label: 'השנה האחרונה', days: 365 }
                ].map(range => {
                  const endDate = new Date().toISOString().split('T')[0]
                  const startDate = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                  
                  return (
                    <Badge
                      key={range.label}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() => setFilters(prev => ({ 
                        ...prev, 
                        dateStart: startDate, 
                        dateEnd: endDate 
                      }))}
                    >
                      {range.label}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-blue-200">
          <Button
            onClick={performSearch}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
          >
            {isLoading ? (
              <>
                <RefreshCw className="size-4 animate-spin ml-2" />
                מחפש...
              </>
            ) : (
              <>
                <Search className="size-4 ml-2" />
                חפש
              </>
            )}
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <X className="size-4 ml-2" />
              נקה מסננים
            </Button>
          )}
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-800 mb-2">מסננים פעילים:</h4>
            <div className="flex flex-wrap gap-1">
              {filters.searchTerm && (
                <Badge className="bg-blue-500 text-white">
                  טקסט: {filters.searchTerm}
                </Badge>
              )}
              {filters.location && (
                <Badge className="bg-green-500 text-white">
                  מיקום: {filters.location}
                </Badge>
              )}
              {filters.cuisine.map(cuisine => (
                <Badge key={cuisine} className="bg-orange-500 text-white">
                  מטבח: {cuisine}
                </Badge>
              ))}
              {filters.priceRange.map(price => (
                <Badge key={price} className="bg-yellow-500 text-white">
                  מחיר: {price}
                </Badge>
              ))}
              {filters.hostOpinion.map(opinion => (
                <Badge key={opinion} className="bg-purple-500 text-white">
                  דעה: {opinion}
                </Badge>
              ))}
              {(filters.dateStart || filters.dateEnd) && (
                <Badge className="bg-indigo-500 text-white">
                  תאריכים: {filters.dateStart} - {filters.dateEnd}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}