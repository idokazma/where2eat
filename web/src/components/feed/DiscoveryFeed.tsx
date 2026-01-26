'use client';

import { UtensilsCrossed } from 'lucide-react';
import { Restaurant } from '@/types/restaurant';
import { RestaurantCardNew } from '@/components/restaurant/RestaurantCardNew';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface DiscoveryFeedProps {
  restaurants: Restaurant[];
  onRestaurantClick?: (restaurant: Restaurant) => void;
  showDistances?: boolean;
  userCoords?: { lat: number; lng: number } | null;
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
  className = '',
}: DiscoveryFeedProps) {
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
        {restaurants.map((restaurant, index) => {
          // Calculate distance if user coords available
          let distanceMeters: number | undefined;
          if (showDistances && userCoords) {
            // For now, use a mock location since restaurants don't have coords
            // In production, you'd use restaurant.google_places coordinates
            distanceMeters = undefined; // Would calculate from restaurant coords
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
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
