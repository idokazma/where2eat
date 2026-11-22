'use client';

import { useAuth } from '@/lib/admin/auth-context';
import { useQuery } from '@tanstack/react-query';
import { pipelineApi, restaurantsApi, usageApi } from '@/lib/admin/api';
import { queryKeys, REFETCH_INTERVALS } from '@/lib/admin/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { MetricCard } from '@/components/admin/dashboard/metric-card';
import { ActivityFeed } from '@/components/admin/dashboard/activity-feed';
import { StatusStrip } from '@/components/admin/pipeline/status-strip';
import { UtensilsCrossed, Video, FileText, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Total restaurant count (the old /api/admin/analytics/overview endpoint
  // does not exist on the live FastAPI backend; restaurants list does)
  const { data: restaurantList, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-restaurants-count'],
    queryFn: () => restaurantsApi.list({ page: 1, limit: 1 }),
    refetchInterval: REFETCH_INTERVALS.analytics,
  });

  // Self-hosted usage analytics (7-day window for the sparkline + cards)
  const { data: usage } = useQuery({
    queryKey: ['usage-summary', 7],
    queryFn: () => usageApi.getSummary(7),
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

  // Sparkline: daily page views over the last 7 days
  const sparklineData = usage?.daily?.slice(-7).map((d) => ({
    value: d.page_views || 0,
  })) || [];

  const totalRestaurants = restaurantList?.pagination?.total;

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
        restaurantCount={totalRestaurants}
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
              value={totalRestaurants?.toLocaleString() || '0'}
              trendData={sparklineData}
              icon={<UtensilsCrossed className="h-4 w-4" />}
              href="/admin/dashboard/restaurants"
            />

            <MetricCard
              title="Sessions (7d)"
              value={(usage?.totals?.sessions ?? 0).toLocaleString()}
              icon={<Video className="h-4 w-4" />}
              href="/admin/dashboard/analytics"
            />

            <MetricCard
              title="Page Views (7d)"
              value={(usage?.totals?.page_views ?? 0).toLocaleString()}
              icon={<FileText className="h-4 w-4" />}
              href="/admin/dashboard/analytics"
            />

            <MetricCard
              title="Restaurant Views (7d)"
              value={(usage?.totals?.restaurant_views ?? 0).toLocaleString()}
              icon={<Clock className="h-4 w-4" />}
              href="/admin/dashboard/analytics"
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
