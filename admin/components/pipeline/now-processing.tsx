'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PipelineOverview, QueueItem } from '@/types';

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    function tick() {
      if (!startedAt) {
        setElapsed('—');
        return;
      }
      const start = new Date(startedAt).getTime();
      const secs = Math.floor((Date.now() - start) / 1000);
      if (secs < 60) setElapsed(`${secs}s`);
      else if (secs < 3600)
        setElapsed(`${Math.floor(secs / 60)}m ${secs % 60}s`);
      else
        setElapsed(
          `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
        );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className="font-mono text-blue-600 font-semibold">{elapsed}</span>;
}

interface NowProcessingProps {
  overview?: PipelineOverview | null;
  processingItems?: QueueItem[];
}

export function NowProcessing({ overview, processingItems }: NowProcessingProps) {
  // Use queue-based processing items if available, else fall back to overview
  if (processingItems && processingItems.length > 0) {
    return (
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Now Processing
        </h2>
        <div className="space-y-1.5">
          {processingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-l-2 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 rounded-r-md px-3 py-2"
            >
              <RefreshCw className="size-4 text-blue-500 animate-spin shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate leading-tight">
                  {item.video_title || item.video_id || 'Untitled'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.channel_name || 'Unknown channel'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Timer className="size-3.5 text-muted-foreground" />
                <ElapsedTimer startedAt={item.processing_started_at || ''} />
                {item.video_url && (
                  <a
                    href={item.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title="View on YouTube"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!overview?.currently_processing) return null;

  const cp = overview.currently_processing;

  return (
    <div className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        <h3 className="text-lg font-semibold">Currently Processing</h3>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{cp.video_title}</h4>
          <p className="text-sm text-muted-foreground mb-1">{cp.channel_name}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Timer className="size-3.5" />
              <ElapsedTimer startedAt={cp.started_at} />
            </div>
            <Badge variant="outline" className="font-normal">
              {cp.step}
            </Badge>
          </div>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${cp.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
