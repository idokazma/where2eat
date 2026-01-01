"use client"

import { Restaurant } from "@/types/restaurant"
import { RestaurantCard } from "./restaurant-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Filter } from "lucide-react"
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
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-3 size-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש מסעדות..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 text-right"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="size-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={selectedCuisine === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCuisine("all")}
            >
              הכל
            </Badge>
            {cuisineTypes.map(cuisine => (
              <Badge
                key={cuisine}
                variant={selectedCuisine === cuisine ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCuisine(cuisine)}
              >
                {cuisine}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge
            variant={selectedStatus === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedStatus("all")}
          >
            כל הסטטוסים
          </Badge>
          {statusTypes.map(status => (
            <Badge
              key={status}
              variant={selectedStatus === status ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedStatus(status)}
            >
              {status.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground text-right">
        מציג {filteredRestaurants.length} מסעדות מתוך {restaurants.length}
      </div>

      {/* Restaurant Tabs by Opinion */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            הכל ({filteredRestaurants.length})
          </TabsTrigger>
          <TabsTrigger value="positive">
            👍 מומלצות ({groupedByOpinion.positive.length})
          </TabsTrigger>
          <TabsTrigger value="mixed">
            🤔 מעורבות ({groupedByOpinion.mixed.length})
          </TabsTrigger>
          <TabsTrigger value="neutral">
            😐 ניטרלי ({groupedByOpinion.neutral.length})
          </TabsTrigger>
          <TabsTrigger value="negative">
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
        <div className="text-center text-muted-foreground py-8">
          לא נמצאו מסעדות המתאימות לקריטריונים שנבחרו
        </div>
      )}
    </div>
  )
}