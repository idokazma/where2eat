'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageLayout } from '@/components/layout';
import { useSettings, RADIUS_OPTIONS } from '@/hooks/useSettings';

export default function SettingsPage() {
  const { settings, updateSetting, isInitialized } = useSettings();

  return (
    <PageLayout showHeader showBottomNav showSettings={false}>
      {/* Back button in header area */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <Link
          href="/more"
          className="flex items-center gap-2 text-[var(--color-accent)]"
        >
          <ChevronRight className="w-5 h-5" />
          <span>חזרה</span>
        </Link>
      </div>

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-6">הגדרות</h1>

        {/* Show only Israel */}
        <div className="mb-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)]">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-ink)]">
                הצג רק מסעדות בישראל
              </h2>
              <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                הסתר מסעדות מחו&quot;ל
              </p>
            </div>
            <button
              onClick={() => updateSetting('showOnlyIsrael', !settings.showOnlyIsrael)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                settings.showOnlyIsrael
                  ? 'bg-[var(--color-accent)]'
                  : 'bg-[var(--color-border)]'
              }`}
              disabled={!isInitialized}
              role="switch"
              aria-checked={settings.showOnlyIsrael}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  settings.showOnlyIsrael ? 'translate-x-0.5' : 'translate-x-5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Radius */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-ink-muted)] mb-3">
            רדיוס תצוגה (בקרבת מקום)
          </h2>
          <div className="flex gap-2">
            {RADIUS_OPTIONS.map((km) => (
              <button
                key={km}
                onClick={() => updateSetting('radiusKm', km)}
                className={`flex-1 p-3 rounded-lg font-medium text-sm transition-colors ${
                  settings.radiusKm === km
                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-ink)]'
                }`}
                disabled={!isInitialized}
              >
                {km} ק&quot;מ
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-ink-muted)] mt-2">
            חל כאשר מסנן &quot;קרוב אליי&quot; פעיל
          </p>
        </div>

        {/* Language setting */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-ink-muted)] mb-3">
            שפה
          </h2>
          <div className="flex gap-2">
            <button className="flex-1 p-3 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] font-medium">
              עברית
            </button>
            <button className="flex-1 p-3 rounded-lg bg-[var(--color-surface)] text-[var(--color-ink)]">
              English
            </button>
          </div>
        </div>

        {/* Theme setting */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-ink-muted)] mb-3">
            ערכת נושא
          </h2>
          <div className="flex gap-2">
            <button className="flex-1 p-3 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] font-medium">
              בהיר
            </button>
            <button className="flex-1 p-3 rounded-lg bg-[var(--color-surface)] text-[var(--color-ink)]">
              כהה
            </button>
            <button className="flex-1 p-3 rounded-lg bg-[var(--color-surface)] text-[var(--color-ink)]">
              מערכת
            </button>
          </div>
        </div>

        {/* Clear data */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <button className="w-full p-4 rounded-lg bg-[var(--color-negative-subtle)] text-[var(--color-negative)] font-medium">
            נקה נתונים מקומיים
          </button>
          <p className="text-xs text-[var(--color-ink-subtle)] text-center mt-2">
            ימחק את ההיסטוריה והמועדפים השמורים
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
