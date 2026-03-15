"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  LayoutDashboard,
  Activity,
  ListOrdered,
  BookOpen,
  Utensils,
  ImageIcon,
  Calendar as CalendarIcon,
  Grid3X3,
  Star,
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
  image_url?: string
  address?: string
  price_range?: string
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
// Restaurants tab (top-level — paginated list of all restaurants)
// ---------------------------------------------------------------------------

interface RestaurantsSearchResponse {
  restaurants: Restaurant[]
  pagination: Pagination
}

function RestaurantsTab() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchRestaurants = useCallback(() => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      include_hidden: "true",
    })
    if (debouncedSearch) params.set("q", debouncedSearch)

    fetch(getApiUrl(`/api/restaurants/search?${params.toString()}`))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: RestaurantsSearchResponse) => {
        setRestaurants(data.restaurants ?? [])
        setPagination(data.pagination ?? null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [debouncedSearch, page])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  const handleToggleVisibility = useCallback(
    async (id: string, isHidden: boolean) => {
      setTogglingId(id)
      try {
        const res = await fetch(getApiUrl(`/api/restaurants/${id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: isHidden ? 1 : 0 }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setRestaurants((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, is_hidden: isHidden } : r
          )
        )
      } catch {
        // Silently fail
      } finally {
        setTogglingId(null)
      }
    },
    []
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search restaurants by name, city, cuisine..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search restaurants"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-muted-foreground">
            Failed to load restaurants: {error}
          </p>
          <Button variant="outline" size="sm" onClick={fetchRestaurants}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && restaurants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MapPin className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No restaurants found</p>
          {debouncedSearch && (
            <p className="text-xs text-muted-foreground/60">
              Try a different search term
            </p>
          )}
        </div>
      )}

      {!loading && !error && restaurants.length > 0 && (
        <>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_1fr_auto] gap-3 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b">
            <span>Name</span>
            <span>City</span>
            <span>Cuisine</span>
            <span>Status</span>
            <span>Opinion</span>
            <span>Published</span>
            <span>Actions</span>
          </div>

          <div className="flex flex-col gap-1">
            {restaurants.map((r) => {
              const opinion = r.host_opinion ?? "neutral"
              const opinionCfg = OPINION_CONFIG[opinion] ?? OPINION_CONFIG.neutral

              return (
                <div
                  key={r.id}
                  className={`grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_1fr_auto] gap-2 sm:gap-3 items-center px-4 py-3 rounded-lg border hover:bg-muted/30 transition-colors ${
                    r.is_hidden
                      ? "opacity-50 border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/10"
                      : ""
                  }`}
                >
                  {/* Name */}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" dir="auto">
                      {r.name_hebrew || r.name_english || "Unnamed"}
                    </p>
                    {r.name_hebrew && r.name_english && (
                      <p className="text-xs text-muted-foreground truncate">
                        {r.name_english}
                      </p>
                    )}
                  </div>

                  {/* City */}
                  <span className="text-xs text-muted-foreground truncate" dir="auto">
                    {r.city || "---"}
                  </span>

                  {/* Cuisine */}
                  <span className="text-xs text-muted-foreground truncate">
                    {r.cuisine_type || "---"}
                  </span>

                  {/* Status */}
                  <div>
                    {r.status ? (
                      <Badge variant="outline" className="text-[10px] h-5">
                        {r.status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">---</span>
                    )}
                  </div>

                  {/* Opinion */}
                  <div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${opinionCfg.badgeClass}`}
                    >
                      {opinionCfg.label}
                    </span>
                  </div>

                  {/* Published date */}
                  <span className="text-xs text-muted-foreground">
                    {r.published_at ? formatDate(r.published_at) : "---"}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (r.id)
                          handleToggleVisibility(r.id, !r.is_hidden)
                      }}
                      disabled={togglingId === r.id || !r.id}
                      className={`p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50 ${
                        r.is_hidden ? "text-red-500" : "text-muted-foreground"
                      }`}
                      title={r.is_hidden ? "Unhide" : "Hide"}
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
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                        title="Edit restaurant"
                        aria-label="Edit restaurant"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
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
// Dashboard tab
// ---------------------------------------------------------------------------

interface HealthData {
  status?: string
  pipeline?: { status?: string; queue_depth?: number }
  queue_depth?: number
}

function DashboardTab({ onNavigateToDeepDive }: { onNavigateToDeepDive: () => void }) {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [totalRestaurants, setTotalRestaurants] = useState<number | null>(null)
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(null)
  const [recentRestaurants, setRecentRestaurants] = useState<Restaurant[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    fetch(getApiUrl("/health"))
      .then((r) => r.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatsLoading(true)

    // Fetch restaurant count + recent restaurants, and episode count in parallel
    Promise.all([
      fetch(getApiUrl("/api/restaurants/search?page=1&limit=5"))
        .then((r) => r.json())
        .catch(() => null),
      fetch(getApiUrl("/api/deepdive/episodes?limit=1"))
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([restaurantData, episodeData]) => {
      if (cancelled) return
      if (restaurantData?.pagination?.total != null) {
        setTotalRestaurants(restaurantData.pagination.total)
      }
      if (restaurantData?.restaurants) {
        setRecentRestaurants(restaurantData.restaurants)
      }
      if (episodeData?.pagination?.total != null) {
        setTotalEpisodes(episodeData.pagination.total)
      }
      setStatsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const pipelineStatus =
    health?.pipeline?.status ?? health?.status ?? null
  const queueDepth =
    health?.pipeline?.queue_depth ?? health?.queue_depth ?? null
  const isRunning = pipelineStatus === "running" || pipelineStatus === "ok"

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <LayoutDashboard className="h-5 w-5" />
            Admin Dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your Where2Eat content
          </p>
        </CardHeader>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total restaurants */}
        <Card>
          <CardContent className="pt-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Utensils className="h-4 w-4" />
              Restaurants
            </div>
            {statsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : totalRestaurants !== null ? (
              <span className="text-2xl font-bold">{totalRestaurants}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )}
          </CardContent>
        </Card>

        {/* Total episodes */}
        <Card>
          <CardContent className="pt-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Youtube className="h-4 w-4" />
              Episodes
            </div>
            {statsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : totalEpisodes !== null ? (
              <span className="text-2xl font-bold">{totalEpisodes}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )}
          </CardContent>
        </Card>

        {/* Pipeline status */}
        <Card>
          <CardContent className="pt-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Pipeline
            </div>
            {healthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : pipelineStatus ? (
              <Badge
                variant={isRunning ? "default" : "secondary"}
                className="w-fit"
              >
                {isRunning ? "Running" : "Stopped"}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )}
          </CardContent>
        </Card>

        {/* Queue depth */}
        <Card>
          <CardContent className="pt-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListOrdered className="h-4 w-4" />
              Queue Depth
            </div>
            {healthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : queueDepth !== null ? (
              <span className="text-2xl font-bold">{queueDepth}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent restaurants */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Recently Added Restaurants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentRestaurants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No restaurants yet
            </p>
          ) : (
            <div className="divide-y">
              {recentRestaurants.map((r) => {
                const opinion = r.host_opinion ?? "neutral"
                const opinionCfg =
                  OPINION_CONFIG[opinion] ?? OPINION_CONFIG.neutral
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" dir="auto">
                        {r.name_hebrew || r.name_english || "Unnamed"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {r.city && (
                          <span className="text-xs text-muted-foreground">
                            {r.city}
                          </span>
                        )}
                        {r.cuisine_type && (
                          <span className="text-xs text-muted-foreground">
                            · {r.cuisine_type}
                          </span>
                        )}
                        {r.published_at && (
                          <span className="text-xs text-muted-foreground">
                            · {formatDate(r.published_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${opinionCfg.badgeClass}`}
                    >
                      {opinionCfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={onNavigateToDeepDive} variant="outline" size="sm">
            <Database className="h-4 w-4 mr-2" />
            Deep Dive
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={getApiUrl("/docs")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              API Docs
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cuisine gradient helper for feed cards
// ---------------------------------------------------------------------------

const CUISINE_GRADIENTS: Record<string, string> = {
  italian: "from-red-400 to-orange-300",
  japanese: "from-pink-400 to-red-300",
  sushi: "from-pink-400 to-red-300",
  asian: "from-amber-400 to-yellow-300",
  chinese: "from-red-500 to-yellow-400",
  thai: "from-green-400 to-emerald-300",
  indian: "from-orange-500 to-yellow-400",
  mexican: "from-green-500 to-lime-300",
  french: "from-blue-400 to-indigo-300",
  mediterranean: "from-cyan-400 to-blue-300",
  middle_eastern: "from-amber-500 to-orange-300",
  american: "from-blue-500 to-red-400",
  burger: "from-yellow-500 to-red-400",
  pizza: "from-red-400 to-yellow-300",
  seafood: "from-cyan-500 to-blue-400",
  default: "from-slate-400 to-slate-300",
}

function getCuisineGradient(cuisine?: string): string {
  if (!cuisine) return CUISINE_GRADIENTS.default
  const key = cuisine.toLowerCase().replace(/[\s-]/g, "_")
  return CUISINE_GRADIENTS[key] ?? CUISINE_GRADIENTS.default
}

function getRestaurantImageUrl(imageUrl?: string): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith("http")) return imageUrl
  return `${getApiUrl("")}/api/photos/${encodeURIComponent(imageUrl)}?maxwidth=400`
}

// ---------------------------------------------------------------------------
// Edit Restaurant Dialog
// ---------------------------------------------------------------------------

function EditRestaurantDialog({
  restaurant,
  onClose,
  onSaved,
}: {
  restaurant: Restaurant
  onClose: () => void
  onSaved: (updated: Restaurant) => void
}) {
  const [form, setForm] = useState({
    name_hebrew: restaurant.name_hebrew || "",
    name_english: restaurant.name_english || "",
    city: restaurant.city || "",
    cuisine_type: restaurant.cuisine_type || "",
    price_range: restaurant.price_range || "",
    host_opinion: restaurant.host_opinion || "",
    host_comments: restaurant.host_comments || "",
    engaging_quote: restaurant.engaging_quote || "",
    status: restaurant.status || "open",
    address: restaurant.address || "",
  })
  const [saving, setSaving] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!restaurant.id) return
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, unknown> = {}
      // Only send changed fields
      if (form.name_hebrew !== (restaurant.name_hebrew || "")) body.name_hebrew = form.name_hebrew
      if (form.name_english !== (restaurant.name_english || "")) body.name_english = form.name_english
      if (form.cuisine_type !== (restaurant.cuisine_type || "")) body.cuisine_type = form.cuisine_type
      if (form.price_range !== (restaurant.price_range || "")) body.price_range = form.price_range
      if (form.host_opinion !== (restaurant.host_opinion || "")) body.host_opinion = form.host_opinion
      if (form.host_comments !== (restaurant.host_comments || "")) body.host_comments = form.host_comments
      if (form.engaging_quote !== (restaurant.engaging_quote || "")) body.engaging_quote = form.engaging_quote
      if (form.status !== (restaurant.status || "open")) body.status = form.status
      if (form.city !== (restaurant.city || "") || form.address !== (restaurant.address || "")) {
        body.location = { city: form.city, address: form.address }
      }

      if (Object.keys(body).length === 0) {
        onClose()
        return
      }

      const res = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Merge changes into a copy and notify parent
      const updated = { ...restaurant, ...form }
      onSaved(updated)
      onClose()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleReprocess = async () => {
    if (!restaurant.id) return
    setReprocessing(true)
    setSaveError(null)
    try {
      const res = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}/reprocess`), {
        method: "POST",
      })
      const data = await res.json()
      if (data.success && data.restaurant) {
        onSaved(data.restaurant)
        onClose()
      } else {
        setSaveError(data.error || data.detail || `Reprocess failed (HTTP ${res.status})`)
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Reprocess failed")
    } finally {
      setReprocessing(false)
    }
  }

  const handleSaveAndReprocess = async () => {
    if (!restaurant.id) return
    setReprocessing(true)
    setSaveError(null)
    try {
      // 1. Save edited fields first
      const body: Record<string, unknown> = {}
      if (form.name_hebrew !== (restaurant.name_hebrew || "")) body.name_hebrew = form.name_hebrew
      if (form.name_english !== (restaurant.name_english || "")) body.name_english = form.name_english
      if (form.cuisine_type !== (restaurant.cuisine_type || "")) body.cuisine_type = form.cuisine_type
      if (form.price_range !== (restaurant.price_range || "")) body.price_range = form.price_range
      if (form.host_opinion !== (restaurant.host_opinion || "")) body.host_opinion = form.host_opinion
      if (form.host_comments !== (restaurant.host_comments || "")) body.host_comments = form.host_comments
      if (form.engaging_quote !== (restaurant.engaging_quote || "")) body.engaging_quote = form.engaging_quote
      if (form.status !== (restaurant.status || "open")) body.status = form.status
      if (form.city !== (restaurant.city || "") || form.address !== (restaurant.address || "")) {
        body.location = { city: form.city, address: form.address }
      }

      if (Object.keys(body).length > 0) {
        const saveRes = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!saveRes.ok) throw new Error(`Save failed: HTTP ${saveRes.status}`)
      }

      // 2. Then reprocess with the updated fields
      const res = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}/reprocess`), {
        method: "POST",
      })
      const data = await res.json()
      if (data.success && data.restaurant) {
        onSaved(data.restaurant)
        onClose()
      } else {
        setSaveError(data.error || data.detail || `Reprocess failed (HTTP ${res.status})`)
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save & Reprocess failed")
    } finally {
      setReprocessing(false)
    }
  }

  const fields: { key: string; label: string; type?: "text" | "select" | "textarea"; options?: { value: string; label: string }[] }[] = [
    { key: "name_hebrew", label: "Name (Hebrew)" },
    { key: "name_english", label: "Name (English)" },
    { key: "city", label: "City" },
    { key: "address", label: "Address" },
    { key: "cuisine_type", label: "Cuisine Type" },
    {
      key: "price_range", label: "Price Range", type: "select",
      options: [
        { value: "", label: "—" },
        { value: "budget", label: "Budget (₪)" },
        { value: "mid-range", label: "Mid-range (₪₪)" },
        { value: "expensive", label: "Expensive (₪₪₪)" },
      ],
    },
    {
      key: "host_opinion", label: "Host Opinion", type: "select",
      options: [
        { value: "", label: "—" },
        { value: "positive", label: "Positive" },
        { value: "negative", label: "Negative" },
        { value: "mixed", label: "Mixed" },
        { value: "neutral", label: "Neutral" },
      ],
    },
    {
      key: "status", label: "Status", type: "select",
      options: [
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
        { value: "new_opening", label: "New Opening" },
        { value: "closing_soon", label: "Closing Soon" },
      ],
    },
    { key: "host_comments", label: "Host Comments", type: "textarea" },
    { key: "engaging_quote", label: "Engaging Quote", type: "textarea" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">Edit Restaurant</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg px-2">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={(form as Record<string, string>)[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  value={(form as Record<string, string>)[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-y min-h-[60px]"
                  dir="auto"
                  rows={2}
                />
              ) : (
                <Input
                  value={(form as Record<string, string>)[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  dir="auto"
                />
              )}
            </div>
          ))}

          {saveError && (
            <p className="text-sm text-red-500">{saveError}</p>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReprocess} disabled={saving || reprocessing}>
              {reprocessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Reprocess
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveAndReprocess} disabled={saving || reprocessing}
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              {reprocessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Save & Reprocess
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving || reprocessing}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || reprocessing}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin Feed tab — card-based view with admin actions
// ---------------------------------------------------------------------------

function AdminFeedTab() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const res = await fetch(
          getApiUrl(`/api/restaurants/search?page=${pageNum}&limit=15&include_hidden=true`)
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: RestaurantsSearchResponse = await res.json()
        const newItems = data.restaurants ?? []

        if (append) {
          setRestaurants((prev) => [...prev, ...newItems])
        } else {
          setRestaurants(newItems)
        }

        const pag = data.pagination
        setHasMore(pag ? pag.page < pag.total_pages : false)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchPage(1, false)
  }, [fetchPage])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchPage(nextPage, true)
  }, [page, loadingMore, hasMore, fetchPage])

  // Infinite scroll: load more when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          handleLoadMore()
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, handleLoadMore])

  const handleToggleVisibility = useCallback(
    async (id: string, isHidden: boolean) => {
      setTogglingId(id)
      try {
        const res = await fetch(getApiUrl(`/api/restaurants/${id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: isHidden ? 1 : 0 }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setRestaurants((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, is_hidden: isHidden } : r
          )
        )
      } catch {
        // Silently fail
      } finally {
        setTogglingId(null)
      }
    },
    []
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-muted-foreground">
          Failed to load feed: {error}
        </p>
        <Button variant="outline" size="sm" onClick={() => fetchPage(1, false)}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Grid3X3 className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No restaurants in feed</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {restaurants.map((r) => {
          const opinion = r.host_opinion ?? "neutral"
          const opinionCfg = OPINION_CONFIG[opinion] ?? OPINION_CONFIG.neutral
          const imgUrl = getRestaurantImageUrl(r.image_url)
          const quote =
            r.engaging_quote || r.host_comments
              ? (r.engaging_quote || r.host_comments || "").slice(0, 120)
              : null

          return (
            <div
              key={r.id}
              className={`group relative border rounded-xl overflow-hidden bg-white dark:bg-card shadow-sm hover:shadow-md transition-shadow ${
                r.is_hidden
                  ? "opacity-60 ring-2 ring-red-300 dark:ring-red-800"
                  : ""
              }`}
            >
              {/* Image / gradient placeholder */}
              <div className="relative h-40 overflow-hidden">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={r.name_hebrew || r.name_english || "Restaurant"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${getCuisineGradient(r.cuisine_type)} flex items-center justify-center`}
                  >
                    <Utensils className="h-10 w-10 text-white/60" />
                  </div>
                )}

                {/* Hidden overlay */}
                {r.is_hidden && (
                  <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center">
                    <Badge className="bg-red-600 text-white text-xs">
                      HIDDEN
                    </Badge>
                  </div>
                )}

                {/* Opinion badge on image */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${opinionCfg.badgeClass}`}
                  >
                    {opinionCfg.label}
                  </span>
                </div>
              </div>

              {/* Card content */}
              <div className="p-4 space-y-2">
                <div>
                  <h3
                    className="font-semibold text-sm leading-tight truncate"
                    dir="auto"
                  >
                    {r.name_hebrew || r.name_english || "Unnamed"}
                  </h3>
                  {r.name_hebrew && r.name_english && (
                    <p className="text-xs text-muted-foreground truncate">
                      {r.name_english}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {r.city && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {r.city}
                    </span>
                  )}
                  {r.cuisine_type && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {r.cuisine_type}
                    </Badge>
                  )}
                </div>

                {quote && (
                  <p
                    className="text-xs italic text-foreground/70 border-l-2 border-primary/30 pl-2 line-clamp-2"
                    dir="auto"
                  >
                    &ldquo;{quote}&rdquo;
                  </p>
                )}

                {r.published_at && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {formatDate(r.published_at)}
                  </p>
                )}

                {/* Admin action buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    variant={r.is_hidden ? "destructive" : "outline"}
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => {
                      if (r.id) handleToggleVisibility(r.id, !r.is_hidden)
                    }}
                    disabled={togglingId === r.id || !r.id}
                  >
                    {r.is_hidden ? (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Hidden
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Visible
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => setEditingRestaurant(r)}
                    disabled={!r.id}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit dialog */}
      {editingRestaurant && (
        <EditRestaurantDialog
          restaurant={editingRestaurant}
          onClose={() => setEditingRestaurant(null)}
          onSaved={(updated) => {
            setRestaurants((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            )
          }}
        />
      )}

      {/* Infinite scroll sentinel */}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={sentinelRef} className="h-1" />

      {error && restaurants.length > 0 && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root page component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [topTab, setTopTab] = useState<string>("dashboard")
  const [deepDiveTab, setDeepDiveTab] = useState<string>("episodes")

  const handleSelectEpisode = (videoId: string) => {
    setSelectedVideoId(videoId)
  }

  const handleBack = () => {
    setSelectedVideoId(null)
  }

  const navigateToDeepDive = () => {
    setTopTab("deepdive")
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Where2Eat content management
          </p>
        </div>
      </div>

      {/* Top-level tabs: Dashboard / Feed / Deep Dive */}
      <Tabs value={topTab} onValueChange={setTopTab} className="flex flex-col gap-4">
        <TabsList className="justify-start">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="h-4 w-4 mr-1.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="feed">
            <Grid3X3 className="h-4 w-4 mr-1.5" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="deepdive">
            <Database className="h-4 w-4 mr-1.5" />
            Deep Dive
          </TabsTrigger>
        </TabsList>

        {/* Dashboard tab */}
        <TabsContent value="dashboard">
          <DashboardTab onNavigateToDeepDive={navigateToDeepDive} />
        </TabsContent>

        {/* Feed tab */}
        <TabsContent value="feed">
          <AdminFeedTab />
        </TabsContent>

        {/* Deep Dive tab */}
        <TabsContent value="deepdive">
          {selectedVideoId ? (
            <EpisodeDetailPanel videoId={selectedVideoId} onBack={handleBack} />
          ) : (
            <Tabs
              value={deepDiveTab}
              onValueChange={setDeepDiveTab}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
