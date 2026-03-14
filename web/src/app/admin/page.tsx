"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  SkipForward,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Database,
  FileText,
  Brain,
  Quote,
  MapPin,
  Shield,
  EyeOff,
  Eye,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
  Youtube,
  Loader2,
} from "lucide-react"
import { getApiUrl } from "@/lib/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Episode {
  video_id: string
  title: string
  channel_name: string
  analysis_date: string | null
  language: string | null
  transcript: string | null
  status?: string
  video_url?: string
  restaurant_count?: number
}

interface QueueInfo {
  status: string
  priority?: number
  attempt_count?: number
  max_attempts?: number
  discovered_at?: string
  processing_started_at?: string
  processing_completed_at?: string
  error_message?: string
  video_title?: string
  channel_name?: string
}

interface Restaurant {
  id?: string
  name_hebrew?: string
  name_english?: string
  host_opinion?: string
  city?: string
  cuisine_type?: string
  status?: string
  confidence_level?: number
  host_comments?: string
  engaging_quote?: string
  is_hidden?: boolean
  mention_timestamp?: number
  mention_timestamp_seconds?: number
  published_at?: string
  episode_id?: string
}

interface AnalysisFile {
  timestamp?: string
  analysis_request?: string
  prompt?: string
  claude_analysis?: unknown
  response?: unknown
}

interface PipelineLog {
  timestamp?: string
  event_type?: string
  level?: string
  message?: string
}

interface EpisodeDetail {
  episode: Episode | null
  restaurants: Restaurant[]
  queue_info: QueueInfo | null
  pipeline_logs: PipelineLog[]
  analysis_files: AnalysisFile[]
  transcript_files: string[]
}

interface EpisodeListItem {
  video_id: string
  title: string
  channel_name: string
  analysis_date: string | null
  published_at?: string | null
  queue_published_at?: string | null
  status?: string
  restaurant_count?: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

interface EpisodesResponse {
  episodes: EpisodeListItem[]
  pagination: Pagination
}

// ---------------------------------------------------------------------------
// Status / opinion config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: typeof Clock }
> = {
  queued: {
    label: "Queued",
    badgeClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: Clock,
  },
  processing: {
    label: "Processing",
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: RefreshCw,
  },
  completed: {
    label: "Completed",
    badgeClass:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    badgeClass:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
  },
  skipped: {
    label: "Skipped",
    badgeClass:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    icon: SkipForward,
  },
}

const OPINION_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  positive: {
    label: "Positive",
    badgeClass:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  negative: {
    label: "Negative",
    badgeClass:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  mixed: {
    label: "Mixed",
    badgeClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  neutral: {
    label: "Neutral",
    badgeClass:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------
// Pipeline flow diagram
// ---------------------------------------------------------------------------

interface PipelineStep {
  id: string
  label: string
  icon: typeof CheckCircle2
  status: "success" | "failed" | "unreached" | "unknown"
}

function getPipelineSteps(detail: EpisodeDetail): PipelineStep[] {
  const status =
    detail?.queue_info?.status ?? detail?.episode?.status ?? "unknown"
  const hasTranscript = !!detail?.episode?.transcript
  const hasAnalysis = !!(
    detail?.analysis_files && detail.analysis_files.length > 0
  )
  const hasRestaurants = !!(
    detail?.restaurants && detail.restaurants.length > 0
  )
  const isFailed = status === "failed"
  const isCompleted = status === "completed"

  const transcriptStatus: PipelineStep["status"] = hasTranscript
    ? "success"
    : isFailed
    ? "failed"
    : "unreached"
  const analysisStatus: PipelineStep["status"] = hasAnalysis
    ? "success"
    : hasTranscript && isFailed
    ? "failed"
    : hasTranscript
    ? "unknown"
    : "unreached"
  const extractionStatus: PipelineStep["status"] = hasRestaurants
    ? "success"
    : isCompleted
    ? "success"
    : hasAnalysis && isFailed
    ? "failed"
    : hasAnalysis
    ? "unknown"
    : "unreached"
  const placesStatus: PipelineStep["status"] = hasRestaurants
    ? "success"
    : extractionStatus === "failed"
    ? "unreached"
    : extractionStatus === "success"
    ? "unknown"
    : "unreached"
  const filterStatus: PipelineStep["status"] = isCompleted
    ? "success"
    : isFailed
    ? "unreached"
    : "unreached"
  const dbStatus: PipelineStep["status"] = isCompleted
    ? "success"
    : isFailed
    ? "unreached"
    : "unreached"

  return [
    {
      id: "transcript",
      label: "Transcript Fetch",
      icon: FileText,
      status: transcriptStatus,
    },
    {
      id: "analysis",
      label: "AI Analysis",
      icon: Brain,
      status: analysisStatus,
    },
    {
      id: "extraction",
      label: "Quote Extraction",
      icon: Quote,
      status: extractionStatus,
    },
    {
      id: "places",
      label: "Google Places",
      icon: MapPin,
      status: placesStatus,
    },
    {
      id: "filter",
      label: "Hallucination Filter",
      icon: Shield,
      status: filterStatus,
    },
    { id: "db", label: "DB Storage", icon: Database, status: dbStatus },
  ]
}

function stepBg(status: PipelineStep["status"]): string {
  switch (status) {
    case "success":
      return "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
    case "failed":
      return "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
    case "unknown":
      return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
    default:
      return "bg-muted border-border text-muted-foreground"
  }
}

function stepIconColor(status: PipelineStep["status"]): string {
  switch (status) {
    case "success":
      return "text-green-600 dark:text-green-400"
    case "failed":
      return "text-red-600 dark:text-red-400"
    case "unknown":
      return "text-blue-600 dark:text-blue-400"
    default:
      return "text-muted-foreground/50"
  }
}

function PipelineFlowDiagram({ detail }: { detail: EpisodeDetail }) {
  const steps = getPipelineSteps(detail)

  return (
    <div className="flex flex-wrap items-center gap-1 py-3">
      {steps.map((step, i) => {
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-center min-w-[90px] ${stepBg(step.status)}`}
            >
              <Icon className={`h-4 w-4 ${stepIconColor(step.status)}`} />
              <span className="text-[10px] font-medium leading-tight">
                {step.label}
              </span>
              <span className="text-[9px] opacity-70 capitalize">
                {step.status === "unreached" ? "not reached" : step.status}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground/50 text-xs font-bold shrink-0">
                →
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analysis run collapsible section
// ---------------------------------------------------------------------------

function AnalysisRunSection({
  run,
  index,
}: {
  run: AnalysisFile
  index: number
}) {
  const [open, setOpen] = useState(index === 0)

  const prompt = run?.analysis_request ?? run?.prompt ?? null
  const response = run?.claude_analysis ?? run?.response ?? run

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
        aria-expanded={open}
      >
        <span>
          Run {index + 1}
          {run?.timestamp ? ` — ${formatDate(run.timestamp)}` : ""}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Prompt
            </p>
            <pre className="bg-muted/60 rounded-md p-3 text-[11px] font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-72 whitespace-pre-wrap break-words">
              {prompt
                ? typeof prompt === "string"
                  ? prompt
                  : JSON.stringify(prompt, null, 2)
                : "No prompt recorded"}
            </pre>
          </div>
          <div className="p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Response
            </p>
            <pre className="bg-muted/60 rounded-md p-3 text-[11px] font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-72 whitespace-pre-wrap break-words">
              {response
                ? typeof response === "string"
                  ? response
                  : JSON.stringify(response, null, 2)
                : "No response recorded"}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Restaurant card (inside episode detail)
// ---------------------------------------------------------------------------

function RestaurantCard({
  restaurant,
  videoId,
  onToggleVisibility,
  toggling,
}: {
  restaurant: Restaurant
  videoId?: string
  onToggleVisibility: (id: string, hidden: boolean) => void
  toggling: boolean
}) {
  const r = restaurant
  const opinion = r.host_opinion ?? "neutral"
  const opinionCfg = OPINION_CONFIG[opinion] ?? OPINION_CONFIG.neutral
  const timestamp = r.mention_timestamp_seconds ?? r.mention_timestamp ?? null
  const timestampInt = timestamp != null ? Math.floor(Number(timestamp)) : null

  return (
    <div
      className={`border rounded-lg p-4 space-y-3 transition-opacity ${
        r.is_hidden
          ? "opacity-50 border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/10"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-sm" dir="auto">
            {r.name_hebrew || r.name_english || "Unnamed"}
          </p>
          {r.name_hebrew && r.name_english && (
            <p className="text-xs text-muted-foreground">{r.name_english}</p>
          )}
          {r.published_at && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Published: {formatDate(r.published_at)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${opinionCfg.badgeClass}`}
          >
            {opinionCfg.label}
          </span>
          {r.city && (
            <Badge variant="outline" className="text-[10px] h-5">
              {r.city}
            </Badge>
          )}
          {r.cuisine_type && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {r.cuisine_type}
            </Badge>
          )}
          {r.status && (
            <Badge variant="outline" className="text-[10px] h-5">
              {r.status}
            </Badge>
          )}
          {r.confidence_level != null && (
            <Badge variant="outline" className="text-[10px] h-5 font-mono">
              {Math.round(r.confidence_level * 100)}%
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (r.id) onToggleVisibility(r.id, !r.is_hidden)
            }}
            disabled={toggling || !r.id}
            className={`p-1 rounded hover:bg-muted transition-colors disabled:opacity-50 ${
              r.is_hidden ? "text-red-500" : "text-muted-foreground"
            }`}
            title={r.is_hidden ? "Unhide restaurant" : "Hide restaurant"}
            aria-label={r.is_hidden ? "Unhide restaurant" : "Hide restaurant"}
          >
            {r.is_hidden ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
          {r.id && (
            <a
              href={`/restaurant/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
              title="View restaurant"
              aria-label="View restaurant"
            >
              <Pencil className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {r.host_comments && (
        <p className="text-xs text-muted-foreground" dir="auto">
          {r.host_comments}
        </p>
      )}

      {r.engaging_quote && (
        <p
          className="text-xs italic text-foreground/70 border-l-2 border-primary/30 pl-2"
          dir="auto"
        >
          &ldquo;{r.engaging_quote}&rdquo;
        </p>
      )}

      {/* YouTube embed with timestamp */}
      {videoId && (
        <div className="rounded-lg overflow-hidden border bg-black aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}${timestampInt != null && timestampInt > 0 ? `?start=${timestampInt}` : ''}`}
            title={`${r.name_hebrew || r.name_english || 'Restaurant'} - video segment`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Episode detail panel (inline, full-width)
// ---------------------------------------------------------------------------

function EpisodeDetailPanel({
  videoId,
  onBack,
}: {
  videoId: string
  onBack: () => void
}) {
  const [detail, setDetail] = useState<EpisodeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)

    fetch(getApiUrl(`/api/deepdive/episodes/${videoId}`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: EpisodeDetail) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [videoId])

  const handleToggleVisibility = useCallback(
    async (id: string, isHidden: boolean) => {
      setTogglingId(id)
      try {
        const res = await fetch(
          getApiUrl(`/api/deepdive/restaurants/${id}/visibility`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_hidden: isHidden }),
          }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        // Optimistically update local state
        setDetail((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            restaurants: prev.restaurants.map((r) =>
              r.id === id ? { ...r, is_hidden: isHidden } : r
            ),
          }
        })
      } catch {
        // Silently fail — user can retry
      } finally {
        setTogglingId(null)
      }
    },
    []
  )

  const episode = detail?.episode ?? null
  const queueInfo = detail?.queue_info ?? null
  const restaurants: Restaurant[] = detail?.restaurants ?? []
  const analysisFiles: AnalysisFile[] = detail?.analysis_files ?? []
  const pipelineLogs: PipelineLog[] = detail?.pipeline_logs ?? []
  const transcript = detail?.episode?.transcript ?? null

  const overallStatus =
    queueInfo?.status ?? episode?.status ?? "unknown"
  const statusCfg =
    STATUS_CONFIG[overallStatus] ?? STATUS_CONFIG.queued
  const StatusIcon = statusCfg.icon

  const videoUrl =
    episode?.video_url ??
    (episode?.video_id
      ? `https://www.youtube.com/watch?v=${episode.video_id}`
      : null)

  return (
    <div className="flex flex-col gap-4">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to episodes list"
        >
          <ChevronLeft className="h-4 w-4" />
          All Episodes
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-muted-foreground">
            Failed to load episode details: {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null)
              setLoading(true)
              fetch(getApiUrl(`/api/deepdive/episodes/${videoId}`))
                .then((r) => r.json())
                .then((d: EpisodeDetail) => setDetail(d))
                .catch((e: Error) => setError(e.message))
                .finally(() => setLoading(false))
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && detail && (
        <>
          {/* Episode header card */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.badgeClass}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                    {restaurants.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {restaurants.length} restaurant
                        {restaurants.length !== 1 ? "s" : ""} extracted
                      </span>
                    )}
                  </div>
                  <h2
                    className="font-semibold text-base leading-snug"
                    dir="auto"
                  >
                    {episode?.title ??
                      queueInfo?.video_title ??
                      "Untitled Episode"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {episode?.channel_name ??
                      queueInfo?.channel_name ??
                      "Unknown channel"}
                  </p>
                </div>
                {videoUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Youtube className="h-4 w-4" />
                      YouTube
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detail tabs */}
          <Tabs defaultValue="pipeline" className="flex flex-col gap-0">
            <TabsList className="justify-start mb-0 w-full">
              <TabsTrigger value="pipeline">Pipeline Flow</TabsTrigger>
              <TabsTrigger value="prompts">
                Prompts &amp; Responses
                {analysisFiles.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                    {analysisFiles.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="transcript" disabled={!transcript}>
                Transcript
              </TabsTrigger>
              <TabsTrigger value="restaurants">
                Restaurants
                {restaurants.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                    {restaurants.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Pipeline Flow tab */}
            <TabsContent value="pipeline" className="mt-4 space-y-5">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <PipelineFlowDiagram detail={detail} />
                </CardContent>
              </Card>

              {/* Episode metadata grid */}
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">Episode Metadata</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    {[
                      {
                        label: "Video ID",
                        value: episode?.video_id ?? "—",
                      },
                      {
                        label: "Channel",
                        value:
                          episode?.channel_name ??
                          queueInfo?.channel_name ??
                          "—",
                      },
                      {
                        label: "Language",
                        value: episode?.language ?? "—",
                      },
                      {
                        label: "Analysis Date",
                        value: formatDate(episode?.analysis_date ?? null),
                      },
                      {
                        label: "Priority",
                        value: queueInfo?.priority ?? "—",
                      },
                      {
                        label: "Attempts",
                        value: queueInfo
                          ? `${queueInfo.attempt_count ?? 0} / ${queueInfo.max_attempts ?? 3}`
                          : "—",
                      },
                      {
                        label: "Discovered",
                        value: formatDate(queueInfo?.discovered_at ?? null),
                      },
                      {
                        label: "Processing Started",
                        value: formatDate(
                          queueInfo?.processing_started_at ?? null
                        ),
                      },
                      {
                        label: "Processing Completed",
                        value: formatDate(
                          queueInfo?.processing_completed_at ?? null
                        ),
                      },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {label}
                        </p>
                        <p className="text-sm font-medium truncate">
                          {String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Error message */}
              {queueInfo?.error_message && (
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                    Last Error
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {queueInfo.error_message}
                  </p>
                </div>
              )}

              {/* Pipeline logs timeline */}
              {pipelineLogs.length > 0 && (
                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm">Pipeline Events</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 pb-4">
                    <div className="relative border-l-2 border-border pl-4 space-y-3">
                      {pipelineLogs.map((log, i) => (
                        <div key={i} className="relative">
                          <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/40" />
                          <div className="flex items-start gap-3">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                              {formatDate(log.timestamp)}
                            </span>
                            <div>
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide ${
                                  log.level === "error"
                                    ? "text-red-600"
                                    : log.level === "warning"
                                    ? "text-yellow-600"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {log.event_type ?? log.level}
                              </span>
                              {log.message && (
                                <p className="text-xs text-foreground/80">
                                  {log.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Prompts & Responses tab */}
            <TabsContent value="prompts" className="mt-4">
              {analysisFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Brain className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No analysis files found for this episode
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Analysis data is recorded after the AI processing step
                    completes.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysisFiles.map((run, i) => (
                    <AnalysisRunSection key={i} run={run} index={i} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Transcript tab */}
            <TabsContent value="transcript" className="mt-4">
              {transcript ? (
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      {transcript.length.toLocaleString()} characters
                    </p>
                    <pre
                      className="bg-muted/40 border rounded-md p-4 text-sm leading-relaxed font-mono whitespace-pre-wrap break-words overflow-y-auto"
                      dir="auto"
                      style={{ maxHeight: "60vh" }}
                    >
                      {transcript}
                    </pre>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                  No transcript available
                </div>
              )}
            </TabsContent>

            {/* Restaurants tab */}
            <TabsContent value="restaurants" className="mt-4">
              {restaurants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <MapPin className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No restaurants extracted from this episode
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {restaurants.map((r, i) => (
                    <RestaurantCard
                      key={r.id ?? i}
                      restaurant={r}
                      videoId={videoId}
                      onToggleVisibility={handleToggleVisibility}
                      toggling={togglingId === r.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Episodes list tab
// ---------------------------------------------------------------------------

function EpisodesTab({
  onSelectEpisode,
}: {
  onSelectEpisode: (videoId: string) => void
}) {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [episodes, setEpisodes] = useState<EpisodeListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    })
    if (debouncedSearch) params.set("search", debouncedSearch)

    fetch(getApiUrl(`/api/deepdive/episodes?${params.toString()}`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: EpisodesResponse) => {
        if (!cancelled) {
          setEpisodes(data.episodes ?? [])
          setPagination(data.pagination ?? null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, page])

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by title or channel..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search episodes"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-muted-foreground">
            Failed to load episodes: {error}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && episodes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <FileText className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No episodes found</p>
          {debouncedSearch && (
            <p className="text-xs text-muted-foreground/60">
              Try a different search term
            </p>
          )}
        </div>
      )}

      {/* Episodes list */}
      {!loading && !error && episodes.length > 0 && (
        <div className="flex flex-col gap-2">
          {episodes.map((ep) => {
            const status = ep.status ?? "unknown"
            const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued
            const StatusIcon = statusCfg.icon

            return (
              <button
                key={ep.video_id}
                onClick={() => onSelectEpisode(ep.video_id)}
                className="w-full text-left border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View details for ${ep.title}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm truncate"
                      dir="auto"
                      title={ep.title}
                    >
                      {ep.title || "Untitled"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {ep.channel_name || "Unknown channel"}
                      </span>
                      {(ep.published_at || ep.queue_published_at) && (
                        <span className="text-xs text-muted-foreground">
                          · {formatDate(ep.published_at || ep.queue_published_at)}
                        </span>
                      )}
                      {!ep.published_at && !ep.queue_published_at && ep.analysis_date && (
                        <span className="text-xs text-muted-foreground">
                          · {formatDate(ep.analysis_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {ep.restaurant_count != null && ep.restaurant_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {ep.restaurant_count} restaurant
                        {ep.restaurant_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.badgeClass}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages} &middot;{" "}
            {pagination.total} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p) => Math.min(pagination.total_pages, p + 1))
              }
              disabled={page >= pagination.total_pages || loading}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Restaurants tab (top-level — shows guidance to select an episode)
// ---------------------------------------------------------------------------

function RestaurantsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <MapPin className="h-12 w-12 text-muted-foreground/30" />
      <div>
        <p className="font-medium text-sm">Select an episode to view restaurants</p>
        <p className="text-xs text-muted-foreground mt-1">
          Click any episode in the Episodes tab, then open the Restaurants tab
          in the detail view.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root page component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("episodes")

  const handleSelectEpisode = (videoId: string) => {
    setSelectedVideoId(videoId)
  }

  const handleBack = () => {
    setSelectedVideoId(null)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deep Dive</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pipeline debugging and content inspection
          </p>
        </div>
      </div>

      {/* Episode detail view (full-page inline) */}
      {selectedVideoId ? (
        <EpisodeDetailPanel
          videoId={selectedVideoId}
          onBack={handleBack}
        />
      ) : (
        /* Top-level tabs */
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col gap-4"
        >
          <TabsList className="justify-start">
            <TabsTrigger value="episodes">Episodes</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
          </TabsList>

          <TabsContent value="episodes">
            <EpisodesTab onSelectEpisode={handleSelectEpisode} />
          </TabsContent>

          <TabsContent value="restaurants">
            <RestaurantsTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
