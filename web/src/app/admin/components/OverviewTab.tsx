"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  AlertTriangle,
  Youtube,
} from "lucide-react"
import { endpoints } from "@/lib/config"

interface PipelineOverview {
  queued: number
  processing: number
  completed: number
  failed: number
  skipped: number
  total: number
}

interface PipelineStats {
  status_counts: Record<string, number>
  avg_processing_seconds: number
  completed_last_24h: number
  completed_last_7d: number
  failure_rate_percent: number
  total_items: number
}

interface HistoryItem {
  id: string
  video_title: string
  channel_name: string
  status: string
  restaurants_found: number
  processing_started_at: string
  processing_completed_at: string
  error_message?: string
}

export default function OverviewTab({ token }: { token: string }) {
  const [overview, setOverview] = useState<PipelineOverview | null>(null)
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<HistoryItem[]>([])
  const [restaurantCount, setRestaurantCount] = useState(0)
  const [episodeCount, setEpisodeCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [overviewRes, statsRes, historyRes, restaurantsRes, episodesRes] =
        await Promise.all([
          fetch(endpoints.admin.pipeline.overview(), { headers: authHeaders }),
          fetch(endpoints.admin.pipeline.stats(), { headers: authHeaders }),
          fetch(
            endpoints.admin.pipeline.history({
              page: "1",
              limit: "5",
            }),
            { headers: authHeaders }
          ),
          fetch(endpoints.restaurants.list()),
          fetch(endpoints.admin.episodes.list({ page: "1", limit: "1" }), {
            headers: authHeaders,
          }),
        ])

      const [overviewData, statsData, historyData, restaurantsData, episodesData] =
        await Promise.all([
          overviewRes.json(),
          statsRes.json(),
          historyRes.json(),
          restaurantsRes.json(),
          episodesRes.json(),
        ])

      if (overviewData.overview) setOverview(overviewData.overview)
      if (statsData.stats) setStats(statsData.stats)
      if (historyData.history) setRecentActivity(historyData.history)

      const totalRestaurants =
        restaurantsData.restaurants?.length || restaurantsData.count || 0
      setRestaurantCount(totalRestaurants)

      const totalEpisodes = episodesData.pagination?.total || 0
      setEpisodeCount(totalEpisodes)
    } catch (error) {
      console.error("Failed to load overview:", error)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading && !overview) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top-level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
            <Database className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{restaurantCount}</div>
            <p className="text-xs text-muted-foreground">
              From {episodeCount} videos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.queued || 0}</div>
            <p className="text-xs text-muted-foreground">
              {overview?.processing || 0} processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.completed_last_24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.completed_last_7d || 0} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health</CardTitle>
            {(stats?.failure_rate_percent || 0) > 20 ? (
              <AlertTriangle className="size-4 text-yellow-600" />
            ) : (
              <Activity className="size-4 text-green-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.failure_rate_percent
                ? `${(100 - stats.failure_rate_percent).toFixed(0)}%`
                : "100%"}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {formatDuration(stats?.avg_processing_seconds || 0)} per video
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Status Breakdown */}
      {overview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-yellow-500" />
                <span className="text-sm">
                  Queued: {overview.queued}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm">
                  Processing: {overview.processing}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-green-500" />
                <span className="text-sm">
                  Completed: {overview.completed}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500" />
                <span className="text-sm">
                  Failed: {overview.failed}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-gray-400" />
                <span className="text-sm">
                  Skipped: {overview.skipped}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.status === "completed" ? (
                      <CheckCircle className="size-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="size-4 text-red-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {item.video_title || "Untitled"}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Youtube className="size-3" />
                        {item.channel_name || "Unknown channel"}
                        <span>·</span>
                        {formatDate(item.processing_completed_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "completed" && (
                      <Badge variant="secondary">
                        {item.restaurants_found} restaurants
                      </Badge>
                    )}
                    {item.status === "failed" && (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
