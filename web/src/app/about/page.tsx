'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Youtube, Sparkles, MapPin } from 'lucide-react';
import { PageLayout } from '@/components/layout';
import { endpoints } from '@/lib/config';

export default function AboutPage() {
  const [restaurantCount, setRestaurantCount] = useState<number | null>(null);
  const [episodeCount, setEpisodeCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(endpoints.restaurants.list())
      .then(res => res.json())
      .then(data => {
        const restaurants = data.restaurants || [];
        setRestaurantCount(data.count ?? restaurants.length);
        const episodes = new Set(
          restaurants.map((r: any) => r.episode_info?.video_id).filter(Boolean)
        );
        setEpisodeCount(episodes.size);
      })
      .catch(() => {
        // Silently fail — stats will show loading state
      });
  }, []);

  const formatStat = (count: number | null) => {
    if (count === null) return '...';
    return count.toLocaleString();
  };

  return (
    <PageLayout showHeader showBottomNav showSettings={false}>
      {/* Back button */}
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
        <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-6">אודות Where2Eat</h1>

        <div className="space-y-6">
          {/* Intro */}
          <p className="text-[var(--color-ink)] leading-relaxed">
            Where2Eat הוא מנוע גילוי מסעדות המבוסס על המלצות מפודקאסטים ותוכניות אוכל ישראליות.
          </p>

          {/* How it works */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">איך זה עובד?</h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <Youtube className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--color-ink)]">אוספים תוכן</h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    אנחנו מאזינים לפודקאסטים ותוכניות אוכל פופולריות בעברית
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-[var(--color-gold)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--color-ink)]">מנתחים עם AI</h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    בינה מלאכותית מחלצת המלצות למסעדות מתוך התוכן
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-positive)]/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[var(--color-positive)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--color-ink)]">מציגים לכם</h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    המסעדות מוצגות עם כל המידע הרלוונטי - מיקום, דירוג, ופרטי קשר
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--color-surface)] rounded-xl">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--color-accent)]">{formatStat(restaurantCount)}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">מסעדות</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--color-gold)]">{formatStat(episodeCount)}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">פרקים</p>
            </div>
          </div>

          {/* Version */}
          <div className="pt-6 border-t border-[var(--color-border)] text-center">
            <p className="text-sm text-[var(--color-ink-muted)]">
              Where2Eat v2.0
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
