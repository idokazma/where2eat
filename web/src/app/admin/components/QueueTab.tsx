"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Play,
  SkipForward,
  Trash2,
  RotateCcw,
  Clock,
  AlertTriangle,
  Youtube,
  ExternalLink,
  Zap,
  XCircle,
  CheckCircle,
} from "lucide-react"
import { endpoints } from "@/lib/config"

interface QueueItem {
  id: string
  video_id: string
  video_url: string
  video_title: string
  channel_name: string
  status: string
  priority: number
  attempt_count: number
  max_attempts: number
  scheduled_for: string
  discovered_at: string
  processing_started_at: string
  processing_completed_at: string
  restaurants_found: number
  error_message: string
  subscription_id: string
}

interface PipelineOverview {
  queued: number
  processing: number
  completed: number
  failed: number
  skipped: number
  total: number
}

export default function QueueTab({ token }: { token: string }) {
  const [overview, setOverview] = useState<PipelineOverview | null>(null)
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [failedItems, setFailedItems] = useState<QueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [overviewRes, queueRes, historyRes] = await Promise.all([
        fetch(endpoints.admin.pipeline.overview(), { headers: authHeaders }),
        fetch(endpoints.admin.pipeline.queue({ page: "1", limit: "50" }), {
          headers: authHeaders,
        }),
        fetch(
          endpoints.admin.pipeline.history({ page: "1", limit: "20" }),
          { headers: authHeaders }
        ),
      ])

      const [overviewData, queueData, historyData] = await Promise.all([
        overviewRes.json(),
        queueRes.json(),
        historyRes.json(),
      ])

      if (overviewData.overview) setOverview(overviewData.overview)
      if (queueData.queue) setQueueItems(queueData.queue)
      if (historyData.history) {
        setFailedItems(
          historyData.history.filter(
            (item: QueueItem) => item.status === "failed"
          )
        )
      }
    } catch (error) {
      console.error("Failed to load queue data:", error)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleAction = async (
    id: string,
    action: "prioritize" | "skip" | "retry" | "remove"
  ) => {
    setActionLoading(`${id}-${action}`)
    try {
      const urlMap = {
        prioritize: endpoints.admin.pipeline.prioritize(id),
        skip: endpoints.admin.pipeline.skip(id),
        retry: endpoints.admin.pipeline.retry(id),
        remove: endpoints.admin.pipeline.remove(id),
      }
      const methodMap = {
        prioritize: "POST",
        skip: "POST",
        retry: "POST",
        remove: "DELETE",
      }

      await fetch(urlMap[action], {
        method: methodMap[action],
        headers: authHeaders,
      })
      await loadData()
    } catch (error) {
      console.error(`Failed to ${action}:`, error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAnalyzeVideo = async () => {
    if (!youtubeUrl) return
    setIsAnalyzing(true)
    try {
      const response = await fetch(endpoints.analyze.video(), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: youtubeUrl }),
      })

      if (response.ok) {
        setYoutubeUrl("")
        await loadData()
      } else {
        const data = await response.json()
        alert(data.error || data.detail || "Failed to start analysis")
      }
    } catch (error) {
      console.error("Error analyzing video:", error)
      alert("Failed to connect to server")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return "—"
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMins = Math.round(diffMs / 60000)

    if (diffMins < 0) return "overdue"
    if (diffMins < 60) return `in ${diffMins}m`
    if (diffMins < 1440) return `in ${Math.round(diffMins / 60)}h`
    return `in ${Math.round(diffMins / 1440)}d`
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
      {/* Queue Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Queued</span>
              </div>
              <div className="text-2xl font-bold mt-1">{overview.queued}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-4 text-blue-600 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Processing
                </span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {overview.processing}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600" />
                <span className="text-sm text-muted-foreground">
                  Completed
                </span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {overview.completed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-red-600" />
                <span className="text-sm text-muted-foreground">Failed</span>
              </div>
              <div className="text-2xl font-bold mt-1">{overview.failed}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analyze Video */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Youtube className="size-4 text-red-600" />
            Analyze YouTube Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter YouTube URL..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAnalyzeVideo}
              disabled={!youtubeUrl || isAnalyzing}
            >
              {isAnalyzing ? (
                <RefreshCw className="size-4 mr-2 animate-spin" />
              ) : (
                <Play className="size-4 mr-2" />
              )}
              {isAnalyzing ? "Starting..." : "Analyze"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4" />
              Pending Videos
              {queueItems.length > 0 && (
                <Badge variant="outline">{queueItems.length}</Badge>
              )}
            </CardTitle>
            <Button
              onClick={loadData}
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
          {queueItems.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              No videos in queue
            </p>
          ) : (
            <div className="space-y-2">
              {queueItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {item.video_title || item.video_id || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{item.channel_name || "Unknown"}</span>
                      <span>·</span>
                      <span>
                        Priority: {item.priority}
                      </span>
                      {item.scheduled_for && (
                        <>
                          <span>·</span>
                          <span>
                            Scheduled: {formatRelativeTime(item.scheduled_for)}
                          </span>
                        </>
                      )}
                      {item.attempt_count > 0 && (
                        <>
                          <span>·</span>
                          <span>
                            Attempt {item.attempt_count}/{item.max_attempts}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {item.video_url && (
                      <a
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-muted"
                        title="View on YouTube"
                      >
                        <ExternalLink className="size-4 text-muted-foreground" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(item.id, "prioritize")}
                      disabled={actionLoading === `${item.id}-prioritize`}
                      title="Analyze now (move to front of queue)"
                      className="h-8 px-2"
                    >
                      {actionLoading === `${item.id}-prioritize` ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Zap className="size-4 text-yellow-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(item.id, "skip")}
                      disabled={actionLoading === `${item.id}-skip`}
                      title="Skip this video"
                      className="h-8 px-2"
                    >
                      {actionLoading === `${item.id}-skip` ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <SkipForward className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(item.id, "remove")}
                      disabled={actionLoading === `${item.id}-remove`}
                      title="Remove from queue"
                      className="h-8 px-2 text-red-600 hover:text-red-700"
                    >
                      {actionLoading === `${item.id}-remove` ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Videos */}
      {failedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-red-600" />
              Failed Videos
              <Badge variant="destructive">{failedItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {item.video_title || item.video_id || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {item.channel_name || "Unknown"} · Attempt{" "}
                      {item.attempt_count}/{item.max_attempts}
                    </div>
                    {item.error_message && (
                      <div className="text-xs text-red-600 mt-1 truncate">
                        {item.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(item.id, "retry")}
                      disabled={actionLoading === `${item.id}-retry`}
                      title="Retry this video"
                      className="h-8 px-2"
                    >
                      {actionLoading === `${item.id}-retry` ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(item.id, "remove")}
                      disabled={actionLoading === `${item.id}-remove`}
                      title="Remove from queue"
                      className="h-8 px-2 text-red-600 hover:text-red-700"
                    >
                      {actionLoading === `${item.id}-remove` ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
