'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { deepDiveApi } from '@/lib/api';
import { queryKeys } from '@/lib/constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface EpisodeDetailDialogProps {
  videoId: string | null;
  onClose: () => void;
}

// ---- Status config ----------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: typeof Clock }> = {
  queued: { label: 'Queued', badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  processing: { label: 'Processing', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: RefreshCw },
  completed: { label: 'Completed', badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  failed: { label: 'Failed', badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  skipped: { label: 'Skipped', badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: SkipForward },
};

const OPINION_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  positive: { label: 'Positive', badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  negative: { label: 'Negative', badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  mixed: { label: 'Mixed', badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  neutral: { label: 'Neutral', badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
};

// ---- Pipeline Step Block ----------------------------------------------------------

interface PipelineStep {
  id: string;
  label: string;
  icon: typeof CheckCircle2;
  status: 'success' | 'failed' | 'unreached' | 'unknown';
}

function getPipelineSteps(detail: any): PipelineStep[] {
  const status = detail?.queue_info?.status ?? detail?.episode?.status ?? 'unknown';
  const hasTranscript = !!detail?.episode?.transcript;
  const hasAnalysis = !!(detail?.analysis_files && detail.analysis_files.length > 0);
  const hasRestaurants = !!(detail?.restaurants && detail.restaurants.length > 0);
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed';

  // Determine per-step status based on available data
  const transcriptStatus = hasTranscript ? 'success' : isFailed ? 'failed' : 'unreached';
  const analysisStatus = hasAnalysis ? 'success' : hasTranscript && isFailed ? 'failed' : hasTranscript ? 'unknown' : 'unreached';
  const extractionStatus = hasRestaurants ? 'success' : isCompleted ? 'success' : hasAnalysis && isFailed ? 'failed' : hasAnalysis ? 'unknown' : 'unreached';
  const placesStatus = hasRestaurants ? 'success' : extractionStatus === 'failed' ? 'unreached' : extractionStatus === 'success' ? 'unknown' : 'unreached';
  const filterStatus = isCompleted ? 'success' : isFailed ? 'unreached' : 'unreached';
  const dbStatus = isCompleted ? 'success' : isFailed ? 'unreached' : 'unreached';

  return [
    { id: 'transcript', label: 'Transcript Fetch', icon: FileText, status: transcriptStatus },
    { id: 'analysis', label: 'AI Analysis', icon: Brain, status: analysisStatus },
    { id: 'extraction', label: 'Quote Extraction', icon: Quote, status: extractionStatus },
    { id: 'places', label: 'Google Places', icon: MapPin, status: placesStatus },
    { id: 'filter', label: 'Hallucination Filter', icon: Shield, status: filterStatus },
    { id: 'db', label: 'DB Storage', icon: Database, status: dbStatus },
  ];
}

function stepBg(status: PipelineStep['status']): string {
  switch (status) {
    case 'success': return 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300';
    case 'failed': return 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300';
    case 'unknown': return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300';
    default: return 'bg-muted border-border text-muted-foreground';
  }
}

function stepIconColor(status: PipelineStep['status']): string {
  switch (status) {
    case 'success': return 'text-green-600 dark:text-green-400';
    case 'failed': return 'text-red-600 dark:text-red-400';
    case 'unknown': return 'text-blue-600 dark:text-blue-400';
    default: return 'text-muted-foreground/50';
  }
}

function PipelineFlowDiagram({ detail }: { detail: any }) {
  const steps = getPipelineSteps(detail);

  return (
    <div className="flex flex-wrap items-center gap-1 py-3">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-center min-w-[90px] ${stepBg(step.status)}`}>
              <Icon className={`h-4 w-4 ${stepIconColor(step.status)}`} />
              <span className="text-[10px] font-medium leading-tight">{step.label}</span>
              <span className="text-[9px] opacity-70 capitalize">{step.status === 'unreached' ? 'not reached' : step.status}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground/50 text-xs font-bold shrink-0">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Collapsible analysis run section --------------------------------------------

function AnalysisRunSection({ run, index }: { run: any; index: number }) {
  const [open, setOpen] = useState(index === 0);

  const prompt = run?.analysis_request ?? run?.prompt ?? null;
  const response = run?.claude_analysis ?? run?.response ?? run;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
      >
        <span>Run {index + 1}{run?.timestamp ? ` — ${formatDate(run.timestamp)}` : ''}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Prompt</p>
            <pre className="bg-muted/60 rounded-md p-3 text-[11px] font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-72 whitespace-pre-wrap break-words">
              {prompt
                ? (typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2))
                : 'No prompt recorded'}
            </pre>
          </div>
          <div className="p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Response</p>
            <pre className="bg-muted/60 rounded-md p-3 text-[11px] font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-72 whitespace-pre-wrap break-words">
              {response
                ? (typeof response === 'string' ? response : JSON.stringify(response, null, 2))
                : 'No response recorded'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main dialog -----------------------------------------------------------------

export function EpisodeDetailDialog({ videoId, onClose }: EpisodeDetailDialogProps) {
  const [showReprocessConfirm, setShowReprocessConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.deepDive.episodeDetail(videoId ?? ''),
    queryFn: () => deepDiveApi.getEpisodeDetail(videoId!),
    enabled: !!videoId,
  });

  const reprocessMutation = useMutation({
    mutationFn: () => deepDiveApi.reprocessEpisode(videoId!),
    onSuccess: () => setShowReprocessConfirm(false),
  });

  const queueInfo = data?.queue_info ?? null;
  const episode = data?.episode ?? null;
  const restaurants: any[] = data?.restaurants ?? [];
  const analysisFiles: any[] = data?.analysis_files ?? [];
  const transcript: string | null = data?.episode?.transcript ?? null;
  const pipelineLogs: any[] = data?.pipeline_logs ?? [];

  const overallStatus = queueInfo?.status ?? episode?.status ?? 'unknown';
  const statusCfg = STATUS_CONFIG[overallStatus] ?? STATUS_CONFIG.queued;
  const StatusIcon = statusCfg.icon;

  const videoUrl = episode?.video_url ?? (episode?.video_id ? `https://www.youtube.com/watch?v=${episode.video_id}` : null);

  return (
    <>
      <Dialog open={!!videoId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2 pr-8 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.badgeClass}`}>
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>
              <DialogTitle className="truncate text-base">
                {episode?.title ?? queueInfo?.video_title ?? 'Untitled Episode'}
              </DialogTitle>
            </div>
            <DialogDescription className="flex items-center gap-3 flex-wrap text-xs mt-1">
              <span>{episode?.channel_name ?? queueInfo?.channel_name ?? 'Unknown channel'}</span>
              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  YouTube
                </a>
              )}
              {episode?.video_id && (
                <span className="font-mono text-muted-foreground">{episode.video_id}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-muted-foreground">Failed to load episode details</p>
              </div>
            ) : (
              <Tabs defaultValue="pipeline" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="mx-6 mt-4 mb-0 shrink-0 justify-start">
                  <TabsTrigger value="pipeline">Pipeline Flow</TabsTrigger>
                  <TabsTrigger value="prompts">
                    Prompts & Responses
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

                {/* Tab: Pipeline Flow */}
                <TabsContent value="pipeline" className="flex-1 overflow-y-auto px-6 pb-6 space-y-5 mt-4">
                  <PipelineFlowDiagram detail={data} />

                  {/* Episode metadata */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    {[
                      { label: 'Video ID', value: episode?.video_id ?? '—' },
                      { label: 'Channel', value: episode?.channel_name ?? queueInfo?.channel_name ?? '—' },
                      { label: 'Language', value: episode?.language ?? '—' },
                      { label: 'Analysis Date', value: formatDate(episode?.analysis_date ?? null) },
                      { label: 'Priority', value: queueInfo?.priority ?? '—' },
                      { label: 'Attempts', value: queueInfo ? `${queueInfo.attempt_count ?? 0} / ${queueInfo.max_attempts ?? 3}` : '—' },
                      { label: 'Discovered', value: formatDate(queueInfo?.discovered_at ?? null) },
                      { label: 'Processing Started', value: formatDate(queueInfo?.processing_started_at ?? null) },
                      { label: 'Processing Completed', value: formatDate(queueInfo?.processing_completed_at ?? null) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-medium truncate">{String(value)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Error message */}
                  {queueInfo?.error_message && (
                    <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-3">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Last Error</p>
                      <p className="text-sm text-red-700 dark:text-red-400">{queueInfo.error_message}</p>
                    </div>
                  )}

                  {/* Pipeline logs timeline */}
                  {pipelineLogs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipeline Events</p>
                      <div className="relative border-l-2 border-border pl-4 space-y-3">
                        {pipelineLogs.map((log: any, i: number) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/40" />
                            <div className="flex items-start gap-3">
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                                {formatDate(log.timestamp)}
                              </span>
                              <div>
                                <span className={`text-[10px] font-semibold uppercase tracking-wide ${log.level === 'error' ? 'text-red-600' : log.level === 'warning' ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                                  {log.event_type ?? log.level}
                                </span>
                                {log.message && (
                                  <p className="text-xs text-foreground/80">{log.message}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Prompts & Responses */}
                <TabsContent value="prompts" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
                  {analysisFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                      <Brain className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No analysis files found for this episode</p>
                      <p className="text-xs text-muted-foreground/60">Analysis data is recorded after the AI processing step completes.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analysisFiles.map((run: any, i: number) => (
                        <AnalysisRunSection key={i} run={run} index={i} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Transcript */}
                <TabsContent value="transcript" className="flex-1 overflow-hidden flex flex-col px-6 pb-6 mt-4">
                  {transcript ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        {transcript.length.toLocaleString()} characters
                      </p>
                      <pre
                        className="flex-1 bg-muted/40 border rounded-md p-4 text-sm leading-relaxed font-mono whitespace-pre-wrap break-words overflow-y-auto"
                        dir="auto"
                        style={{ minHeight: 200, maxHeight: 'calc(92vh - 300px)' }}
                      >
                        {transcript}
                      </pre>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                      No transcript available
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Restaurants */}
                <TabsContent value="restaurants" className="flex-1 overflow-y-auto px-6 pb-6 mt-4">
                  {restaurants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                      <MapPin className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No restaurants extracted from this episode</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {restaurants.map((r: any, i: number) => {
                        const opinion = r.host_opinion ?? 'neutral';
                        const opinionCfg = OPINION_CONFIG[opinion] ?? OPINION_CONFIG.neutral;
                        return (
                          <div key={r.id ?? i} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <p className="font-semibold text-sm" dir="auto">
                                  {r.name_hebrew || r.name_english || 'Unnamed'}
                                </p>
                                {r.name_hebrew && r.name_english && (
                                  <p className="text-xs text-muted-foreground">{r.name_english}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${opinionCfg.badgeClass}`}>
                                  {opinionCfg.label}
                                </span>
                                {r.city && (
                                  <Badge variant="outline" className="text-[10px] h-5">{r.city}</Badge>
                                )}
                                {r.cuisine_type && (
                                  <Badge variant="secondary" className="text-[10px] h-5">{r.cuisine_type}</Badge>
                                )}
                                {r.status && (
                                  <Badge variant="outline" className="text-[10px] h-5">{r.status}</Badge>
                                )}
                                {r.confidence_level != null && (
                                  <Badge variant="outline" className="text-[10px] h-5 font-mono">
                                    {Math.round(r.confidence_level * 100)}%
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {r.host_comments && (
                              <p className="text-xs text-muted-foreground" dir="auto">{r.host_comments}</p>
                            )}

                            {r.engaging_quote && (
                              <p className="text-xs italic text-foreground/70 border-l-2 border-primary/30 pl-2" dir="auto">
                                "{r.engaging_quote}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row justify-between gap-3">
            <div className="flex items-center gap-2">
              {videoUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    YouTube
                  </a>
                </Button>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowReprocessConfirm(true)}
              disabled={reprocessMutation.isPending}
            >
              {reprocessMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Reprocess Episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprocess confirmation dialog */}
      <Dialog open={showReprocessConfirm} onOpenChange={setShowReprocessConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reprocess this episode?</DialogTitle>
            <DialogDescription>
              This will re-queue the video for processing. Existing data may be overwritten once
              processing completes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowReprocessConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reprocessMutation.mutate()}
              disabled={reprocessMutation.isPending}
            >
              {reprocessMutation.isPending ? 'Reprocessing...' : 'Reprocess'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
