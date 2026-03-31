'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageLayout } from '@/components/layout';
import { useSettings, RADIUS_OPTIONS } from '@/contexts/settings-context';
import type { ThemeMode } from '@/contexts/settings-context';

export default function SettingsPage() {
  const { settings, updateSetting, isInitialized } = useSettings();

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'בהיר' },
    { value: 'dark', label: 'כהה' },
    { value: 'system', label: 'מערכת' },
  ];

  const handleClearData = () => {
    if (confirm('האם אתה בטוח? פעולה זו תמחק את כל הנתונים המקומיים')) {
      localStorage.removeItem('where2eat-favorites');
      localStorage.removeItem('where2eat-settings');
      localStorage.removeItem('where2eat-location-filter');
      localStorage.removeItem('w2e_swipe_hint_shown');
      window.location.reload();
    }
  };

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
            {RADIUS_OPTIONS.map((km) => {
              const isSelected = km === 0 ? !settings.radiusKm : settings.radiusKm === km;
              return (
                <button
                  key={km}
                  onClick={() => updateSetting('radiusKm', km === 0 ? null : km)}
                  className={`flex-1 p-3 rounded-lg font-medium text-sm transition-colors ${
                    isSelected
                      ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink)]'
                  }`}
                  disabled={!isInitialized}
                >
                  {km === 0 ? 'ללא' : `${km} ק\u0022מ`}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--color-ink-muted)] mt-2">
            חל כאשר מסנן &quot;קרוב אליי&quot; פעיל
          </p>
        </div>

        {/* Feed layout */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-ink-muted)] mb-3">
            תצוגת פיד
          </h2>
          <div className="flex gap-2">
            {([
              { value: '1-col' as const, label: 'עמודה אחת' },
              { value: '2-col' as const, label: 'שתי עמודות' },
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => updateSetting('feedLayout', value)}
                className={`flex-1 p-3 rounded-lg font-medium text-sm transition-colors ${
                  settings.feedLayout === value
                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-ink)]'
                }`}
                disabled={!isInitialized}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme setting */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-ink-muted)] mb-3">
            ערכת נושא
          </h2>
          <div className="flex gap-2">
            {themes.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => updateSetting('theme', value)}
                className={`flex-1 p-3 rounded-lg font-medium text-sm transition-colors ${
                  settings.theme === value
                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-ink)]'
                }`}
                disabled={!isInitialized}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear data */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <button
            onClick={handleClearData}
            className="w-full p-4 rounded-lg bg-[var(--color-negative-subtle)] text-[var(--color-negative)] font-medium"
          >
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
