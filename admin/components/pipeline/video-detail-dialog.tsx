'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pipelineApi, type VideoDetail } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  SkipForward,
  ExternalLink,
  FileText,
  Search,
  AlertTriangle,
} from 'lucide-react';

interface VideoDetailDialogProps {
  queueId: string | null;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  queued: { label: 'Queued', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
  skipped: { label: 'Skipped', color: 'bg-gray-100 text-gray-800', icon: SkipForward },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

function HighlightedText({ text, search }: { text: string; search: string }) {
  if (!search.trim()) {
    return <>{text}</>;
  }

  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function VideoDetailDialog({ queueId, onClose }: VideoDetailDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery<VideoDetail>({
    queryKey: ['pipeline-detail', queueId],
    queryFn: () => pipelineApi.getVideoDetail(queueId!),
    enabled: !!queueId,
  });

  const matchCount = useMemo(() => {
    if (!data?.transcript || !searchTerm.trim()) return 0;
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (data.transcript.match(new RegExp(escaped, 'gi')) || []).length;
  }, [data?.transcript, searchTerm]);

  const item = data?.queue_item;
  const status = item ? statusConfig[item.status] || statusConfig.queued : null;
  const hasTranscript = !!data?.transcript;
  const hasErrors = !!(item?.error_log && item.error_log.length > 0) || !!item?.error_message;
  const hasResults = !!(data?.restaurants?.length || data?.episode?.episode_summary);

  const defaultTab = hasTranscript ? 'transcript' : hasErrors ? 'errors' : 'overview';

  return (
    <Dialog open={!!queueId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-muted-foreground">
            Failed to load video details
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 pr-8">
                {status && (
                  <Badge className={status.color}>{status.label}</Badge>
                )}
                <DialogTitle className="truncate">
                  {item?.video_title || 'Untitled'}
                </DialogTitle>
              </div>
              <DialogDescription className="flex items-center gap-2">
                {item?.channel_name || 'Unknown channel'}
                {item?.video_id && (
                  <a
                    href={`https://www.youtube.com/watch?v=${item.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    YouTube
                  </a>
                )}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue={defaultTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transcript" disabled={!hasTranscript}>
                  <FileText className="h-3 w-3 mr-1" />
                  Transcript
                  {hasTranscript && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({Math.round(data.transcript_length / 1000)}k chars)
                    </span>
                  )}
                </TabsTrigger>
                {hasResults && (
                  <TabsTrigger value="results">
                    Results ({data.restaurants?.length || 0})
                  </TabsTrigger>
                )}
                {hasErrors && (
                  <TabsTrigger value="errors">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Errors
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="overflow-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{status?.label}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <p className="font-medium">{item?.priority}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Attempts</p>
                    <p className="font-medium">{item?.attempt_count} / {item?.max_attempts}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Restaurants Found</p>
                    <p className="font-medium">{item?.restaurants_found || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Discovered</p>
                    <p className="text-sm">{formatDate(item?.discovered_at || null)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Scheduled For</p>
                    <p className="text-sm">{formatDate(item?.scheduled_for || null)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Processing Started</p>
                    <p className="text-sm">{formatDate(item?.processing_started_at || null)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Processing Completed</p>
                    <p className="text-sm">{formatDate(item?.processing_completed_at || null)}</p>
                  </div>
                </div>

                {data.episode && (
                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-medium text-sm">Episode Info</h4>
                    {data.episode.title && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Title</p>
                        <p className="text-sm">{data.episode.title}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Language</p>
                      <p className="text-sm">{data.episode.language}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Analysis Date</p>
                      <p className="text-sm">{formatDate(data.episode.analysis_date)}</p>
                    </div>
                    {hasTranscript && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Transcript Length</p>
                        <p className="text-sm">{data.transcript_length.toLocaleString()} characters</p>
                      </div>
                    )}
                  </div>
                )}

                {item?.error_message && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-sm text-red-600 mb-2">Last Error</h4>
                    <p className="text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded text-red-700 dark:text-red-400">
                      {item.error_message}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Transcript Tab */}
              <TabsContent value="transcript" className="flex-1 overflow-hidden flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search in transcript..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                  {searchTerm && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {matchCount} match{matchCount !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
                <div
                  className="flex-1 overflow-auto bg-muted/30 border rounded-md p-4 text-sm leading-relaxed whitespace-pre-wrap"
                  dir="auto"
                  style={{ minHeight: 200, maxHeight: 'calc(90vh - 280px)' }}
                >
                  {data?.transcript ? (
                    <HighlightedText text={data.transcript} search={searchTerm} />
                  ) : (
                    <p className="text-muted-foreground">No transcript available</p>
                  )}
                </div>
              </TabsContent>

              {/* Results Tab */}
              {hasResults && (
                <TabsContent value="results" className="overflow-auto space-y-4">
                  {data.episode?.episode_summary && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Episode Summary</h4>
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded" dir="auto">
                        {data.episode.episode_summary}
                      </p>
                    </div>
                  )}

                  {data.episode?.food_trends && data.episode.food_trends.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Food Trends</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {data.episode.food_trends.map((trend, i) => (
                          <Badge key={i} variant="secondary">{trend}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.restaurants && data.restaurants.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">
                        Restaurants Found ({data.restaurants.length})
                      </h4>
                      <div className="space-y-2">
                        {data.restaurants.map((r, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded border">
                            <div>
                              <p className="font-medium text-sm" dir="auto">{r.name_hebrew}</p>
                              {r.name_english && (
                                <p className="text-xs text-muted-foreground">{r.name_english}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {r.city && (
                                <Badge variant="outline" className="text-xs">{r.city}</Badge>
                              )}
                              {r.cuisine_type && (
                                <Badge variant="secondary" className="text-xs">{r.cuisine_type}</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Errors Tab */}
              {hasErrors && (
                <TabsContent value="errors" className="overflow-auto space-y-3">
                  {item?.error_log && Array.isArray(item.error_log) ? (
                    item.error_log.map((entry, i) => (
                      <div
                        key={i}
                        className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs text-red-700">
                            Attempt {entry.attempt}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-red-700 dark:text-red-400">
                          {entry.message}
                        </p>
                      </div>
                    ))
                  ) : item?.error_message ? (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded">
                      <p className="text-sm text-red-700 dark:text-red-400">
                        {item.error_message}
                      </p>
                    </div>
                  ) : null}
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
