'use client';

import { useRef, useEffect, useCallback } from 'react';
import { UtensilsCrossed, Loader2 } from 'lucide-react';
import { Restaurant, getCoordinates } from '@/types/restaurant';
import { RestaurantCardNew } from '@/components/restaurant/RestaurantCardNew';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getRestaurantImage } from '@/lib/images';
import { useSettings } from '@/contexts/settings-context';

interface DiscoveryFeedProps {
  restaurants: Restaurant[];
  onRestaurantClick?: (restaurant: Restaurant) => void;
  showDistances?: boolean;
  userCoords?: { lat: number; lng: number } | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
  totalCount?: number;
}

function calculateDistance(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DiscoveryFeed({
  restaurants,
  onRestaurantClick,
  showDistances = false,
  userCoords,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className = '',
  totalCount,
}: DiscoveryFeedProps) {
  const { settings } = useSettings();
  const isTwoCol = settings.feedLayout === '2-col';
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Progressive render: observe sentinel to load more cards
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, isLoadingMore, onLoadMore]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: '400px',
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [handleIntersection]);

  if (restaurants.length === 0) {
    return (
      <section className={`px-4 py-8 ${className}`}>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
            <UtensilsCrossed className="w-8 h-8 text-[var(--color-ink-muted)]" />
          </div>
          <p className="text-[var(--color-ink-muted)]">לא נמצאו מסעדות</p>
          <p className="text-sm text-[var(--color-ink-subtle)] mt-1">
            נסה לשנות את הפילטרים
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      <SectionHeader
        icon={<UtensilsCrossed className="w-5 h-5 text-[var(--color-ink-muted)]" />}
        title="גילויים"
        subtitle={totalCount ? `${totalCount} מסעדות` : undefined}
      />

      <div className={`px-4 ${isTwoCol ? 'grid grid-cols-2 gap-3' : 'space-y-4'}`}>
        {restaurants.map((restaurant, index) => {
          let distanceMeters: number | undefined;
          const coords = getCoordinates(restaurant.location);
          if (showDistances && userCoords && coords) {
            distanceMeters = calculateDistance(
              userCoords.lat, userCoords.lng,
              coords.latitude, coords.longitude
            );
          }

          return (
            <div
              key={restaurant.id || restaurant.google_places?.place_id || `${restaurant.name_hebrew}-${index}`}
              className={`animate-fade-up stagger-${Math.min(index + 1, 8)}`}
            >
              <RestaurantCardNew
                restaurant={restaurant}
                variant={isTwoCol ? 'compact' : 'default'}
                showDistance={showDistances && !!distanceMeters}
                distanceMeters={distanceMeters}
                onTap={() => onRestaurantClick?.(restaurant)}
                imageUrl={getRestaurantImage(restaurant) || undefined}
              />
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoadingMore && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-[var(--color-ink-muted)] animate-spin" />
          </div>
        )}

        {/* Sentinel for progressive rendering */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </section>
  );
}
