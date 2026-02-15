'use client';

import { useState, useEffect, useMemo } from 'react';
import { Flame } from 'lucide-react';
import { PageLayout } from '@/components/layout';
import { RestaurantCardNew } from '@/components/restaurant';
import { RestaurantCardSkeleton, FilterChipSkeleton } from '@/components/ui/skeleton';
import { Restaurant } from '@/types/restaurant';
import { endpoints } from '@/lib/config';
import { getRestaurantImage } from '@/lib/images';

type TimePeriod = 'week' | 'month' | '3months';

const getDateThreshold = (period: TimePeriod): Date => {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '3months':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
};

export default function TrendingPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(endpoints.restaurants.list());
      const data = await response.json();
      if (data.restaurants) {
        setRestaurants(data.restaurants);
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter restaurants by analysis_date based on selected time period
  const trendingRestaurants = useMemo(() => {
    const threshold = getDateThreshold(timePeriod);
    const filtered = restaurants.filter((r) => {
      const analysisDate = r.episode_info?.analysis_date;
      if (!analysisDate) return true; // Include restaurants without dates (don't hide data)
      return new Date(analysisDate) >= threshold;
    });
    return filtered
      .sort((a, b) => (b.rating?.google_rating ?? 0) - (a.rating?.google_rating ?? 0))
      .slice(0, 20);
  }, [restaurants, timePeriod]);

  if (isLoading) {
    return (
      <PageLayout title="טרנדי" showHeader showBottomNav>
        {/* Skeleton time period tabs */}
        <div className="flex gap-2 px-4 py-3 border-b border-[var(--color-border)]">
          <FilterChipSkeleton />
          <FilterChipSkeleton />
          <FilterChipSkeleton />
        </div>
        {/* Skeleton cards */}
        <div className="px-4 py-4 space-y-4">
          <RestaurantCardSkeleton />
          <RestaurantCardSkeleton />
          <RestaurantCardSkeleton />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="טרנדי" showHeader showBottomNav>
      {/* Time period tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-[var(--color-border)]">
        {[
          { value: 'week' as TimePeriod, label: 'שבוע' },
          { value: 'month' as TimePeriod, label: 'חודש' },
          { value: '3months' as TimePeriod, label: '3 חודשים' },
        ].map((period) => (
          <button
            key={period.value}
            onClick={() => setTimePeriod(period.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all press-effect ${
              timePeriod === period.value
                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-elevated)]'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Trending list */}
      <div className="px-4 py-4 space-y-4">
        {trendingRestaurants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--color-ink-muted)]">אין מסעדות טרנדיות בתקופה זו</p>
          </div>
        )}
        {trendingRestaurants.map((restaurant, index) => (
          <div key={restaurant.google_places?.place_id || restaurant.name_hebrew}>
            {/* Rank indicator */}
            {index === 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)] text-white flex items-center justify-center font-bold">
                  #1
                </div>
                <Flame className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
            )}

            <RestaurantCardNew
              restaurant={restaurant}
              variant={index === 0 ? 'featured' : 'default'}
              imageUrl={getRestaurantImage(restaurant) || undefined}
            />

            {index > 0 && index < 5 && (
              <div className="text-sm text-[var(--color-ink-muted)] mt-1 mr-2">
                #{index + 1}
              </div>
            )}
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
