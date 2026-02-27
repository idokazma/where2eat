"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  RefreshCw,
  Play,
  SkipForward,
  Trash2,
  RotateCcw,
  ExternalLink,
  Zap,
  AlertTriangle,
  Youtube,
  Timer,
} from "lucide-react"
import { endpoints } from "@/lib/config"

export interface QueueItem {
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

interface PipelineViewProps {
  token: string
  onDataLoad?: (items: QueueItem[]) => void
}

type Action = "prioritize" | "skip" | "retry" | "remove"

const ACTION_METHOD: Record<Action, string> = {
  prioritize: "POST",
  skip: "POST",
  retry: "POST",
  remove: "DELETE",
}

function priorityDotClass(priority: number): string {
  if (priority >= 5) return "bg-red-500"
  if (priority >= 4) return "bg-orange-500"
  if (priority >= 3) return "bg-yellow-500"
  if (priority >= 2) return "bg-blue-400"
  return "bg-gray-400"
}

function formatRelativeScheduled(dateStr: string): string {
  if (!dateStr) return "—"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < -1440) return `${Math.round(Math.abs(diffMins) / 1440)}d ago`
  if (diffMins < -60) return `${Math.round(Math.abs(diffMins) / 60)}h ago`
  if (diffMins < 0) return "overdue"
  if (diffMins < 60) return `${diffMins}m`
  if (diffMins < 1440) return `${Math.round(diffMins / 60)}h`
  return `${Math.round(diffMins / 1440)}d`
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    function tick() {
      if (!startedAt) {
        setElapsed("—")
        return
      }
      const start = new Date(startedAt).getTime()
      const secs = Math.floor((Date.now() - start) / 1000)
      if (secs < 60) setElapsed(`${secs}s`)
      else if (secs < 3600)
        setElapsed(`${Math.floor(secs / 60)}m ${secs % 60}s`)
      else
        setElapsed(
          `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
        )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return <span className="font-mono text-blue-600 font-semibold">{elapsed}</span>
}

interface ActionButtonProps {
  itemId: string
  action: Action
  actionLoading: string | null
  onAction: (id: string, action: Action) => void
  title: string
  icon: React.ReactNode
  className?: string
}

function ActionButton({
  itemId,
  action,
  actionLoading,
  onAction,
  title,
  icon,
  className = "",
}: ActionButtonProps) {
  const key = `${itemId}-${action}`
  const isLoading = actionLoading === key
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onAction(itemId, action)}
      disabled={isLoading || actionLoading !== null}
      title={title}
      className={`h-7 w-7 p-0 ${className}`}
    >
      {isLoading ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : (
        icon
      )}
    </Button>
  )
}

export default function PipelineView({ token, onDataLoad }: PipelineViewProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [failedItems, setFailedItems] = useState<QueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState("")
  const [analyzeSuccess, setAnalyzeSuccess] = useState(false)
  const onDataLoadRef = useRef(onDataLoad)

  useEffect(() => {
    onDataLoadRef.current = onDataLoad
  }, [onDataLoad])

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const loadData = useCallback(async () => {
    try {
      const [queueRes, historyRes] = await Promise.all([
        fetch(endpoints.admin.pipeline.queue({ page: "1", limit: "100" }), {
          headers: authHeaders,
        }),
        fetch(
          endpoints.admin.pipeline.history({ page: "1", limit: "50" }),
          { headers: authHeaders }
        ),
      ])

      const [queueData, historyData] = await Promise.all([
        queueRes.json(),
        historyRes.json(),
      ])

      if (queueData.queue) {
        setQueueItems(queueData.queue)
        onDataLoadRef.current?.(queueData.queue)
      }
      if (historyData.history) {
        setFailedItems(
          historyData.history.filter(
            (item: QueueItem) => item.status === "failed"
          )
        )
      }
    } catch (error) {
      console.error("Failed to load pipeline data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [token]) // authHeaders is derived from token

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleAction = useCallback(
    async (id: string, action: Action) => {
      const key = `${id}-${action}`
      setActionLoading(key)
      try {
        const urlMap: Record<Action, string> = {
          prioritize: endpoints.admin.pipeline.prioritize(id),
          skip: endpoints.admin.pipeline.skip(id),
          retry: endpoints.admin.pipeline.retry(id),
          remove: endpoints.admin.pipeline.remove(id),
        }
        await fetch(urlMap[action], {
          method: ACTION_METHOD[action],
          headers: authHeaders,
        })
        await loadData()
      } catch (error) {
        console.error(`Failed to ${action}:`, error)
      } finally {
        setActionLoading(null)
      }
    },
    [token, loadData] // authHeaders derived from token
  )

  const handleAnalyzeVideo = async () => {
    if (!youtubeUrl.trim()) return
    setIsAnalyzing(true)
    setAnalyzeError("")
    setAnalyzeSuccess(false)
    try {
      const response = await fetch(endpoints.analyze.video(), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      })
      if (response.ok) {
        setYoutubeUrl("")
        setAnalyzeSuccess(true)
        setTimeout(() => setAnalyzeSuccess(false), 3000)
        await loadData()
      } else {
        const data = await response.json()
        setAnalyzeError(
          data.error || data.detail || "Failed to start analysis"
        )
      }
    } catch {
      setAnalyzeError("Failed to connect to server")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAnalyzeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAnalyzeVideo()
  }

  const processingItems = queueItems.filter(
    (item) => item.status === "processing"
  )
  const pendingItems = queueItems.filter((item) => item.status === "queued")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Now Processing */}
      {processingItems.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Now Processing
          </h2>
          <div className="space-y-1.5">
            {processingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-l-2 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 rounded-r-md px-3 py-2"
              >
                <RefreshCw className="size-4 text-blue-500 animate-spin shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate leading-tight">
                    {item.video_title || item.video_id || "Untitled"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.channel_name || "Unknown channel"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Timer className="size-3.5 text-muted-foreground" />
                  <ElapsedTimer startedAt={item.processing_started_at} />
                  {item.video_url && (
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="View on YouTube"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Queue Table */}
      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Queue
            {pendingItems.length > 0 && (
              <span className="ml-2 text-foreground font-bold">
                {pendingItems.length}
              </span>
            )}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="h-6 w-6 p-0"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>

        {pendingItems.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center border rounded-md">
            Queue is empty
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-5"></th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                    Title
                  </th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden md:table-cell">
                    Channel
                  </th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden sm:table-cell w-16">
                    Sched.
                  </th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-14 hidden sm:table-cell">
                    Tries
                  </th>
                  <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                      idx % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-block size-2 rounded-full ${priorityDotClass(item.priority)}`}
                        title={`Priority ${item.priority}`}
                      />
                    </td>
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
                      {formatRelativeScheduled(item.scheduled_for)}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {item.attempt_count}/{item.max_attempts}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <ActionButton
                          itemId={item.id}
                          action="prioritize"
                          actionLoading={actionLoading}
                          onAction={handleAction}
                          title="Move to front of queue"
                          icon={<Zap className="size-3.5 text-yellow-600" />}
                        />
                        <ActionButton
                          itemId={item.id}
                          action="skip"
                          actionLoading={actionLoading}
                          onAction={handleAction}
                          title="Skip this video"
                          icon={
                            <SkipForward className="size-3.5 text-muted-foreground" />
                          }
                        />
                        <ActionButton
                          itemId={item.id}
                          action="remove"
                          actionLoading={actionLoading}
                          onAction={handleAction}
                          title="Remove from queue"
                          icon={<Trash2 className="size-3.5 text-red-500" />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Failed Section */}
      {failedItems.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Failed
            <span className="text-red-700 font-bold">{failedItems.length}</span>
          </h2>
          <div className="border border-red-200 dark:border-red-900 rounded-md overflow-hidden">
            {failedItems.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 px-3 py-2 border-b last:border-0 ${
                  idx % 2 === 0
                    ? "bg-red-50/40 dark:bg-red-950/10"
                    : "bg-red-50/20 dark:bg-red-950/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">
                    {item.video_title || item.video_id || "Untitled"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.channel_name || "Unknown"} · {item.attempt_count}/
                    {item.max_attempts} attempts
                  </div>
                  {item.error_message && (
                    <div className="text-xs text-red-600 mt-0.5 line-clamp-2">
                      {item.error_message}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {item.video_url && (
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      title="View on YouTube"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <ActionButton
                    itemId={item.id}
                    action="retry"
                    actionLoading={actionLoading}
                    onAction={handleAction}
                    title="Retry this video"
                    icon={<RotateCcw className="size-3.5 text-blue-600" />}
                  />
                  <ActionButton
                    itemId={item.id}
                    action="remove"
                    actionLoading={actionLoading}
                    onAction={handleAction}
                    title="Remove"
                    icon={<Trash2 className="size-3.5 text-red-500" />}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Analyze Video Input */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Youtube className="size-3.5 text-red-500" />
          Analyze Video
        </h2>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value)
              setAnalyzeError("")
            }}
            onKeyDown={handleAnalyzeKeyDown}
            className="h-8 text-sm flex-1"
          />
          <Button
            onClick={handleAnalyzeVideo}
            disabled={!youtubeUrl.trim() || isAnalyzing}
            size="sm"
            className="h-8 px-3 shrink-0"
          >
            {isAnalyzing ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            <span className="ml-1.5">
              {isAnalyzing ? "Starting..." : "Analyze"}
            </span>
          </Button>
        </div>
        {analyzeError && (
          <p className="text-xs text-red-600 mt-1">{analyzeError}</p>
        )}
        {analyzeSuccess && (
          <p className="text-xs text-green-600 mt-1">Video queued for analysis.</p>
        )}
      </section>
    </div>
  )
}
