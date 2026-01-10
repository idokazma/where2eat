'use client';

import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UtensilsCrossed, Video, FileText, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const metrics = [
    {
      title: 'Total Restaurants',
      value: '1,247',
      change: '+23 this week',
      icon: UtensilsCrossed,
      trend: 'up',
    },
    {
      title: 'Videos Processed',
      value: '156',
      change: '+12 today',
      icon: Video,
      trend: 'up',
    },
    {
      title: 'Published Articles',
      value: '45',
      change: '2 drafts',
      icon: FileText,
      trend: 'neutral',
    },
    {
      title: 'Active Jobs',
      value: '2',
      change: 'View queue →',
      icon: TrendingUp,
      trend: 'neutral',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening with Where2Eat today.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className={`text-xs mt-1 ${
                  metric.trend === 'up'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground'
                }`}>
                  {metric.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Video className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Processed "Best Hummus in Tel Aviv"</p>
                  <p className="text-xs text-muted-foreground">5 restaurants found • 2 hours ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UtensilsCrossed className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Edited "Cafe Landwer - Dizengoff"</p>
                  <p className="text-xs text-muted-foreground">Price updated • 4 hours ago</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Published "Winter Food Trends 2026"</p>
                  <p className="text-xs text-muted-foreground">Article • 1 day ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors">
                <p className="font-medium text-sm">Add New Restaurant</p>
                <p className="text-xs text-muted-foreground">Manually create a restaurant entry</p>
              </button>

              <button className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors">
                <p className="font-medium text-sm">Process Video</p>
                <p className="text-xs text-muted-foreground">Analyze a new YouTube video</p>
              </button>

              <button className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors">
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
