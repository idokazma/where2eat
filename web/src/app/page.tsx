"use client"

import { RestaurantList } from "@/components/restaurant-list"
import { YoutubeAnalyzer } from "@/components/youtube-analyzer"
import { RestaurantMap } from "@/components/restaurant-map"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Restaurant } from "@/types/restaurant"
import { useEffect, useState } from "react"
import { Utensils, TrendingUp, Users, MapPin, Map } from "lucide-react"
import { useFavorites } from "@/contexts/favorites-context"

interface ApiResponse {
  restaurants: Restaurant[]
  count: number
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { setAllRestaurants } = useFavorites()

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/restaurants')
        if (!response.ok) {
          throw new Error('Failed to fetch restaurants')
        }
        const data: ApiResponse = await response.json()
        setRestaurants(data.restaurants)
        setAllRestaurants(data.restaurants)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load restaurants')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRestaurants()
  }, [])

  const foodTrends = Array.from(new Set(restaurants.flatMap(r => 
    [r.cuisine_type, ...(r.special_features || [])]
  ))).filter(Boolean)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-16 max-w-6xl hero-padding">
          <div className="text-center space-y-6 text-white">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Utensils className="size-8 sm:size-12" />
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">Where2Eat</h1>
            </div>
            <p className="text-2xl font-medium opacity-95">
              גלו מסעדות מומלצות מפודקאסטים של גורמי
            </p>
            <p className="text-lg opacity-80 max-w-2xl mx-auto">
              המערכת המתקדמת שמנתחת פודקאסטים על אוכל ומביאה לכם את המסעדות הכי מומלצות בארץ
            </p>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto hero-stats">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <Utensils className="size-8 text-orange-200" />
                  <span className="text-3xl font-bold">{restaurants.length}</span>
                </div>
                <p className="text-orange-100">מסעדות מנותחות</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="size-8 text-orange-200" />
                  <span className="text-3xl font-bold">{foodTrends.length}</span>
                </div>
                <p className="text-orange-100">טרנדים במזון</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="size-8 text-orange-200" />
                  <span className="text-3xl font-bold">100+</span>
                </div>
                <p className="text-orange-100">המלצות מומחים</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="space-y-8">

        {isLoading ? (
          <div className="text-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
              <Utensils className="size-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-orange-500" />
            </div>
            <div className="mt-6 space-y-2">
              <p className="text-xl font-medium">טוען מסעדות מיוחדות...</p>
              <p className="text-muted-foreground">מחפש את המקומות הכי מומלצים עבורכם</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md mx-auto">
              <div className="text-red-500 text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-semibold text-red-800 mb-2">אופס! משהו לא עבד</h3>
              <p className="text-red-600">שגיאה בטעינת המסעדות: {error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                נסה שוב
              </button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="restaurants" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/50 backdrop-blur-sm border border-orange-100 rounded-2xl p-1">
              <TabsTrigger 
                value="restaurants"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-xl font-medium"
              >
                <Utensils className="size-4 ml-2" />
                רשימת מסעדות ({restaurants.length})
              </TabsTrigger>
              <TabsTrigger 
                value="map"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white rounded-xl font-medium"
              >
                <Map className="size-4 ml-2" />
                מפת מסעדות
              </TabsTrigger>
              <TabsTrigger 
                value="analyze"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-xl font-medium"
              >
                <TrendingUp className="size-4 ml-2" />
                נתח סרטון YouTube
              </TabsTrigger>
            </TabsList>

          <TabsContent value="restaurants" className="space-y-6">
            {restaurants.length > 0 ? (
              <>
                <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl">
                          <Utensils className="size-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">מסעדות מיוחדות שנמצאו</CardTitle>
                          <p className="text-lg font-medium text-orange-700 mt-1">
                            {restaurants.length} מסעדות מומלצות מפודקאסטים
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <p className="text-base text-right leading-relaxed">
                        מסעדות שזוהו וניתחו ממומחי אוכל ופודקאסטים מובילים בארץ
                      </p>
                      {foodTrends.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="size-5 text-orange-600" />
                            <h4 className="font-semibold text-orange-800">טרנדים במזון</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {foodTrends.slice(0, 10).map((trend, index) => (
                              <Badge 
                                key={index} 
                                variant="secondary"
                                className="bg-white/60 text-orange-800 border-orange-200 hover:bg-orange-100 transition-colors cursor-default"
                              >
                                {trend}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <RestaurantList restaurants={restaurants} />
              </>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-dashed border-orange-200 rounded-3xl p-12 max-w-lg mx-auto">
                  <div className="text-8xl mb-6">🍽️</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">
                    עדיין לא נמצאו מסעדות
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    התחילו לגלות מסעדות מדהימות! נתחו פודקאסט על אוכל וגלו המלצות חמות ממומחים
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-orange-100 mb-6">
                    <div className="flex items-center gap-3 text-right">
                      <TrendingUp className="size-5 text-orange-500" />
                      <span className="text-sm font-medium">
                        עברו לכרטיסיית "נתח סרטון YouTube" למעלה
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const analyzeTab = document.querySelector('[value="analyze"]') as HTMLElement;
                      analyzeTab?.click();
                    }}
                    className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all transform hover:scale-105"
                  >
                    התחל לנתח עכשיו
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-6">
            {restaurants.length > 0 ? (
              <RestaurantMap 
                restaurants={restaurants}
                onRestaurantSelect={(restaurant) => {
                  console.log('Selected restaurant:', restaurant.name_hebrew)
                }}
              />
            ) : (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-dashed border-green-200 rounded-3xl p-12 max-w-lg mx-auto">
                  <div className="text-8xl mb-6">🗺️</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">
                    אין מסעדות להצגה על המפה
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    כשיהיו מסעדות במערכת, תוכלו לראות אותן על מפת Google Maps עם פרטי מיקום מדויקים
                  </p>
                  <div className="bg-white rounded-xl p-4 border border-green-100 mb-6">
                    <div className="flex items-center gap-3 text-right">
                      <TrendingUp className="size-5 text-green-500" />
                      <span className="text-sm font-medium">
                        התחילו עם ניתוח פודקאסט כדי לגלות מסעדות
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const analyzeTab = document.querySelector('[value="analyze"]') as HTMLElement;
                      analyzeTab?.click();
                    }}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105"
                  >
                    נתח פודקאסט עכשיו
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

            <TabsContent value="analyze" className="space-y-6">
              <YoutubeAnalyzer />
            </TabsContent>
          </Tabs>
        )}
        </div>
      </div>
    </div>
  )
}