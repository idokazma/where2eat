'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageLayout } from '@/components/layout';

export default function SettingsPage() {
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
