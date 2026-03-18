'use client';

import { useMemo, useRef, useEffect, useCallback } from 'react';
import { UtensilsCrossed, Loader2 } from 'lucide-react';
import { Restaurant, getCoordinates } from '@/types/restaurant';
import { RestaurantCardNew } from '@/components/restaurant/RestaurantCardNew';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getRestaurantImage } from '@/lib/images';

interface DiscoveryFeedProps {
  restaurants: Restaurant[];
  onRestaurantClick?: (restaurant: Restaurant) => void;
  showDistances?: boolean;
  userCoords?: { lat: number; lng: number } | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
}: DiscoveryFeedProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll: observe sentinel element
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
      rootMargin: '200px',
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [handleIntersection]);

  // Sort restaurants by distance when "Near Me" is active
  const sortedRestaurants = useMemo(() => {
    if (!showDistances || !userCoords) return restaurants;
    return [...restaurants].sort((a, b) => {
      const coordsA = getCoordinates(a.location);
      const distA = coordsA
        ? calculateDistance(
            userCoords.lat,
            userCoords.lng,
            coordsA.latitude,
            coordsA.longitude
          )
        : Infinity;
      const coordsB = getCoordinates(b.location);
      const distB = coordsB
        ? calculateDistance(
            userCoords.lat,
            userCoords.lng,
            coordsB.latitude,
            coordsB.longitude
          )
        : Infinity;
      return distA - distB;
    });
  }, [restaurants, showDistances, userCoords]);

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
      />

      <div className="px-4 space-y-4">
        {sortedRestaurants.map((restaurant, index) => {
          // Calculate distance if user coords available
          let distanceMeters: number | undefined;
          const coords = getCoordinates(restaurant.location);
          if (showDistances && userCoords && coords) {
            distanceMeters = calculateDistance(
              userCoords.lat,
              userCoords.lng,
              coords.latitude,
              coords.longitude
            );
          }

          return (
            <div
              key={restaurant.google_places?.place_id || `${restaurant.name_hebrew}-${index}`}
              className={`animate-fade-up stagger-${Math.min(index + 1, 8)}`}
            >
              <RestaurantCardNew
                restaurant={restaurant}
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

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </section>
  );
}
