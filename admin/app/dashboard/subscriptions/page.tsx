'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Rss, Pause, Play, RefreshCw, Trash2, ExternalLink, Edit2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Subscription {
  id: string;
  source_url: string;
  source_name: string;
  source_type: string;
  priority: number;
  check_interval_hours: number;
  is_active: boolean;
  last_checked_at?: string;
  next_check_at?: string;
  created_at: string;
  stats: {
    total_videos: number;
    total_restaurants: number;
    last_video_date?: string;
  };
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ priority: 3, check_interval_hours: 24 });

  // Add subscription form state
  const [newSubscription, setNewSubscription] = useState({
    source_url: '',
    source_name: '',
    priority: 3,
    check_interval_hours: 24,
  });

  // Fetch subscriptions with auto-refresh
  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionsApi.list(),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Add subscription mutation
  const addMutation = useMutation({
    mutationFn: (data: typeof newSubscription) => subscriptionsApi.add(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setAddDialogOpen(false);
      setNewSubscription({
        source_url: '',
        source_name: '',
        priority: 3,
        check_interval_hours: 24,
      });
    },
  });

  // Update subscription mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => subscriptionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setEditingId(null);
    },
  });

  // Delete subscription mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  // Pause subscription mutation
  const pauseMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  // Resume subscription mutation
  const resumeMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  // Check now mutation
  const checkMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.check(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(newSubscription);
  };

  const handleStartEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setEditFormData({
      priority: sub.priority,
      check_interval_hours: sub.check_interval_hours,
    });
  };

  const handleSaveEdit = (id: string) => {
    updateMutation.mutate({ id, data: editFormData });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // Group subscriptions by active status
  const activeSubscriptions = subscriptions?.filter(sub => sub.is_active) || [];
  const pausedSubscriptions = subscriptions?.filter(sub => !sub.is_active) || [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'bg-red-500';
    if (priority <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority === 1) return 'Critical';
    if (priority === 2) return 'High';
    if (priority === 3) return 'Medium';
    if (priority === 4) return 'Low';
    return 'Very Low';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Channel Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage YouTube channels to automatically track and process new videos
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddSubmit}>
              <DialogHeader>
                <DialogTitle>Add New Subscription</DialogTitle>
                <DialogDescription>
                  Subscribe to a YouTube channel to automatically process new videos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="source_url">YouTube Channel URL *</Label>
                  <Input
                    id="source_url"
                    placeholder="https://www.youtube.com/@channel or https://www.youtube.com/channel/..."
                    value={newSubscription.source_url}
                    onChange={(e) => setNewSubscription({ ...newSubscription, source_url: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_name">Channel Name (optional)</Label>
                  <Input
                    id="source_name"
                    placeholder="Will be auto-detected if left empty"
                    value={newSubscription.source_name}
                    onChange={(e) => setNewSubscription({ ...newSubscription, source_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newSubscription.priority.toString()}
                    onValueChange={(value) => setNewSubscription({ ...newSubscription, priority: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Critical</SelectItem>
                      <SelectItem value="2">2 - High</SelectItem>
                      <SelectItem value="3">3 - Medium</SelectItem>
                      <SelectItem value="4">4 - Low</SelectItem>
                      <SelectItem value="5">5 - Very Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="check_interval">Check Interval (hours)</Label>
                  <Input
                    id="check_interval"
                    type="number"
                    min="1"
                    max="168"
                    value={newSubscription.check_interval_hours}
                    onChange={(e) => setNewSubscription({ ...newSubscription, check_interval_hours: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to check for new videos (1-168 hours)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Adding...' : 'Add Subscription'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-2">Loading subscriptions...</p>
        </div>
      )}

      {/* Active Subscriptions */}
      {!isLoading && activeSubscriptions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Active Subscriptions ({activeSubscriptions.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeSubscriptions.map((sub) => (
              <Card key={sub.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Rss className="h-5 w-5 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{sub.source_name}</CardTitle>
                        <a
                          href={sub.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                        >
                          <span className="truncate">View channel</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                    {editingId === sub.id ? (
                      <Badge className={cn('shrink-0', getPriorityColor(editFormData.priority))}>
                        {getPriorityLabel(editFormData.priority)}
                      </Badge>
                    ) : (
                      <Badge className={cn('shrink-0', getPriorityColor(sub.priority))}>
                        {getPriorityLabel(sub.priority)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Videos</p>
                      <p className="font-medium">{sub.stats.total_videos}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Restaurants</p>
                      <p className="font-medium">{sub.stats.total_restaurants}</p>
                    </div>
                  </div>

                  {/* Edit form or info */}
                  {editingId === sub.id ? (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-xs">Priority</Label>
                        <Select
                          value={editFormData.priority.toString()}
                          onValueChange={(value) => setEditFormData({ ...editFormData, priority: parseInt(value) })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Critical</SelectItem>
                            <SelectItem value="2">2 - High</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - Low</SelectItem>
                            <SelectItem value="5">5 - Very Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Interval (hours)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="168"
                          className="h-8"
                          value={editFormData.check_interval_hours}
                          onChange={(e) => setEditFormData({ ...editFormData, check_interval_hours: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSaveEdit(sub.id)}
                          disabled={updateMutation.isPending}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Last checked */}
                      <div className="text-sm pt-2 border-t">
                        <p className="text-muted-foreground text-xs">Last checked</p>
                        <p className="font-medium">{formatDate(sub.last_checked_at)}</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Checks every {sub.check_interval_hours}h
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => checkMutation.mutate(sub.id)}
                          disabled={checkMutation.isPending}
                        >
                          <RefreshCw className={cn('h-3 w-3 mr-1', checkMutation.isPending && 'animate-spin')} />
                          Check Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(sub)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseMutation.mutate(sub.id)}
                          disabled={pauseMutation.isPending}
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Delete subscription to ${sub.source_name}?`)) {
                              deleteMutation.mutate(sub.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Paused Subscriptions */}
      {!isLoading && pausedSubscriptions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            Paused Subscriptions ({pausedSubscriptions.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pausedSubscriptions.map((sub) => (
              <Card key={sub.id} className="relative opacity-60">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Rss className="h-5 w-5 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{sub.source_name}</CardTitle>
                        <a
                          href={sub.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                        >
                          <span className="truncate">View channel</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">Paused</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Videos</p>
                      <p className="font-medium">{sub.stats.total_videos}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Restaurants</p>
                      <p className="font-medium">{sub.stats.total_restaurants}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => resumeMutation.mutate(sub.id)}
                      disabled={resumeMutation.isPending}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Delete subscription to ${sub.source_name}?`)) {
                          deleteMutation.mutate(sub.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && subscriptions && subscriptions.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Rss className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No subscriptions yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first YouTube channel subscription to start automatically tracking new videos
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Subscription
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
