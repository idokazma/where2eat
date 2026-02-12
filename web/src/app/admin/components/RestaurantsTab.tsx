"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Search,
  MapPin,
  Star,
  UtensilsCrossed,
} from "lucide-react"
import { endpoints } from "@/lib/config"

interface Restaurant {
  id: string
  name_hebrew: string
  name_english: string
  city: string
  neighborhood: string
  cuisine_type: string
  google_rating: number
  google_user_ratings_total: number
  status: string
  price_range: string
  created_at: string
  episode_info?: {
    title: string
    video_id: string
    channel_name: string
  }
}

export default function RestaurantsTab() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>(
    []
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const loadRestaurants = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(endpoints.restaurants.list())
      const data = await res.json()
      if (data.restaurants) {
        setRestaurants(data.restaurants)
        setFilteredRestaurants(data.restaurants)
      }
    } catch (error) {
      console.error("Failed to load restaurants:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRestaurants()
  }, [loadRestaurants])

  useEffect(() => {
    if (!searchQuery) {
      setFilteredRestaurants(restaurants)
      setCurrentPage(1)
      return
    }
    const q = searchQuery.toLowerCase()
    const filtered = restaurants.filter(
      (r) =>
        r.name_hebrew?.toLowerCase().includes(q) ||
        r.name_english?.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.cuisine_type?.toLowerCase().includes(q)
    )
    setFilteredRestaurants(filtered)
    setCurrentPage(1)
  }, [searchQuery, restaurants])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRestaurants.length / itemsPerPage)
  )
  const paginatedRestaurants = filteredRestaurants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, city, or cuisine..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Restaurant List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <UtensilsCrossed className="size-4" />
              All Restaurants
              <Badge variant="outline">
                {filteredRestaurants.length} total
              </Badge>
            </CardTitle>
            <Button
              onClick={loadRestaurants}
              variant="ghost"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedRestaurants.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No restaurants match your search"
                : "No restaurants found"}
            </p>
          ) : (
            <div className="space-y-2">
              {paginatedRestaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">
                      {restaurant.name_hebrew || restaurant.name_english}
                      {restaurant.name_hebrew && restaurant.name_english && (
                        <span className="text-muted-foreground font-normal ml-2">
                          ({restaurant.name_english})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {restaurant.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {restaurant.city}
                          {restaurant.neighborhood &&
                            `, ${restaurant.neighborhood}`}
                        </span>
                      )}
                      {restaurant.episode_info?.channel_name && (
                        <>
                          <span>·</span>
                          <span>
                            via {restaurant.episode_info.channel_name}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDate(restaurant.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {restaurant.cuisine_type && (
                      <Badge variant="outline" className="text-xs">
                        {restaurant.cuisine_type}
                      </Badge>
                    )}
                    {restaurant.google_rating > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        {restaurant.google_rating.toFixed(1)}
                      </span>
                    )}
                    {restaurant.price_range && (
                      <span className="text-xs text-muted-foreground">
                        {restaurant.price_range}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({filteredRestaurants.length}{" "}
                restaurants)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
