'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, Edit, Trash, Video, FileText, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface Activity {
  id: string;
  type: 'create' | 'update' | 'delete' | 'approve' | 'reject';
  user: {
    name: string;
    email: string;
  };
  restaurant: {
    id: string;
    name: string;
  };
  changes: any;
  timestamp: string;
}

interface ActivityFeedProps {
  limit?: number;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'create':
      return <Plus className="h-4 w-4" />;
    case 'update':
      return <Edit className="h-4 w-4" />;
    case 'delete':
      return <Trash className="h-4 w-4" />;
    case 'approve':
      return <FileText className="h-4 w-4" />;
    case 'reject':
      return <FileText className="h-4 w-4" />;
    default:
      return <Edit className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'create':
      return 'bg-green-100 text-green-700';
    case 'update':
      return 'bg-blue-100 text-blue-700';
    case 'delete':
      return 'bg-red-100 text-red-700';
    case 'approve':
      return 'bg-purple-100 text-purple-700';
    case 'reject':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['activity-feed', limit],
    queryFn: async () => {
      return apiFetch<{ activities: Activity[]; total: number }>(`/api/admin/audit/activity?limit=${limit}`);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getActivityText = (activity: Activity) => {
    const actionMap = {
      create: 'created',
      update: 'updated',
      delete: 'deleted',
      approve: 'approved',
      reject: 'rejected',
    };

    return (
      <>
        <span className="font-medium">{activity.user.name}</span>{' '}
        {actionMap[activity.type] || activity.type}{' '}
        <span className="font-medium">{activity.restaurant.name}</span>
      </>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest changes and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activities = data?.activities || [];

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest changes and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No recent activity to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest changes and updates</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/audit')}
        >
          View All
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity: Activity) => (
            <div key={activity.id} className="flex gap-4">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${getActivityColor(activity.type)}`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{getActivityText(activity)}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(activity.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
