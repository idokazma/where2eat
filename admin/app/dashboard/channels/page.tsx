'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelsApi, pipelineApi, MonitoredChannel, PipelineStatus } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus, Radio, RefreshCw, Trash2, Loader2, CheckCircle,
  XCircle, Clock, Power, PowerOff, Settings, Play, Timer
} from 'lucide-react';

const INTERVAL_OPTIONS = [
  { value: 60, label: '1 hour', ms: 3600000 },
  { value: 180, label: '3 hours', ms: 10800000 },
  { value: 360, label: '6 hours', ms: 21600000 },
  { value: 720, label: '12 hours', ms: 43200000 },
  { value: 1440, label: '24 hours', ms: 86400000 },
];

const POLL_INTERVAL_OPTIONS = [
  { ms: 3600000, label: '1 hour' },
  { ms: 7200000, label: '2 hours' },
  { ms: 10800000, label: '3 hours' },
  { ms: 21600000, label: '6 hours' },
  { ms: 43200000, label: '12 hours' },
  { ms: 86400000, label: '24 hours' },
];

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatCountdown(dateStr: string | null) {
  if (!dateStr) return '--';
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'Now';
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ${diffSecs % 60}s`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ${diffMins % 60}m`;
}

function formatMs(ms: number) {
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}m`;
  return `${ms / 3600000}h`;
}

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [channelUrl, setChannelUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [pollInterval, setPollInterval] = useState(360);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPollInterval, setSettingsPollInterval] = useState(3600000);
  const [, setTick] = useState(0);

  // Tick every second to update countdowns
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.list(),
    refetchInterval: 30000,
  });

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: () => pipelineApi.schedulerStatus(),
    refetchInterval: 5000,
  });

  // Sync settings state when status loads
  useEffect(() => {
    if (pipelineStatus?.poll_interval_ms) {
      setSettingsPollInterval(pipelineStatus.poll_interval_ms);
    }
  }, [pipelineStatus?.poll_interval_ms]);

  const addChannelMutation = useMutation({
    mutationFn: (data: { channel_url: string; channel_name?: string; poll_interval_minutes: number }) =>
      channelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setChannelUrl('');
      setChannelName('');
      setPollInterval(360);
      setShowAddForm(false);
    },
  });

  const updateChannelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => channelsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] }),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (id: string) => channelsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] }),
  });

  const pollChannelMutation = useMutation({
    mutationFn: (id: string) => channelsApi.poll(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-status'] });
    },
  });

  const startPipelineMutation = useMutation({
    mutationFn: () => pipelineApi.schedulerStart(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-status'] }),
  });

  const stopPipelineMutation = useMutation({
    mutationFn: () => pipelineApi.schedulerStop(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-status'] }),
  });

  const pollNowMutation = useMutation({
    mutationFn: () => pipelineApi.schedulerPollNow(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-status'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: { poll_interval_ms?: number }) => pipelineApi.schedulerUpdateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-status'] });
      setShowSettings(false);
    },
  });

  const channels = data?.channels || [];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelUrl.trim()) {
      addChannelMutation.mutate({
        channel_url: channelUrl,
        channel_name: channelName || undefined,
        poll_interval_minutes: pollInterval,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Channel Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Monitor YouTube channels for new restaurant videos
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {/* Scheduler Control Card */}
      <Card className={pipelineStatus?.enabled ? 'border-green-200' : 'border-yellow-200'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${pipelineStatus?.enabled ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <CardTitle className="text-lg">
                Scheduler {pipelineStatus?.enabled ? 'Running' : 'Stopped'}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pollNowMutation.mutate()}
                disabled={pollNowMutation.isPending}
              >
                {pollNowMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Poll Now
              </Button>
              {pipelineStatus?.enabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stopPipelineMutation.mutate()}
                  disabled={stopPipelineMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <PowerOff className="h-4 w-4 mr-1" />
                  Disable
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => startPipelineMutation.mutate()}
                  disabled={startPipelineMutation.isPending}
                >
                  <Power className="h-4 w-4 mr-1" />
                  Enable
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Status metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last Poll</p>
              <p className="text-sm font-medium">{formatTimeAgo(pipelineStatus?.last_poll_at ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Next Poll</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {pipelineStatus?.enabled ? formatCountdown(pipelineStatus?.next_poll_at ?? null) : '--'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Poll Interval</p>
              <p className="text-sm font-medium">{formatMs(pipelineStatus?.poll_interval_ms ?? 3600000)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Polls</p>
              <p className="text-sm font-medium">{pipelineStatus?.stats.polls_completed ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Jobs Processed</p>
              <p className="text-sm font-medium">
                {pipelineStatus?.stats.jobs_processed ?? 0}
                {(pipelineStatus?.stats.errors ?? 0) > 0 && (
                  <span className="text-red-500 ml-1">({pipelineStatus?.stats.errors} errors)</span>
                )}
              </p>
            </div>
          </div>

          {/* Live activity indicators */}
          {(pipelineStatus?.is_polling || pipelineStatus?.is_processing) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t">
              {pipelineStatus.is_polling && (
                <span className="text-blue-600 flex items-center gap-1 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" /> Polling channels...
                </span>
              )}
              {pipelineStatus.is_processing && (
                <span className="text-blue-600 flex items-center gap-1 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" /> Processing queue...
                </span>
              )}
            </div>
          )}

          {/* Settings panel */}
          {showSettings && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-end gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Poll Interval</label>
                  <select
                    value={settingsPollInterval}
                    onChange={(e) => setSettingsPollInterval(Number(e.target.value))}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {POLL_INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.ms} value={opt.ms}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  onClick={() => updateSettingsMutation.mutate({ poll_interval_ms: settingsPollInterval })}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Channel Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add YouTube Channel</CardTitle>
            <CardDescription>Enter a YouTube channel URL to monitor for new videos</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="https://www.youtube.com/@channelname"
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Channel name (optional)"
                  className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <select
                  value={pollInterval}
                  onChange={(e) => setPollInterval(Number(e.target.value))}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={addChannelMutation.isPending}>
                  {addChannelMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Channel'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
              {addChannelMutation.isError && (
                <p className="text-sm text-destructive">
                  Failed to add channel. Please check the URL and try again.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Channels List */}
      <Card>
        <CardHeader>
          <CardTitle>Monitored Channels ({channels.length})</CardTitle>
          <CardDescription>YouTube channels being monitored for new content</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading channels. Please try again.
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-12">
              <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No channels being monitored</p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Channel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {channels.map((channel: MonitoredChannel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {channel.enabled ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">
                          {channel.channel_name || channel.channel_id}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          channel.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {channel.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{channel.channel_url}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Poll: every {
                          INTERVAL_OPTIONS.find(o => o.value === channel.poll_interval_minutes)?.label ||
                          `${channel.poll_interval_minutes}m`
                        }</span>
                        <span>Last polled: {formatTimeAgo(channel.last_polled_at)}</span>
                        <span>Videos found: {channel.total_videos_found}</span>
                        {channel.last_video_found_at && (
                          <span>Last new video: {formatTimeAgo(channel.last_video_found_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pollChannelMutation.mutate(channel.id)}
                      disabled={pollChannelMutation.isPending}
                    >
                      {pollChannelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Poll Now
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateChannelMutation.mutate({
                          id: channel.id,
                          data: { enabled: channel.enabled ? 0 : 1 },
                        });
                      }}
                    >
                      {channel.enabled ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('Remove this channel from monitoring?')) {
                          deleteChannelMutation.mutate(channel.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
