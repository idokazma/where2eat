'use client';

import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { PageLayout } from '@/components/layout';
import { RestaurantCardNew } from '@/components/restaurant';
import { RestaurantCardSkeleton, FilterChipSkeleton } from '@/components/ui/skeleton';
import { Restaurant } from '@/types/restaurant';
import { endpoints } from '@/lib/config';

type TimePeriod = 'week' | 'month' | '3months';

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

  // In a real app, this would filter by actual trending data
  const trendingRestaurants = restaurants.slice(0, 20);

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
