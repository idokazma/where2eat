'use client';

import type { PipelineOverview, PipelineStats } from '@/types/admin';
import { formatDurationCompact } from '@/lib/admin/formatters';

interface MetricProps {
  label: string;
  value: string | number;
  dotColor?: string;
  pulse?: boolean;
  valueClass?: string;
}

function Metric({ label, value, dotColor, pulse, valueClass }: MetricProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      {dotColor && (
        <span
          className={`inline-block size-2 rounded-full shrink-0 ${dotColor} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <span
        className={`text-xs font-bold tabular-nums whitespace-nowrap ${valueClass ?? ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-border shrink-0" />;
}

interface StatusStripProps {
  overview: PipelineOverview | null;
  stats: PipelineStats | null;
  restaurantCount?: number;
  isLoading: boolean;
}

export function StatusStrip({ overview, stats, restaurantCount, isLoading }: StatusStripProps) {
  const successRate =
    stats?.failure_rate_percent != null
      ? `${(100 - stats.failure_rate_percent).toFixed(0)}%`
      : '—';

  const successRateClass =
    stats?.failure_rate_percent != null
      ? stats.failure_rate_percent > 20
        ? 'text-red-600'
        : stats.failure_rate_percent > 10
          ? 'text-yellow-600'
          : 'text-green-600'
      : '';

  return (
    <div
      className={`flex items-center flex-wrap gap-y-1 border rounded-md bg-muted/30 px-1 py-0.5 text-xs transition-opacity ${isLoading ? 'opacity-60' : 'opacity-100'}`}
    >
      {restaurantCount !== undefined && (
        <>
          <Metric label="Restaurants" value={restaurantCount} />
          <Divider />
        </>
      )}
      <Metric
        label="Queued"
        value={overview?.queued ?? '—'}
        dotColor="bg-yellow-500"
      />
      <Divider />
      <Metric
        label="Processing"
        value={overview?.processing ?? '—'}
        dotColor="bg-blue-500"
        pulse={(overview?.processing ?? 0) > 0}
      />
      <Divider />
      <Metric
        label="Done 24h"
        value={stats?.completed_last_24h ?? overview?.processed_24h ?? '—'}
        dotColor="bg-green-500"
      />
      <Divider />
      <Metric
        label="Failed"
        value={overview?.failed ?? overview?.failed_24h ?? '—'}
        dotColor="bg-red-500"
        valueClass={(overview?.failed ?? overview?.failed_24h ?? 0) > 0 ? 'text-red-600' : ''}
      />
      <Divider />
      <Metric label="Success" value={successRate} valueClass={successRateClass} />
      <Divider />
      <Metric
        label="Avg time"
        value={formatDurationCompact(stats?.avg_processing_seconds ?? 0)}
      />
    </div>
  );
}
