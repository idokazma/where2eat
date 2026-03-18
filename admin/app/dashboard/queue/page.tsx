'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queueApi, pipelineApi, QueueJob } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ListOrdered, Play, Loader2, CheckCircle, XCircle, Clock,
  AlertCircle, Trash2, RotateCcw
} from 'lucide-react';

export default function QueuePage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: statsData } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => queueApi.stats(),
    refetchInterval: 5000,
  });

  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['queue-jobs', statusFilter],
    queryFn: () => queueApi.list({ status: statusFilter || undefined, limit: 50 }),
    refetchInterval: 5000,
  });

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: () => pipelineApi.status(),
    refetchInterval: 10000,
  });

  const processNextMutation = useMutation({
    mutationFn: () => queueApi.processNext(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: (id: string) => queueApi.deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const jobs = jobsData?.jobs || [];
  const stats = statsData || { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'processing': return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default: return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const statCards = [
    { label: 'Pending', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock },
    { label: 'Processing', value: stats.processing, color: 'text-blue-600', bg: 'bg-blue-50', icon: Loader2 },
    { label: 'Completed', value: stats.completed, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
    { label: 'Failed', value: stats.failed, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
  ];

  const filterTabs = [
    { label: 'All', value: '', count: stats.total },
    { label: 'Pending', value: 'pending', count: stats.pending },
    { label: 'Processing', value: 'processing', count: stats.processing },
    { label: 'Completed', value: 'completed', count: stats.completed },
    { label: 'Failed', value: 'failed', count: stats.failed },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processing Queue</h1>
          <p className="text-muted-foreground mt-1">
            Video analysis jobs and processing status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => processNextMutation.mutate()}
            disabled={processNextMutation.isPending || stats.pending === 0}
          >
            {processNextMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Process Next
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={stat.bg}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${stat.color} opacity-50`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-muted">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>
            {statusFilter ? `Showing ${statusFilter} jobs` : 'All processing jobs'}
            {' '}(auto-refreshes every 5s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading queue. Please try again.
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <ListOrdered className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {statusFilter ? `No ${statusFilter} jobs` : 'Queue is empty'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job: QueueJob) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">{getStatusIcon(job.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-sm">
                          {job.video_url || job.channel_url || 'Unknown'}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {job.job_type}
                        </span>
                      </div>
                      {job.current_step && (
                        <p className="text-sm text-blue-600 mb-1">{job.current_step}</p>
                      )}
                      {job.error_message && (
                        <p className="text-sm text-red-600 mb-1 truncate max-w-lg">{job.error_message}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created: {new Date(job.created_at).toLocaleString()}</span>
                        {job.started_at && <span>Started: {new Date(job.started_at).toLocaleString()}</span>}
                        {job.completed_at && <span>Finished: {new Date(job.completed_at).toLocaleString()}</span>}
                        {job.progress_restaurants_found > 0 && (
                          <span className="text-green-600">
                            {job.progress_restaurants_found} restaurants found
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {job.status === 'pending' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this job?')) {
                            deleteJobMutation.mutate(job.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
