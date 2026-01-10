'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Plus, Edit, Trash, Video, FileText } from 'lucide-react';

interface Activity {
  id: string;
  type: 'restaurant_created' | 'restaurant_updated' | 'restaurant_deleted' | 'video_processed' | 'article_published';
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ActivityFeedProps {
  activities: Activity[];
  isLoading?: boolean;
}

const activityIcons: Record<Activity['type'], React.ReactNode> = {
  restaurant_created: <Plus className="h-4 w-4" />,
  restaurant_updated: <Edit className="h-4 w-4" />,
  restaurant_deleted: <Trash className="h-4 w-4" />,
  video_processed: <Video className="h-4 w-4" />,
  article_published: <FileText className="h-4 w-4" />,
};

const activityColors: Record<Activity['type'], string> = {
  restaurant_created: 'bg-green-100 text-green-700',
  restaurant_updated: 'bg-blue-100 text-blue-700',
  restaurant_deleted: 'bg-red-100 text-red-700',
  video_processed: 'bg-purple-100 text-purple-700',
  article_published: 'bg-orange-100 text-orange-700',
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

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
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

  if (!activities || activities.length === 0) {
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
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest changes and updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-4">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activityColors[activity.type]}`}>
                {activityIcons[activity.type]}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{activity.description}</p>
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
