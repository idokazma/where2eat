'use client';

interface HeatLegendProps {
  visible?: boolean;
}

export function HeatLegend({ visible = true }: HeatLegendProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute bottom-14 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2"
      dir="rtl"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-[var(--color-ink-muted)]">חדש</span>
        <div
          className="w-[80px] h-[8px] rounded-full"
          style={{
            background: 'linear-gradient(to left, #3b82f6, #22c55e, #eab308, #f97316, #ef4444)',
          }}
        />
        <span className="text-[10px] font-medium text-[var(--color-ink-muted)]">ישן</span>
      </div>
    </div>
  );
}
