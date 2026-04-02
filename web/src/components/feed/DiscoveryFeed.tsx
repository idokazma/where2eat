'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { UtensilsCrossed, Loader2, LayoutGrid, List } from 'lucide-react';
import { Restaurant, getCoordinates } from '@/types/restaurant';
import { RestaurantCardNew } from '@/components/restaurant/RestaurantCardNew';
import { CompactRestaurantItem } from '@/components/restaurant/CompactRestaurantItem';
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

  // Compact view toggle (persisted in localStorage)
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('w2e_feed_compact') === '1';
    }
    return false;
  });

  const toggleCompact = useCallback(() => {
    setIsCompact((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('w2e_feed_compact', next ? '1' : '0');
      }
      return next;
    });
  }, []);

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
      <div className="flex items-center justify-between">
        <SectionHeader
          icon={<UtensilsCrossed className="w-5 h-5 text-[var(--color-ink-muted)]" />}
          title="גילויים"
          subtitle={undefined}
          className="flex-1"
        />
        <button
          onClick={toggleCompact}
          className="flex items-center gap-1.5 px-3 py-1.5 ml-4 rounded-lg text-xs font-medium transition-colors bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink-subtle)]"
          aria-label={isCompact ? 'תצוגת כרטיסים' : 'תצוגה קומפקטית'}
        >
          {isCompact ? (
            <>
              <LayoutGrid className="w-4 h-4" />
              <span>כרטיסים</span>
            </>
          ) : (
            <>
              <List className="w-4 h-4" />
              <span>קומפקטי</span>
            </>
          )}
        </button>
      </div>

      <div className={`px-4 ${!isCompact && isTwoCol ? 'grid grid-cols-2 gap-3' : 'space-y-3'}`}>
        {restaurants.map((restaurant, index) => {
          let distanceMeters: number | undefined;
          const coords = getCoordinates(restaurant.location);
          if (showDistances && userCoords && coords) {
            distanceMeters = calculateDistance(
              userCoords.lat, userCoords.lng,
              coords.latitude, coords.longitude
            );
          }

          const imageUrl = getRestaurantImage(restaurant) || undefined;

          if (isCompact) {
            return (
              <div
                key={restaurant.id || restaurant.google_places?.place_id || `${restaurant.name_hebrew}-${index}`}
                className={`animate-fade-up stagger-${Math.min(index + 1, 8)}`}
              >
                <CompactRestaurantItem
                  restaurant={restaurant}
                  imageUrl={imageUrl}
                  onNavigate={() => onRestaurantClick?.(restaurant)}
                  showDistance={showDistances && !!distanceMeters}
                  distanceMeters={distanceMeters}
                />
              </div>
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
                imageUrl={imageUrl}
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
