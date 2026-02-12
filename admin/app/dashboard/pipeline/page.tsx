'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  SkipForward,
  ArrowUp,
  Trash2,
  RotateCcw,
  ExternalLink,
  Video,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { VideoDetailDialog } from '@/components/pipeline/video-detail-dialog';

interface PipelineOverview {
  queued: number;
  processing: number;
  processed_24h: number;
  failed_24h: number;
  currently_processing?: {
    id: string;
    video_id: string;
    video_title: string;
    channel_name: string;
    started_at: string;
    step: string;
  };
}

interface QueueItem {
  id: string;
  video_id: string;
  video_title: string;
  channel_name: string;
  priority: number;
  scheduled_at: string;
  subscription_id?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

interface HistoryItem {
  id: string;
  video_id: string;
  video_title: string;
  channel_name: string;
  status: 'completed' | 'failed';
  completed_at: string;
  error_message?: string;
  results?: {
    restaurants_found: number;
    processing_time_seconds: number;
  };
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [queuePage, setQueuePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);

  // Fetch overview with auto-refresh
  const { data: overview, isLoading: overviewLoading } = useQuery<PipelineOverview>({
    queryKey: ['pipeline-overview'],
    queryFn: () => pipelineApi.getOverview(),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch queue
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['pipeline-queue', queuePage],
    queryFn: () => pipelineApi.getQueue(queuePage, 20),
    refetchInterval: 10000,
  });

  // Fetch history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['pipeline-history', historyPage],
    queryFn: () => pipelineApi.getHistory(historyPage, 20),
    refetchInterval: 30000, // Slower refresh for history
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => pipelineApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-overview'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
    },
  });

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: (id: string) => pipelineApi.skip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-overview'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-queue'] });
    },
  });

  // Prioritize mutation
  const prioritizeMutation = useMutation({
    mutationFn: (id: string) => pipelineApi.prioritize(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-queue'] });
    },
  });

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: (id: string) => pipelineApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-overview'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-queue'] });
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'bg-red-500';
    if (priority <= 4) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Real-time view of video processing queue and activity
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/pipeline/logs">
            <AlertCircle className="h-4 w-4 mr-2" />
            View Logs
          </Link>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queued</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.queued || 0}</div>
            <p className="text-xs text-muted-foreground">Videos waiting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.processing || 0}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed (24h)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.processed_24h || 0}</div>
            <p className="text-xs text-muted-foreground">Completed today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed (24h)</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.failed_24h || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Currently Processing */}
      {overview?.currently_processing && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
              Currently Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <h3 className="font-medium truncate">{overview.currently_processing.video_title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{overview.currently_processing.channel_name}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Started {formatDate(overview.currently_processing.started_at)}</span>
                  <Badge variant="outline" className="font-normal">
                    {overview.currently_processing.step}
                  </Badge>
                </div>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${overview.currently_processing.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Queue and Recent Activity */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Queue ({queueData?.total || 0})</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          {queueLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading queue...</p>
            </div>
          ) : queueData?.items && queueData.items.length > 0 ? (
            <>
              <div className="space-y-3">
                {queueData.items.map((item: QueueItem) => (
                  <Card key={item.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedQueueId(item.id)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn('h-2 w-2 rounded-full shrink-0', getPriorityColor(item.priority))} />
                            <h3 className="font-medium truncate">{item.video_title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{item.channel_name}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Scheduled {formatDate(item.scheduled_at)}</span>
                            <Badge variant="secondary" className="font-normal">
                              Priority {item.priority}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => prioritizeMutation.mutate(item.id)}
                            disabled={prioritizeMutation.isPending}
                            title="Move to front of queue"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm('Skip this video?')) {
                                skipMutation.mutate(item.id);
                              }
                            }}
                            disabled={skipMutation.isPending}
                            title="Skip this video"
                          >
                            <SkipForward className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Remove from queue?')) {
                                removeMutation.mutate(item.id);
                              }
                            }}
                            disabled={removeMutation.isPending}
                            title="Remove from queue"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <a
                            href={`https://www.youtube.com/watch?v=${item.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                            title="View on YouTube"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {queueData.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                    disabled={queuePage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {queuePage} of {queueData.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQueuePage(p => Math.min(queueData.total_pages, p + 1))}
                    disabled={queuePage === queueData.total_pages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Queue is empty</h3>
                <p className="text-muted-foreground">
                  No videos currently queued for processing
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          {historyLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading history...</p>
            </div>
          ) : historyData?.items && historyData.items.length > 0 ? (
            <>
              <div className="space-y-3">
                {historyData.items.map((item: HistoryItem) => (
                  <Card key={item.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedQueueId(item.id)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {item.status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                            )}
                            <h3 className="font-medium truncate">{item.video_title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{item.channel_name}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{formatDate(item.completed_at)}</span>
                            {item.status === 'completed' && item.results && (
                              <>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {item.results.restaurants_found} restaurants
                                </span>
                                <span>{formatDuration(item.results.processing_time_seconds)}</span>
                              </>
                            )}
                          </div>
                          {item.error_message && (
                            <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                              {item.error_message}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {item.status === 'failed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryMutation.mutate(item.id)}
                              disabled={retryMutation.isPending}
                              title="Retry processing"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                          <a
                            href={`https://www.youtube.com/watch?v=${item.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                            title="View on YouTube"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {historyData.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {historyPage} of {historyData.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage(p => Math.min(historyData.total_pages, p + 1))}
                    disabled={historyPage === historyData.total_pages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No recent activity</h3>
                <p className="text-muted-foreground">
                  Processing history will appear here
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <VideoDetailDialog
        queueId={selectedQueueId}
        onClose={() => setSelectedQueueId(null)}
      />
    </div>
  );
}
