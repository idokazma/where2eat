"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Youtube,
  ExternalLink,
} from "lucide-react"
import { endpoints } from "@/lib/config"

interface Episode {
  id: string
  video_id: string
  video_url: string
  channel_id: string
  channel_name: string
  title: string
  analysis_date: string
  created_at: string
  restaurant_count: number
}

interface Restaurant {
  id: string
  name_hebrew: string
  name_english: string
  city: string
  cuisine_type: string
  google_rating: number
  status: string
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export default function VideosTab({ token }: { token: string }) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null)
  const [episodeRestaurants, setEpisodeRestaurants] = useState<
    Record<string, Restaurant[]>
  >({})
  const [loadingRestaurants, setLoadingRestaurants] = useState<string | null>(
    null
  )

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const loadEpisodes = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(currentPage),
        limit: "15",
      }
      if (searchQuery) params.search = searchQuery

      const res = await fetch(endpoints.admin.episodes.list(params), {
        headers: authHeaders,
      })
      const data = await res.json()

      if (data.episodes) setEpisodes(data.episodes)
      if (data.pagination) setPagination(data.pagination)
    } catch (error) {
      console.error("Failed to load episodes:", error)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentPage, searchQuery])

  useEffect(() => {
    loadEpisodes()
  }, [loadEpisodes])

  const loadRestaurants = async (episodeId: string) => {
    if (episodeRestaurants[episodeId]) return
    setLoadingRestaurants(episodeId)
    try {
      const res = await fetch(
        endpoints.admin.episodes.restaurants(episodeId),
        { headers: authHeaders }
      )
      const data = await res.json()
      if (data.restaurants) {
        setEpisodeRestaurants((prev) => ({
          ...prev,
          [episodeId]: data.restaurants,
        }))
      }
    } catch (error) {
      console.error("Failed to load restaurants:", error)
    } finally {
      setLoadingRestaurants(null)
    }
  }

  const toggleExpand = (episodeId: string) => {
    if (expandedEpisode === episodeId) {
      setExpandedEpisode(null)
    } else {
      setExpandedEpisode(episodeId)
      loadRestaurants(episodeId)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    loadEpisodes()
  }

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
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by video title or channel name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Episodes List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Youtube className="size-4 text-red-600" />
              Analyzed Videos
              {pagination && (
                <Badge variant="outline">{pagination.total} total</Badge>
              )}
            </CardTitle>
            <Button
              onClick={loadEpisodes}
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
          {isLoading && episodes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : episodes.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No analyzed videos found
            </p>
          ) : (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <div key={episode.id}>
                  <button
                    onClick={() => toggleExpand(episode.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Youtube className="size-4 text-red-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {episode.title || "Untitled Video"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {episode.channel_name || "Unknown"} ·{" "}
                          {formatDate(episode.analysis_date || episode.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">
                        {episode.restaurant_count} restaurants
                      </Badge>
                      {episode.video_url && (
                        <a
                          href={episode.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                      {expandedEpisode === episode.id ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded: Show restaurants */}
                  {expandedEpisode === episode.id && (
                    <div className="ml-7 mt-1 mb-2 p-3 rounded-lg bg-muted/30 border-l-2 border-primary/20">
                      {loadingRestaurants === episode.id ? (
                        <div className="flex items-center gap-2 py-2">
                          <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Loading restaurants...
                          </span>
                        </div>
                      ) : episodeRestaurants[episode.id]?.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No restaurants found in this video
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {episodeRestaurants[episode.id]?.map((restaurant) => (
                            <div
                              key={restaurant.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <div>
                                <span className="font-medium">
                                  {restaurant.name_hebrew || restaurant.name_english}
                                </span>
                                {restaurant.city && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {restaurant.city}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {restaurant.cuisine_type && (
                                  <Badge variant="outline" className="text-xs">
                                    {restaurant.cuisine_type}
                                  </Badge>
                                )}
                                {restaurant.google_rating > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {restaurant.google_rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.total_pages}
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
                  disabled={currentPage >= pagination.total_pages}
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
