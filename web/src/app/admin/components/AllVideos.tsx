"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
} from "lucide-react"
import { endpoints } from "@/lib/config"

interface VideoItem {
  id: string
  video_id: string
  video_url: string
  video_title: string
  channel_name: string
  published_at: string
  status: string
  restaurants_found: number
  processing_started_at: string
  processing_completed_at: string
  error_message: string
}

interface Restaurant {
  id: string
  name_hebrew: string
  name_english: string
  city: string
  cuisine_type: string
  google_rating: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface AllVideosProps {
  token: string
}

const STATUS_OPTIONS = ["all", "queued", "processing", "completed", "failed", "skipped"] as const
type StatusFilter = (typeof STATUS_OPTIONS)[number]

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-500",
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "—"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDuration(startedAt: string, completedAt: string): string {
  if (!startedAt || !completedAt) return "—"
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const secs = Math.floor((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

export default function AllVideos({ token }: AllVideosProps) {
  const [items, setItems] = useState<VideoItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [draftSearch, setDraftSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [restaurantCache, setRestaurantCache] = useState<
    Record<string, Restaurant[]>
  >({})
  const [loadingRestaurantsFor, setLoadingRestaurantsFor] = useState<
    string | null
  >(null)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const loadVideos = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(currentPage),
        limit: "20",
      }
      if (statusFilter !== "all") params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const res = await fetch(
        endpoints.admin.pipeline.allVideos(params),
        { headers: authHeaders }
      )
      const data = await res.json()

      if (data.videos) setItems(data.videos)
      if (data.pagination) setPagination(data.pagination)
      if (data.status_summary) setStatusSummary(data.status_summary)
    } catch (error) {
      console.error("Failed to load videos:", error)
    } finally {
      setIsLoading(false)
    }
  }, [token, currentPage, statusFilter, searchQuery])

  useEffect(() => {
    loadVideos()
    const interval = setInterval(loadVideos, 15000)
    return () => clearInterval(interval)
  }, [loadVideos])

  const loadRestaurantsForItem = async (item: VideoItem) => {
    if (restaurantCache[item.id]) return
    if (!item.video_id) return

    setLoadingRestaurantsFor(item.id)
    try {
      const episodesRes = await fetch(
        endpoints.admin.episodes.list({ search: item.video_id, limit: "5", page: "1" }),
        { headers: authHeaders }
      )
      const episodesData = await episodesRes.json()
      const episode = episodesData.episodes?.find(
        (ep: { video_id: string }) => ep.video_id === item.video_id
      )

      if (episode) {
        const restaurantsRes = await fetch(
          endpoints.admin.episodes.restaurants(episode.id),
          { headers: authHeaders }
        )
        const restaurantsData = await restaurantsRes.json()
        setRestaurantCache((prev) => ({
          ...prev,
          [item.id]: restaurantsData.restaurants ?? [],
        }))
      } else {
        setRestaurantCache((prev) => ({ ...prev, [item.id]: [] }))
      }
    } catch (error) {
      console.error("Failed to load restaurants for item:", error)
      setRestaurantCache((prev) => ({ ...prev, [item.id]: [] }))
    } finally {
      setLoadingRestaurantsFor(null)
    }
  }

  const toggleExpand = (item: VideoItem) => {
    if (expandedId === item.id) {
      setExpandedId(null)
    } else {
      setExpandedId(item.id)
      loadRestaurantsForItem(item)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    setSearchQuery(draftSearch)
  }

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const totalAll = Object.values(statusSummary).reduce((a, b) => a + b, 0)

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          All Videos
          {pagination && (
            <span className="ml-2 text-foreground font-bold">
              {pagination.total}
            </span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadVideos}
          className="h-6 w-6 p-0"
          title="Refresh"
          disabled={isLoading}
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search title or channel..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="h-7 px-2 text-xs">
          Search
        </Button>
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setDraftSearch("")
              setSearchQuery("")
              setCurrentPage(1)
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {STATUS_OPTIONS.map((s) => {
          const count = s === "all" ? totalAll : (statusSummary[s] ?? 0)
          const isActive = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className={`tabular-nums ${isActive ? "opacity-80" : "opacity-60"}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border rounded-md">
          {searchQuery || statusFilter !== "all"
            ? "No results for that filter"
            : "No videos yet"}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                  Title
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden md:table-cell">
                  Channel
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden sm:table-cell w-20">
                  Published
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-20">
                  Status
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-16">
                  Rest.
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <Fragment key={item.id}>
                  <tr
                    className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                      idx % 2 === 0 ? "" : "bg-muted/10"
                    } ${expandedId === item.id ? "bg-muted/20" : ""}`}
                    onClick={() => toggleExpand(item)}
                  >
                    <td className="px-2 py-1.5 max-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">
                          {item.video_title || item.video_id || "Untitled"}
                        </span>
                        {item.video_url && (
                          <a
                            href={item.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            title="View on YouTube"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                      {item.channel_name || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {formatRelativeTime(item.published_at)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`font-semibold tabular-nums ${
                          item.restaurants_found > 0
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.restaurants_found ?? 0}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {expandedId === item.id ? (
                        <ChevronUp className="size-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === item.id && (
                    <tr className="border-b bg-muted/10">
                      <td colSpan={6} className="px-4 py-2">
                        {/* Video metadata */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mb-2">
                          <div>
                            <span className="text-muted-foreground">Published: </span>
                            <span>{item.published_at ? new Date(item.published_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Analyzed: </span>
                            <span>{item.processing_completed_at ? formatRelativeTime(item.processing_completed_at) : "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Duration: </span>
                            <span>{formatDuration(item.processing_started_at, item.processing_completed_at)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status: </span>
                            <span className={`font-medium ${STATUS_COLORS[item.status]?.split(" ")[1] ?? ""}`}>
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {/* Error message if failed */}
                        {item.error_message && (
                          <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                            {item.error_message}
                          </div>
                        )}

                        {/* Restaurants sub-table */}
                        {item.status === "completed" && (
                          <>
                            {loadingRestaurantsFor === item.id ? (
                              <div className="flex items-center gap-2 py-2">
                                <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Loading restaurants...
                                </span>
                              </div>
                            ) : (restaurantCache[item.id]?.length ?? 0) === 0 ? (
                              <p className="text-xs text-muted-foreground py-1">
                                No restaurants found for this video
                              </p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left pb-1 pr-3 font-medium">
                                      Name
                                    </th>
                                    <th className="text-left pb-1 pr-3 font-medium hidden sm:table-cell">
                                      City
                                    </th>
                                    <th className="text-left pb-1 pr-3 font-medium hidden md:table-cell">
                                      Cuisine
                                    </th>
                                    <th className="text-left pb-1 font-medium w-12">
                                      Rating
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {restaurantCache[item.id].map((r) => (
                                    <tr
                                      key={r.id}
                                      className="border-t border-border/40"
                                    >
                                      <td className="py-1 pr-3 font-medium">
                                        {r.name_hebrew || r.name_english || "—"}
                                        {r.name_hebrew && r.name_english && (
                                          <span className="text-muted-foreground font-normal ml-1">
                                            ({r.name_english})
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1 pr-3 text-muted-foreground hidden sm:table-cell">
                                        {r.city || "—"}
                                      </td>
                                      <td className="py-1 pr-3 text-muted-foreground hidden md:table-cell">
                                        {r.cuisine_type || "—"}
                                      </td>
                                      <td className="py-1">
                                        {r.google_rating > 0 ? (
                                          <span className="flex items-center gap-0.5 text-muted-foreground">
                                            <Star className="size-3 fill-yellow-400 text-yellow-400" />
                                            {r.google_rating.toFixed(1)}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between mt-2 pt-2">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={currentPage >= pagination.total_pages || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
