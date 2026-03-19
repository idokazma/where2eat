'use client';

import { Rss, ListVideo, FileText, Brain, MapPin, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import type { PipelineOverview, PipelineStats } from '@/types';

interface FlowStepProps {
  icon: React.ReactNode;
  label: string;
  count: number | string;
  color: string;
  pulse?: boolean;
}

function FlowStep({ icon, label, count, color, pulse }: FlowStepProps) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[72px]">
      <div
        className={`flex items-center justify-center size-10 rounded-full border-2 ${color} ${
          pulse ? 'animate-pulse' : ''
        }`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">{count}</span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center pb-8">
      <div className="h-px w-4 sm:w-6 bg-border" />
      <div className="size-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-border" />
    </div>
  );
}

interface PipelineFlowProps {
  overview: PipelineOverview | null;
  stats: PipelineStats | null;
}

export function PipelineFlow({ overview, stats }: PipelineFlowProps) {
  const queued = overview?.queued ?? 0;
  const processing = overview?.processing ?? 0;
  const completed = overview?.completed ?? 0;
  const failed = overview?.failed ?? 0;
  const skipped = overview?.skipped ?? 0;
  const total = overview?.total ?? 0;

  return (
    <div className="border rounded-lg bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Pipeline Flow
      </h3>
      <div className="flex items-start justify-center overflow-x-auto gap-0">
        <FlowStep
          icon={<Rss className="size-4 text-purple-600" />}
          label="Discovered"
          count={total}
          color="border-purple-200 bg-purple-50"
        />
        <Arrow />
        <FlowStep
          icon={<ListVideo className="size-4 text-blue-600" />}
          label="Queued"
          count={queued}
          color="border-blue-200 bg-blue-50"
          pulse={queued > 0}
        />
        <Arrow />
        <FlowStep
          icon={<Brain className="size-4 text-yellow-600" />}
          label="Processing"
          count={processing}
          color="border-yellow-200 bg-yellow-50"
          pulse={processing > 0}
        />
        <Arrow />
        <FlowStep
          icon={<CheckCircle2 className="size-4 text-green-600" />}
          label="Completed"
          count={completed}
          color="border-green-200 bg-green-50"
        />
        <div className="flex flex-col items-start pb-8 ml-2 gap-1.5">
          {failed > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="size-3.5 text-red-500" />
              <span className="text-red-600 font-semibold tabular-nums">{failed}</span>
              <span className="text-muted-foreground">failed</span>
            </div>
          )}
          {skipped > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <SkipForward className="size-3.5 text-gray-400" />
              <span className="text-gray-500 font-semibold tabular-nums">{skipped}</span>
              <span className="text-muted-foreground">skipped</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
          <span>
            Last 24h: <strong className="text-foreground">{stats.completed_last_24h}</strong> completed
          </span>
          <span>
            Last 7d: <strong className="text-foreground">{stats.completed_last_7d}</strong> completed
          </span>
          <span>
            Avg time: <strong className="text-foreground">
              {stats.avg_processing_seconds > 0
                ? `${Math.round(stats.avg_processing_seconds)}s`
                : '—'}
            </strong>
          </span>
          <span>
            Success rate:{' '}
            <strong
              className={
                stats.failure_rate_percent > 20
                  ? 'text-red-600'
                  : stats.failure_rate_percent > 10
                    ? 'text-yellow-600'
                    : 'text-green-600'
              }
            >
              {(100 - stats.failure_rate_percent).toFixed(0)}%
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
