'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Measures the rendered width of the chart wrapper so the SVG viewBox matches
 * real pixels 1:1. Without this, viewBox scaling shrinks tick labels on narrow
 * screens (and enlarges them on desktop).
 */
function useChartWidth(fallback = 600) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Lightweight charts for the admin analytics page.
 *
 * Plain HTML/SVG, width-constrained by CSS (never wider than their card at any
 * viewport). Recharts was dropped here because its measured-width rendering
 * overflowed cards on narrow/RTL layouts.
 */

export interface DailyRow {
  day: string;
  events: number;
  page_views: number;
  sessions: number;
}

/** Two-series area chart (page views + sessions) as inline SVG with viewBox. */
export function DailyAreaChart({ data }: { data: DailyRow[] }) {
  const [ref, W] = useChartWidth();
  const H = 200;
  const PAD_L = 30;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...data.map((d) => Math.max(d.page_views, d.sessions)));
  const yMax = Math.ceil(max * 1.15);
  const x = (i: number) => PAD_L + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD_T + innerH - (v / yMax) * innerH;

  const area = (key: 'page_views' | 'sessions') => {
    if (data.length === 0) return '';
    const pts = data.map((d, i) => `${x(i)},${y(d[key])}`).join(' L');
    return `M${PAD_L},${y(0)} L${pts} L${x(data.length - 1)},${y(0)} Z`;
  };
  const line = (key: 'page_views' | 'sessions') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[key])}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const maxLabels = Math.max(2, Math.floor(W / 48));
  const labelEvery = Math.max(1, Math.ceil(data.length / maxLabels));
  // Always label the last day, but never let it overlap the previous cadence label.
  const showLabel = (i: number) => {
    if (i === data.length - 1) return true;
    if (i % labelEvery !== 0) return false;
    return x(data.length - 1) - x(i) >= 44;
  };

  return (
    <div dir="ltr" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="פעילות יומית">
        {gridLines.map((g) => (
          <g key={g}>
            <line x1={PAD_L} y1={y(g)} x2={W - PAD_R} y2={y(g)} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={PAD_L - 5} y={y(g) + 3} fontSize="10" textAnchor="end" fill="#6b7280">
              {g}
            </text>
          </g>
        ))}
        <path d={area('sessions')} fill="#10b981" fillOpacity={0.15} />
        <path d={line('sessions')} fill="none" stroke="#10b981" strokeWidth={1.5} />
        <path d={area('page_views')} fill="#3b82f6" fillOpacity={0.15} />
        <path d={line('page_views')} fill="none" stroke="#3b82f6" strokeWidth={1.5} />
        {data.map((d, i) =>
          showLabel(i) ? (
            <text
              key={d.day}
              x={i === data.length - 1 ? W - 2 : x(i)}
              y={H - 6}
              fontSize="10"
              textAnchor={i === data.length - 1 ? 'end' : 'middle'}
              fill="#6b7280"
            >
              {d.day.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="flex gap-4 justify-center text-xs text-muted-foreground" dir="rtl">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> צפיות
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" /> סשנים
        </span>
      </div>
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
}

/** Horizontal HTML bar list; width-constrained, labels never clipped. */
export function BarList({
  rows,
  color = '#3b82f6',
  labelWidth = 'w-24',
  emptyText,
}: {
  rows: BarRow[];
  color?: string;
  labelWidth?: string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2" dir="ltr">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <span className={`${labelWidth} shrink-0 text-left text-muted-foreground truncate`} title={r.label}>
            {r.label}
          </span>
          <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
            <div className="h-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="w-8 shrink-0 text-right font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Hour-of-day column chart as inline SVG (24 fixed columns). */
export function HourlyBarChart({ data }: { data: { hour: number; events: number }[] }) {
  const [ref, W] = useChartWidth();
  const H = 180;
  const PAD_L = 30;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...data.map((d) => d.events));
  const yMax = Math.ceil(max * 1.15);
  const band = innerW / 24;
  const y = (v: number) => PAD_T + innerH - (v / yMax) * innerH;
  const gridLines = [0, 0.5, 1].map((f) => Math.round(yMax * f));
  const labelStep = Math.max(1, Math.ceil(24 / Math.max(2, Math.floor(W / 26))));

  return (
    <div dir="ltr" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="אירועים לפי שעה">
        {gridLines.map((g) => (
          <g key={g}>
            <line x1={PAD_L} y1={y(g)} x2={W - PAD_R} y2={y(g)} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={PAD_L - 5} y={y(g) + 3} fontSize="10" textAnchor="end" fill="#6b7280">
              {g}
            </text>
          </g>
        ))}
        {data.map((d) => (
          <g key={d.hour}>
            <rect
              x={PAD_L + d.hour * band + band * 0.15}
              y={y(d.events)}
              width={band * 0.7}
              height={Math.max(0, PAD_T + innerH - y(d.events))}
              fill="#8b5cf6"
              rx={1}
            />
            {d.hour % labelStep === 0 ? (
              <text x={PAD_L + d.hour * band + band / 2} y={H - 6} fontSize="10" textAnchor="middle" fill="#6b7280">
                {d.hour}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

const DEVICE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

/** Donut chart via SVG strokes + HTML legend; never overflows its card. */
export function DeviceDonut({ data }: { data: { device: string; sessions: number }[] }) {
  const total = data.reduce((s, d) => s + d.sessions, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">עדיין לא נרשמו סשנים.</p>;
  }
  const R = 52;
  const C = 2 * Math.PI * R;
  const segments = data.map((d, i) => {
    const frac = d.sessions / total;
    const start = data.slice(0, i).reduce((acc, x) => acc + x.sessions, 0);
    return {
      color: DEVICE_COLORS[i % DEVICE_COLORS.length],
      dasharray: `${frac * C} ${C}`,
      dashoffset: -start * (C / total),
    };
  });

  return (
    <div>
      <svg viewBox="0 0 140 140" className="w-32 h-32 mx-auto" role="img" aria-label="סשנים לפי סוג מכשיר">
        <g transform="rotate(-90 70 70)">
          {segments.map((s, i) => (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={22}
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
            />
          ))}
        </g>
        <text x="70" y="74" fontSize="18" fontWeight="600" textAnchor="middle" fill="#111827">
          {total}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 justify-center text-sm">
        {data.map((d, i) => (
          <span key={d.device} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: DEVICE_COLORS[i % DEVICE_COLORS.length] }}
            />
            {d.device}: {d.sessions}
          </span>
        ))}
      </div>
    </div>
  );
}
