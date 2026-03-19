'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, subscriptionsApi } from '@/lib/api';
import { queryKeys, REFETCH_INTERVALS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RotateCcw,
  AlertCircle,
  RefreshCw,
  Clock,
  Radio,
  Rss,
  Play,
  Zap,
  ChevronDown,
  Layers,
} from 'lucide-react';
import type { PipelineOverview, PipelineStats, QueueItem, HistoryItem, SubscriptionDetail } from '@/types';
import { PipelineFlow } from '@/components/pipeline/pipeline-flow';
import { NowProcessing } from '@/components/pipeline/now-processing';
import { QueueTable } from '@/components/pipeline/queue-table';
import { FailedItems } from '@/components/pipeline/failed-items';
import { AnalyzeInput } from '@/components/pipeline/analyze-input';
import { AllVideosTable } from '@/components/pipeline/all-videos-table';
import { VideoDetailDialog } from '@/components/pipeline/video-detail-dialog';
import Link from 'next/link';

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch subscriptions for the selector
  const { data: subsData } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionsApi.list(),
    staleTime: 60_000,
  });
  const subscriptions: SubscriptionDetail[] = subsData?.subscriptions ?? [];

  const selectedSub = subscriptions.find((s) => s.id === selectedSubscriptionId) ?? null;

  // Fetch health/scheduler info
  const { data: healthData } = useQuery({
    queryKey: ['pipeline-health'],
    queryFn: () => pipelineApi.getHealth(),
    refetchInterval: REFETCH_INTERVALS.pipeline,
  });

  // Fetch overview
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: queryKeys.pipeline.overview(),
    queryFn: () => pipelineApi.getOverview(),
    refetchInterval: REFETCH_INTERVALS.pipeline,
  });
  const overview: PipelineOverview | null = overviewData?.overview ?? null;

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.pipeline.stats(),
    queryFn: () => pipelineApi.getStats(),
    refetchInterval: REFETCH_INTERVALS.pipelineHistory,
  });
  const stats: PipelineStats | null = statsData?.stats ?? null;

  // Fetch queue
  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: queryKeys.pipeline.queue(1),
    queryFn: () => pipelineApi.getQueue(1, 100),
    refetchInterval: REFETCH_INTERVALS.pipeline,
  });

  // Fetch history (for failed items)
  const { data: historyData } = useQuery({
    queryKey: queryKeys.pipeline.history(1),
    queryFn: () => pipelineApi.getHistory(1, 50),
    refetchInterval: REFETCH_INTERVALS.pipelineHistory,
  });

  const allQueueItems: QueueItem[] = queueData?.queue ?? queueData?.items ?? [];
  const processingItems = allQueueItems.filter((item) => item.status === 'processing');
  const pendingItems = allQueueItems.filter((item) => item.status === 'queued');

  const failedItems = (historyData?.history ?? historyData?.items ?? [])
    .filter((item: HistoryItem) => item.status === 'failed') as unknown as QueueItem[];

  // Retry all failed
  const retryAllFailedMutation = useMutation({
    mutationFn: () => pipelineApi.retryAllFailed(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    },
  });

  // Poll now
  const pollNowMutation = useMutation({
    mutationFn: () => pipelineApi.schedulerPollNow(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    },
  });

  // Process now
  const processNowMutation = useMutation({
    mutationFn: () => pipelineApi.schedulerProcessNow(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    },
  });

  // Scheduler start/stop
  const schedulerStartMutation = useMutation({
    mutationFn: () => pipelineApi.schedulerStart(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-health'] });
    },
  });
  const schedulerStopMutation = useMutation({
    mutationFn: () => pipelineApi.schedulerStop(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-health'] });
    },
  });

  const handleQueueAction = async (id: string, action: 'prioritize' | 'skip' | 'remove') => {
    const key = `${id}-${action}`;
    setActionLoading(key);
    try {
      const actionMap = {
        prioritize: pipelineApi.prioritize,
        skip: pipelineApi.skip,
        remove: pipelineApi.remove,
      };
      await actionMap[action](id);
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFailedAction = async (id: string, action: 'retry' | 'remove') => {
    const key = `${id}-${action}`;
    setActionLoading(key);
    try {
      if (action === 'retry') await pipelineApi.retry(id);
      else await pipelineApi.remove(id);
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    } finally {
      setActionLoading(null);
    }
  };

  const failedCount = overview?.failed_24h ?? overview?.failed ?? failedItems.length;
  const schedulerRunning = healthData?.pipeline?.running ?? false;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Track videos from discovery through analysis — last 3 months
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pollNowMutation.mutate()}
            disabled={pollNowMutation.isPending}
            title="Check YouTube for new videos now"
          >
            {pollNowMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rss className="h-4 w-4 mr-2" />
            )}
            Poll Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => processNowMutation.mutate()}
            disabled={processNowMutation.isPending || (overview?.queued ?? 0) === 0}
            title="Process the next queued video now"
          >
            {processNowMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Process Next
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => retryAllFailedMutation.mutate()}
            disabled={retryAllFailedMutation.isPending || !failedCount}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry Failed
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/pipeline/logs">
              <AlertCircle className="h-4 w-4 mr-2" />
              Logs
            </Link>
          </Button>
        </div>
      </div>

      {/* Scheduler Status Bar */}
      <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-2.5 text-sm">
        <button
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          onClick={() =>
            schedulerRunning ? schedulerStopMutation.mutate() : schedulerStartMutation.mutate()
          }
          disabled={schedulerStartMutation.isPending || schedulerStopMutation.isPending}
          title={schedulerRunning ? 'Click to stop scheduler' : 'Click to start scheduler'}
        >
          <Radio className={`h-3.5 w-3.5 ${schedulerRunning ? 'text-green-500' : 'text-red-500'}`} />
          <span className="font-medium">
            Scheduler {schedulerRunning ? 'Active' : 'Stopped'}
          </span>
        </button>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Next poll:{' '}
            {healthData?.pipeline?.next_poll_at
              ? new Date(healthData.pipeline.next_poll_at).toLocaleString()
              : 'N/A'}
          </span>
        </div>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          <span>
            Next process:{' '}
            {healthData?.pipeline?.next_process_at
              ? new Date(healthData.pipeline.next_process_at).toLocaleString()
              : 'N/A'}
          </span>
        </div>
        {healthData?.pipeline && (
          <>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              Queue depth: <strong className="text-foreground">{healthData.pipeline.queue_depth}</strong>
            </span>
          </>
        )}
      </div>

      {/* Subscription Selector */}
      <div className="relative">
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm hover:bg-muted/50 transition-colors w-full max-w-md"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left truncate">
            {selectedSub ? selectedSub.source_name : 'All Subscriptions'}
          </span>
          {selectedSub && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {selectedSub.total_videos_processed}/{selectedSub.total_videos_found} processed
            </Badge>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute z-20 mt-1 w-full max-w-md rounded-lg border bg-card shadow-lg">
            <button
              className={`flex items-center gap-2 px-3 py-2 text-sm w-full hover:bg-muted/50 transition-colors ${
                !selectedSubscriptionId ? 'bg-muted/30 font-medium' : ''
              }`}
              onClick={() => {
                setSelectedSubscriptionId(null);
                setDropdownOpen(false);
              }}
            >
              All Subscriptions
            </button>
            {subscriptions.map((sub) => (
              <button
                key={sub.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm w-full hover:bg-muted/50 transition-colors ${
                  selectedSubscriptionId === sub.id ? 'bg-muted/30 font-medium' : ''
                }`}
                onClick={() => {
                  setSelectedSubscriptionId(sub.id);
                  setDropdownOpen(false);
                }}
              >
                <span className="truncate">{sub.source_name || sub.source_id}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {sub.total_restaurants_found}R / {sub.total_videos_processed}V
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Subscription Info Card */}
      {selectedSub && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">{selectedSub.source_name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedSub.source_type} &middot; {selectedSub.source_id}
              </p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <div>
                <span className="text-foreground font-semibold">{selectedSub.total_videos_found}</span> discovered
              </div>
              <div>
                <span className="text-foreground font-semibold">{selectedSub.total_videos_processed}</span> processed
              </div>
              <div>
                <span className="text-foreground font-semibold">{selectedSub.total_restaurants_found}</span> restaurants
              </div>
              <div>
                Last polled: {selectedSub.last_checked_at
                  ? new Date(selectedSub.last_checked_at).toLocaleString()
                  : 'Never'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Flow Visualization */}
      <PipelineFlow overview={overview} stats={stats} />

      {/* Tabs */}
      <Tabs defaultValue="all-videos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all-videos">
            All Videos
            {(overview?.total ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                {overview?.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overview">
            Queue & Processing
            {(overview?.processing ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                {overview?.processing}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Link href="/dashboard/pipeline/logs" className="flex items-center">
              Logs
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* All Videos Tab (now default) */}
        <TabsContent value="all-videos">
          <AllVideosTable subscriptionId={selectedSubscriptionId} />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-5">
          {/* Now Processing */}
          <NowProcessing overview={overview} processingItems={processingItems} />

          {/* Queue Table */}
          <QueueTable
            items={pendingItems}
            isLoading={queueLoading}
            actionLoading={actionLoading}
            onAction={handleQueueAction}
            onItemClick={setSelectedQueueId}
            onRefresh={() => refetchQueue()}
          />

          {/* Failed Items */}
          <FailedItems
            items={failedItems}
            actionLoading={actionLoading}
            onAction={handleFailedAction}
          />

          {/* Analyze Input */}
          <AnalyzeInput />
        </TabsContent>

        {/* Logs Tab - redirects to logs sub-page */}
        <TabsContent value="logs">
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Redirecting to logs page...</p>
          </div>
        </TabsContent>
      </Tabs>

      <VideoDetailDialog
        queueId={selectedQueueId}
        onClose={() => setSelectedQueueId(null)}
      />
    </div>
  );
}
