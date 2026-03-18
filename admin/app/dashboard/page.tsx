'use client';

import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, pipelineApi } from '@/lib/api';
import { queryKeys, REFETCH_INTERVALS } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { StatusStrip } from '@/components/pipeline/status-strip';
import { UtensilsCrossed, Video, FileText, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Fetch overview analytics
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: queryKeys.analytics.overview(),
    queryFn: () => analyticsApi.getOverview(),
    refetchInterval: REFETCH_INTERVALS.analytics,
  });

  // Fetch restaurant analytics for sparklines
  const { data: restaurantAnalytics } = useQuery({
    queryKey: queryKeys.analytics.restaurants('7'),
    queryFn: () => analyticsApi.getRestaurants({ period: '7' }),
  });

  // Fetch pipeline overview for quick-status widget
  const { data: pipelineOverview, isLoading: pipelineLoading } = useQuery({
    queryKey: queryKeys.pipeline.overview(),
    queryFn: () => pipelineApi.getOverview(),
    refetchInterval: REFETCH_INTERVALS.pipeline,
  });

  // Fetch pipeline stats
  const { data: pipelineStats } = useQuery({
    queryKey: queryKeys.pipeline.stats(),
    queryFn: () => pipelineApi.getStats(),
    refetchInterval: REFETCH_INTERVALS.pipelineHistory,
  });

  // Prepare sparkline data from growth data
  const sparklineData = restaurantAnalytics?.growthData?.slice(-7).map((d: any) => ({
    value: d.count || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening with Where2Eat today.
        </p>
      </div>

      {/* Pipeline Status Strip */}
      <StatusStrip
        overview={pipelineOverview?.overview ?? null}
        stats={pipelineStats?.stats ?? null}
        restaurantCount={overview?.overview?.totalRestaurants}
        isLoading={pipelineLoading}
      />

      {/* Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {overviewLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              title="Total Restaurants"
              value={overview?.overview.totalRestaurants.toLocaleString() || '0'}
              trend={overview?.overview.trend}
              trendData={sparklineData}
              icon={<UtensilsCrossed className="h-4 w-4" />}
              href="/dashboard/restaurants"
            />

            <MetricCard
              title="Videos Processed"
              value={overview?.videos.processed.toLocaleString() || '0'}
              icon={<Video className="h-4 w-4" />}
            />

            <MetricCard
              title="Published Articles"
              value={overview?.articles.published.toLocaleString() || '0'}
              icon={<FileText className="h-4 w-4" />}
            />

            <MetricCard
              title="Active Jobs"
              value={overview?.jobs.active.toLocaleString() || '0'}
              icon={<Clock className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <ActivityFeed limit={10} />

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard/restaurants/new/edit')}
                className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <p className="font-medium text-sm">Add New Restaurant</p>
                <p className="text-xs text-muted-foreground">Manually create a restaurant entry</p>
              </button>

              <button
                onClick={() => router.push('/dashboard/pipeline?tab=overview')}
                className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <p className="font-medium text-sm">Process Video</p>
                <p className="text-xs text-muted-foreground">Analyze a new YouTube video</p>
              </button>

              <button
                onClick={() => router.push('/dashboard/articles/new/edit')}
                className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <p className="font-medium text-sm">Create Article</p>
                <p className="text-xs text-muted-foreground">Write a new blog post</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      {!overviewLoading && overview?.overview.byStatus && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Status</CardTitle>
              <CardDescription>Breakdown by current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(overview.overview.byStatus).map(([status, count]: [string, any]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        status === 'open' ? 'bg-green-500' :
                        status === 'closed' ? 'bg-red-500' :
                        status === 'new_opening' ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`} />
                      <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Host Opinions</CardTitle>
              <CardDescription>Sentiment distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(overview.overview.byOpinion).map(([opinion, count]: [string, any]) => (
                  <div key={opinion} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {opinion === 'positive' ? '\u{1F60D}' :
                         opinion === 'negative' ? '\u{1F61E}' :
                         opinion === 'mixed' ? '\u{1F914}' : '\u{1F610}'}
                      </span>
                      <span className="text-sm capitalize">{opinion}</span>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Your Role</p>
              <p className="font-medium capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Login</p>
              <p className="font-medium">
                {user?.last_login
                  ? new Date(user.last_login).toLocaleDateString()
                  : 'First login'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Account Created</p>
              <p className="font-medium">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium text-green-600 dark:text-green-400">Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
