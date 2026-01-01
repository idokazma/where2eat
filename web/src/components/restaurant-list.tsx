"use client"

import { Restaurant } from "@/types/restaurant"
import { RestaurantCard } from "./restaurant-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Filter, Utensils, Award } from "lucide-react"
import { useState, useMemo } from "react"

interface RestaurantListProps {
  restaurants: Restaurant[]
}

export function RestaurantList({ restaurants }: RestaurantListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCuisine, setSelectedCuisine] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")

  const cuisineTypes = useMemo(() => {
    const types = Array.from(new Set(restaurants.map(r => r.cuisine_type)))
    return types.sort()
  }, [restaurants])

  const statusTypes = useMemo(() => {
    const types = Array.from(new Set(restaurants.map(r => r.status)))
    return types.sort()
  }, [restaurants])

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(restaurant => {
      const matchesSearch = searchTerm === "" || 
        restaurant.name_hebrew.includes(searchTerm) ||
        (restaurant.name_english?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        restaurant.location.city?.includes(searchTerm) ||
        restaurant.location.neighborhood?.includes(searchTerm) ||
        restaurant.host_comments.includes(searchTerm)

      const matchesCuisine = selectedCuisine === "all" || restaurant.cuisine_type === selectedCuisine
      const matchesStatus = selectedStatus === "all" || restaurant.status === selectedStatus

      return matchesSearch && matchesCuisine && matchesStatus
    })
  }, [restaurants, searchTerm, selectedCuisine, selectedStatus])

  const groupedByOpinion = useMemo(() => {
    return {
      positive: filteredRestaurants.filter(r => r.host_opinion === 'positive'),
      mixed: filteredRestaurants.filter(r => r.host_opinion === 'mixed'),
      neutral: filteredRestaurants.filter(r => r.host_opinion === 'neutral'),
      negative: filteredRestaurants.filter(r => r.host_opinion === 'negative'),
    }
  }, [filteredRestaurants])

  return (
    <div className="space-y-8">
      {/* Enhanced Search and Filters */}
      <div className="bg-white rounded-2xl p-6 border-2 border-orange-100 shadow-lg space-y-6">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
            <Search className="size-6 text-orange-500" />
            חיפוש וסינון מסעדות
          </h2>
          <p className="text-gray-600 mt-1">מצאו את המסעדה המושלמת עבורכם</p>
        </div>
        
        <div className="relative">
          <Search className="absolute right-4 top-4 size-5 text-orange-400" />
          <Input
            placeholder="חפשו לפי שם מסעדה, מיקום או סוג מטבח..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-12 text-right text-lg py-6 border-2 border-orange-200 focus:border-orange-400 rounded-xl bg-orange-50/30"
          />
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Utensils className="size-5 text-orange-500" />
              <h3 className="font-semibold text-gray-700">סוג מטבח</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedCuisine === "all" ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  selectedCuisine === "all" 
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600" 
                    : "hover:bg-orange-100 border-orange-200"
                }`}
                onClick={() => setSelectedCuisine("all")}
              >
                הכל
              </Badge>
              {cuisineTypes.map(cuisine => (
                <Badge
                  key={cuisine}
                  variant={selectedCuisine === cuisine ? "default" : "outline"}
                  className={`cursor-pointer transition-all ${
                    selectedCuisine === cuisine 
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600" 
                      : "hover:bg-orange-100 border-orange-200"
                  }`}
                  onClick={() => setSelectedCuisine(cuisine)}
                >
                  {cuisine}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="size-5 text-orange-500" />
              <h3 className="font-semibold text-gray-700">סטטוס מסעדה</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedStatus === "all" ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  selectedStatus === "all" 
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600" 
                    : "hover:bg-orange-100 border-orange-200"
                }`}
                onClick={() => setSelectedStatus("all")}
              >
                כל הסטטוסים
              </Badge>
              {statusTypes.map(status => (
                <Badge
                  key={status}
                  variant={selectedStatus === status ? "default" : "outline"}
                  className={`cursor-pointer transition-all ${
                    selectedStatus === status 
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600" 
                      : "hover:bg-orange-100 border-orange-200"
                  }`}
                  onClick={() => setSelectedStatus(status)}
                >
                  {status.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Results Summary */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Search className="size-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800">תוצאות החיפוש</h3>
              <p className="text-green-600">
                נמצאו {filteredRestaurants.length} מסעדות מתוך {restaurants.length} במערכת
              </p>
            </div>
          </div>
          {(selectedCuisine !== "all" || selectedStatus !== "all" || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCuisine("all");
                setSelectedStatus("all");
                setSearchTerm("");
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              נקה סינונים
            </button>
          )}
        </div>
      </div>

      {/* Enhanced Restaurant Tabs by Opinion */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 bg-white/50 backdrop-blur-sm border-2 border-orange-100 rounded-2xl p-1 h-auto opinion-tabs">
          <TabsTrigger 
            value="all"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-600 data-[state=active]:to-gray-700 data-[state=active]:text-white rounded-xl font-medium py-3"
          >
            הכל ({filteredRestaurants.length})
          </TabsTrigger>
          <TabsTrigger 
            value="positive"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white rounded-xl font-medium py-3"
          >
            👍 מומלצות ({groupedByOpinion.positive.length})
          </TabsTrigger>
          <TabsTrigger 
            value="mixed"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-xl font-medium py-3"
          >
            🤔 מעורבות ({groupedByOpinion.mixed.length})
          </TabsTrigger>
          <TabsTrigger 
            value="neutral"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-xl font-medium py-3"
          >
            😐 ניטרלי ({groupedByOpinion.neutral.length})
          </TabsTrigger>
          <TabsTrigger 
            value="negative"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-500 data-[state=active]:text-white rounded-xl font-medium py-3"
          >
            👎 לא מומלצות ({groupedByOpinion.negative.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredRestaurants.map((restaurant, index) => (
            <RestaurantCard key={index} restaurant={restaurant} />
          ))}
        </TabsContent>

        <TabsContent value="positive" className="space-y-4">
          {groupedByOpinion.positive.map((restaurant, index) => (
            <RestaurantCard key={index} restaurant={restaurant} />
          ))}
        </TabsContent>

        <TabsContent value="mixed" className="space-y-4">
          {groupedByOpinion.mixed.map((restaurant, index) => (
            <RestaurantCard key={index} restaurant={restaurant} />
          ))}
        </TabsContent>

        <TabsContent value="neutral" className="space-y-4">
          {groupedByOpinion.neutral.map((restaurant, index) => (
            <RestaurantCard key={index} restaurant={restaurant} />
          ))}
        </TabsContent>

        <TabsContent value="negative" className="space-y-4">
          {groupedByOpinion.negative.map((restaurant, index) => (
            <RestaurantCard key={index} restaurant={restaurant} />
          ))}
        </TabsContent>
      </Tabs>

      {filteredRestaurants.length === 0 && (
        <div className="text-center py-16">
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 max-w-md mx-auto">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              לא נמצאו תוצאות
            </h3>
            <p className="text-gray-500 mb-4">
              לא נמצאו מסעדות המתאימות לקריטריונים שנבחרו
            </p>
            <button
              onClick={() => {
                setSelectedCuisine("all");
                setSelectedStatus("all");
                setSearchTerm("");
              }}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              נקה את כל המסננים
            </button>
          </div>
        </div>
      )}
    </div>
  )
}