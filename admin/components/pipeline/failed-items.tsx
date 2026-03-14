'use client';

import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  RotateCcw,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import type { QueueItem } from '@/types';

interface FailedItemsProps {
  items: QueueItem[];
  actionLoading: string | null;
  onAction: (id: string, action: 'retry' | 'remove') => void;
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
  action: 'retry' | 'remove';
  actionLoading: string | null;
  onAction: (id: string, action: 'retry' | 'remove') => void;
  title: string;
  icon: React.ReactNode;
}) {
  const key = `${itemId}-${action}`;
  const isLoading = actionLoading === key;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onAction(itemId, action)}
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

export function FailedItems({ items, actionLoading, onAction }: FailedItemsProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-1.5 flex items-center gap-1.5">
        <AlertTriangle className="size-3.5" />
        Failed
        <span className="text-red-700 font-bold">{items.length}</span>
      </h2>
      <div className="border border-red-200 dark:border-red-900 rounded-md overflow-hidden">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 px-3 py-2 border-b last:border-0 ${
              idx % 2 === 0
                ? 'bg-red-50/40 dark:bg-red-950/10'
                : 'bg-red-50/20 dark:bg-red-950/5'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">
                {item.video_title || item.video_id || 'Untitled'}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.channel_name || 'Unknown'} · {item.attempt_count}/
                {item.max_attempts} attempts
              </div>
              {item.error_message && (
                <div className="text-xs text-red-600 mt-0.5 line-clamp-2">
                  {item.error_message}
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {(item.video_url || item.video_id) && (
                <a
                  href={item.video_url || `https://www.youtube.com/watch?v=${item.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  title="View on YouTube"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
              <ActionButton
                itemId={item.id}
                action="retry"
                actionLoading={actionLoading}
                onAction={onAction}
                title="Retry this video"
                icon={<RotateCcw className="size-3.5 text-blue-600" />}
              />
              <ActionButton
                itemId={item.id}
                action="remove"
                actionLoading={actionLoading}
                onAction={onAction}
                title="Remove"
                icon={<Trash2 className="size-3.5 text-red-500" />}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
