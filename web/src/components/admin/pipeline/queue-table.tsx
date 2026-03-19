'use client';

import { Button } from '@/components/admin/ui/button';
import {
  RefreshCw,
  Zap,
  SkipForward,
  Trash2,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { priorityDotClass, formatRelativeScheduled } from '@/lib/admin/formatters';
import type { QueueItem } from '@/types/admin';

interface QueueTableProps {
  items: QueueItem[];
  isLoading: boolean;
  actionLoading: string | null;
  onAction: (id: string, action: 'prioritize' | 'skip' | 'remove') => void;
  onItemClick?: (id: string) => void;
  onRefresh?: () => void;
}

function ActionButton({
  itemId,
  action,
  actionLoading,
  onAction,
  title,
  icon,
}: {
  itemId: string;
  action: 'prioritize' | 'skip' | 'remove';
  actionLoading: string | null;
  onAction: (id: string, action: 'prioritize' | 'skip' | 'remove') => void;
  title: string;
  icon: React.ReactNode;
}) {
  const key = `${itemId}-${action}`;
  const isLoading = actionLoading === key;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onAction(itemId, action);
      }}
      disabled={isLoading || actionLoading !== null}
      title={title}
      className="h-7 w-7 p-0"
    >
      {isLoading ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : (
        icon
      )}
    </Button>
  );
}

export function QueueTable({
  items,
  isLoading,
  actionLoading,
  onAction,
  onItemClick,
  onRefresh,
}: QueueTableProps) {
  if (isLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Queue
          {items.length > 0 && (
            <span className="ml-2 text-foreground font-bold">
              {items.length}
            </span>
          )}
        </h2>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="h-6 w-6 p-0"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center border rounded-md">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Queue is empty
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-5" />
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                  Title
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden md:table-cell">
                  Channel
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden sm:table-cell w-16">
                  Sched.
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-14 hidden sm:table-cell">
                  Tries
                </th>
                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${
                    idx % 2 === 0 ? '' : 'bg-muted/10'
                  }`}
                  onClick={() => onItemClick?.(item.id)}
                >
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-block size-2 rounded-full ${priorityDotClass(item.priority)}`}
                      title={`Priority ${item.priority}`}
                    />
                  </td>
                  <td className="px-2 py-1.5 max-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">
                        {item.video_title || item.video_id || 'Untitled'}
                      </span>
                      {(item.video_url || item.video_id) && (
                        <a
                          href={item.video_url || `https://www.youtube.com/watch?v=${item.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="View on YouTube"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                    {item.channel_name || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {formatRelativeScheduled(item.scheduled_for || item.scheduled_at)}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {item.attempt_count}/{item.max_attempts}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <ActionButton
                        itemId={item.id}
                        action="prioritize"
                        actionLoading={actionLoading}
                        onAction={onAction}
                        title="Move to front of queue"
                        icon={<Zap className="size-3.5 text-yellow-600" />}
                      />
                      <ActionButton
                        itemId={item.id}
                        action="skip"
                        actionLoading={actionLoading}
                        onAction={onAction}
                        title="Skip this video"
                        icon={<SkipForward className="size-3.5 text-muted-foreground" />}
                      />
                      <ActionButton
                        itemId={item.id}
                        action="remove"
                        actionLoading={actionLoading}
                        onAction={onAction}
                        title="Remove from queue"
                        icon={<Trash2 className="size-3.5 text-red-500" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
