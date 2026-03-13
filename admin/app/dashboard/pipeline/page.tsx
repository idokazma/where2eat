'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi } from '@/lib/api';
import { queryKeys, REFETCH_INTERVALS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCcw, AlertCircle, RefreshCw, Clock, Radio } from 'lucide-react';
import type { PipelineOverview, PipelineStats, QueueItem, HistoryItem } from '@/types';
import { StatusStrip } from '@/components/pipeline/status-strip';
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
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => retryAllFailedMutation.mutate()}
            disabled={retryAllFailedMutation.isPending || !failedCount}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry All Failed
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/pipeline/logs">
              <AlertCircle className="h-4 w-4 mr-2" />
              View Logs
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Strip */}
      <StatusStrip
        overview={overview}
        stats={stats}
        isLoading={overviewLoading || statsLoading}
      />

      {/* Scheduler Status */}
      {healthData?.pipeline && (
        <div className="flex items-center gap-4 rounded-lg border bg-card p-3 text-sm">
          <div className="flex items-center gap-1.5">
            <Radio className={`h-3.5 w-3.5 ${healthData.pipeline.running ? 'text-green-500' : 'text-red-500'}`} />
            <span className="font-medium">
              Scheduler {healthData.pipeline.running ? 'Active' : 'Stopped'}
            </span>
          </div>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Next poll: {healthData.pipeline.next_poll_at
              ? new Date(healthData.pipeline.next_poll_at).toLocaleString()
              : 'N/A'}</span>
          </div>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Next process: {healthData.pipeline.next_process_at
              ? new Date(healthData.pipeline.next_process_at).toLocaleString()
              : 'N/A'}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            Overview
            {(overview?.processing ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                {overview?.processing}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all-videos">All Videos</TabsTrigger>
          <TabsTrigger value="logs">
            <Link href="/dashboard/pipeline/logs" className="flex items-center">
              Logs
            </Link>
          </TabsTrigger>
        </TabsList>

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

        {/* All Videos Tab */}
        <TabsContent value="all-videos">
          <AllVideosTable />
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
