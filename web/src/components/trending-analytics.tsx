"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TrendingUp,
  BarChart3,
  MapPin,
  Utensils,
  Star,
  Calendar,
  Target,
  Award,
  Clock
} from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { endpoints } from "@/lib/config"

interface TrendingAnalyticsProps {
  restaurants: Restaurant[]
  onRestaurantFilter?: (filterType: string, value: string) => void
}

interface TrendingRestaurant {
  restaurant: Restaurant
  mentions: number
  lastMentioned: string
  avgRating?: number
  trendScore: number
}

interface RegionalInsights {
  region: string
  totalRestaurants: number
  cuisineDistribution: Record<string, number>
  priceDistribution: Record<string, number>
  avgRating: number
  topRestaurants: Restaurant[]
}

export function TrendingAnalytics({ restaurants, onRestaurantFilter }: TrendingAnalyticsProps) {
  const [timeframe, setTimeframe] = useState<'1month' | '3months' | '6months' | '1year'>('3months')
  const [trendsData, setTrendsData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Calculate timeframe-filtered restaurants
  const timeframeRestaurants = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date()
    
    switch (timeframe) {
      case '1month':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case '6months':
        cutoffDate.setMonth(now.getMonth() - 6)
        break
      case '1year':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
      case '3months':
      default:
        cutoffDate.setMonth(now.getMonth() - 3)
        break
    }
    
    return restaurants.filter(restaurant => {
      if (restaurant.episode_info?.analysis_date) {
        const analysisDate = new Date(restaurant.episode_info.analysis_date)
        return analysisDate >= cutoffDate
      }
      return false
    })
  }, [restaurants, timeframe])

  // Identify trending restaurants
  const trendingRestaurants = useMemo((): TrendingRestaurant[] => {
    const restaurantMap = new Map<string, { mentions: Restaurant[], scores: number[] }>()
    
    timeframeRestaurants.forEach(restaurant => {
      const key = restaurant.name_hebrew
      if (!restaurantMap.has(key)) {
        restaurantMap.set(key, { mentions: [], scores: [] })
      }
      
      restaurantMap.get(key)!.mentions.push(restaurant)
      
      // Calculate trend score based on multiple factors
      let score = 1 // Base score
      
      // Positive host opinion adds score
      if (restaurant.host_opinion === 'positive') score += 3
      else if (restaurant.host_opinion === 'mixed') score += 1
      else if (restaurant.host_opinion === 'negative') score -= 2
      
      // Recent mentions get higher score
      const daysSinceAnalysis = (Date.now() - new Date(restaurant.episode_info?.analysis_date || 0).getTime()) / (1000 * 60 * 60 * 24)
      score += Math.max(0, 30 - daysSinceAnalysis) / 10 // More recent = higher score
      
      // Google rating adds score
      if (restaurant.rating?.google_rating) {
        score += (restaurant.rating.google_rating - 3) // Ratings above 3 add positive score
      }
      
      restaurantMap.get(key)!.scores.push(score)
    })
    
    return Array.from(restaurantMap.entries())
      .map(([name, data]) => {
        const mentions = data.mentions
        const avgScore = data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
        const latestMention = mentions.sort((a, b) => 
          new Date(b.episode_info?.analysis_date || 0).getTime() - 
          new Date(a.episode_info?.analysis_date || 0).getTime()
        )[0]
        
        return {
          restaurant: latestMention,
          mentions: mentions.length,
          lastMentioned: latestMention.episode_info?.analysis_date || '',
          avgRating: latestMention.rating?.google_rating,
          trendScore: avgScore * mentions.length // Multiple mentions amplify trend score
        }
      })
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 10)
  }, [timeframeRestaurants])

  // Regional insights
  const regionalInsights = useMemo((): RegionalInsights[] => {
    const regionMap = new Map<string, Restaurant[]>()
    
    timeframeRestaurants.forEach(restaurant => {
      const region = restaurant.location?.region || 'Unknown'
      if (!regionMap.has(region)) {
        regionMap.set(region, [])
      }
      regionMap.get(region)!.push(restaurant)
    })
    
    return Array.from(regionMap.entries()).map(([region, restaurants]) => {
      const cuisineDistribution: Record<string, number> = {}
      const priceDistribution: Record<string, number> = {}
      let totalRating = 0
      let ratingCount = 0
      
      restaurants.forEach(restaurant => {
        if (restaurant.cuisine_type) {
          cuisineDistribution[restaurant.cuisine_type] = (cuisineDistribution[restaurant.cuisine_type] || 0) + 1
        }
        if (restaurant.price_range) {
          priceDistribution[restaurant.price_range] = (priceDistribution[restaurant.price_range] || 0) + 1
        }
        if (restaurant.rating?.google_rating) {
          totalRating += restaurant.rating.google_rating
          ratingCount++
        }
      })
      
      return {
        region,
        totalRestaurants: restaurants.length,
        cuisineDistribution,
        priceDistribution,
        avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
        topRestaurants: restaurants
          .filter(r => r.host_opinion === 'positive')
          .slice(0, 3)
      }
    }).sort((a, b) => b.totalRestaurants - a.totalRestaurants)
  }, [timeframeRestaurants])

  // Cuisine trends over time
  const cuisineTrends = useMemo(() => {
    const monthlyData = new Map<string, Map<string, number>>()
    
    timeframeRestaurants.forEach(restaurant => {
      const date = new Date(restaurant.episode_info?.analysis_date || '')
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const cuisine = restaurant.cuisine_type

      if (!cuisine) return

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, new Map())
      }

      const monthData = monthlyData.get(monthKey)!
      monthData.set(cuisine, (monthData.get(cuisine) || 0) + 1)
    })
    
    return Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, cuisines]) => ({
        month,
        cuisines: Object.fromEntries(cuisines.entries())
      }))
  }, [timeframeRestaurants])

  // Load additional trends data from API
  const loadTrendsData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(endpoints.analytics.trends({ period: timeframe }))
      const data = await response.json()
      setTrendsData(data)
    } catch (error) {
      console.error('Failed to load trends data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTrendsData()
  }, [timeframe])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL')
  }

  const getTimeframeLabel = (period: string) => {
    const labels = {
      '1month': 'חודש אחרון',
      '3months': '3 חודשים אחרונים',  
      '6months': '6 חודשים אחרונים',
      '1year': 'שנה אחרונה'
    }
    return labels[period as keyof typeof labels] || period
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="bg-mesh-warm text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-6" />
              טרנדים ואנליטיקה מתקדמת
            </CardTitle>
            <div className="flex gap-2">
              {['1month', '3months', '6months', '1year'].map(period => (
                <Button
                  key={period}
                  variant={timeframe === period ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(period as any)}
                  className={timeframe === period ? "bg-white text-primary" : "border-white text-white hover:bg-white/20"}
                >
                  {getTimeframeLabel(period)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{timeframeRestaurants.length}</div>
              <div className="text-sm text-muted-foreground">מסעדות נותחו</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent-foreground">{trendingRestaurants.length}</div>
              <div className="text-sm text-muted-foreground">מסעדות טרנדיות</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-info">{regionalInsights.length}</div>
              <div className="text-sm text-muted-foreground">אזורים</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">{cuisineTrends.length}</div>
              <div className="text-sm text-muted-foreground">חודשי נתונים</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="trending" className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trending" className="flex items-center gap-2">
                <Star className="size-4" />
                מסעדות טרנדיות
              </TabsTrigger>
              <TabsTrigger value="regional" className="flex items-center gap-2">
                <MapPin className="size-4" />
                תובנות אזוריות
              </TabsTrigger>
              <TabsTrigger value="cuisine" className="flex items-center gap-2">
                <Utensils className="size-4" />
                טרנדי מטבח
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        {/* Trending Restaurants Tab */}
        <TabsContent value="trending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="size-5 text-warning" />
                המסעדות הטרנדיות ביותר
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendingRestaurants.map((trending, index) => (
                  <div
                    key={trending.restaurant.name_hebrew}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-accent/10 to-primary/10 rounded-lg border border-primary/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">#{index + 1}</div>
                        <div className="text-xs text-primary/70">טרנד</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{trending.restaurant.name_hebrew}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{trending.restaurant.cuisine_type}</Badge>
                          <Badge variant="outline">{trending.restaurant.location?.city}</Badge>
                          {trending.avgRating && (
                            <Badge className="bg-success/10 text-success border border-success/20">
                              ⭐ {trending.avgRating.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {trending.restaurant.host_comments?.substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">אזכורים:</span>
                        <Badge className="bg-info text-white">{trending.mentions}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">אחרון:</span>
                        <span className="text-xs text-muted-foreground">{formatDate(trending.lastMentioned)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">ציון טרנד:</span>
                        <Badge className="bg-primary text-primary-foreground">
                          {trending.trendScore.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regional Insights Tab */}
        <TabsContent value="regional" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {regionalInsights.map((region, idx) => (
              <Card key={region.region} className="overflow-hidden">
                <CardHeader className={`${
                  idx % 3 === 0 ? 'bg-mesh-cool' :
                  idx % 3 === 1 ? 'bg-mesh-warm' :
                  'bg-gradient-to-r from-primary to-accent'
                } text-white`}>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="size-5" />
                    {region.region}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">סה"כ מסעדות:</span>
                    <Badge className="bg-muted text-muted-foreground">{region.totalRestaurants}</Badge>
                  </div>

                  {region.avgRating > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">ממוצע דירוג:</span>
                      <Badge className="bg-success text-white">
                        ⭐ {region.avgRating.toFixed(1)}
                      </Badge>
                    </div>
                  )}

                  <div>
                    <h5 className="font-medium mb-2">מטבחים פופולריים:</h5>
                    <div className="space-y-1">
                      {Object.entries(region.cuisineDistribution)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([cuisine, count]) => (
                        <div key={cuisine} className="flex justify-between text-sm">
                          <span>{cuisine}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">חלוקת מחירים:</h5>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(region.priceDistribution).map(([price, count]) => {
                        const priceConfig = {
                          budget: { label: '₪', color: 'bg-success/10 text-success border border-success/20' },
                          'mid-range': { label: '₪₪', color: 'bg-warning/10 text-warning border border-warning/20' },
                          expensive: { label: '₪₪₪', color: 'bg-destructive/10 text-destructive border border-destructive/20' }
                        }
                        const config = priceConfig[price as keyof typeof priceConfig]
                        return config ? (
                          <Badge key={price} className={`${config.color} text-xs`}>
                            {config.label} {count}
                          </Badge>
                        ) : null
                      })}
                    </div>
                  </div>

                  {region.topRestaurants.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2">מסעדות מובילות:</h5>
                      <div className="space-y-1">
                        {region.topRestaurants.map((restaurant, idx) => (
                          <div key={idx} className="text-sm text-foreground/80 flex items-center gap-1">
                            <span className="text-success">•</span>
                            {restaurant.name_hebrew}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Cuisine Trends Tab */}
        <TabsContent value="cuisine" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5 text-info" />
                טרנדי מטבח לאורך זמן
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cuisineTrends.map(monthData => (
                  <div key={monthData.month} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="size-4 text-info" />
                      <h4 className="font-medium">{monthData.month}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(monthData.cuisines)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cuisine, count]) => (
                        <Badge
                          key={cuisine}
                          className="bg-info/10 text-info border border-info/20 cursor-pointer hover:bg-info/20"
                          onClick={() => onRestaurantFilter?.('cuisine', cuisine)}
                        >
                          {cuisine} ({count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {cuisineTrends.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="size-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p>אין נתוני טרנדים זמינים לתקופה זו</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}