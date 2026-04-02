'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  UtensilsCrossed,
  MapPin,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Restaurant } from '@/types/restaurant';
import { MentionLevelBadge } from './MentionLevelBadge';
import { RestaurantCardNew } from './RestaurantCardNew';
import { getCuisineGradient } from '@/lib/images';

interface CompactRestaurantItemProps {
  restaurant: Restaurant;
  imageUrl?: string | null;
  onNavigate?: (id: string) => void;
  showDistance?: boolean;
  distanceMeters?: number;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} מ׳`;
  return `${(meters / 1000).toFixed(1)} ק״מ`;
}

export function CompactRestaurantItem({
  restaurant,
  imageUrl,
  onNavigate,
  showDistance,
  distanceMeters,
}: CompactRestaurantItemProps) {
  const [expanded, setExpanded] = useState(false);
  const gradientClass = getCuisineGradient(restaurant.cuisine_type);
  const restaurantId = restaurant.id || restaurant.google_places?.place_id || restaurant.name_hebrew;

  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
      {/* Compact row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-right hover:bg-[var(--color-surface-alt,rgba(0,0,0,0.02))] transition-colors"
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative bg-[var(--color-surface)]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={restaurant.name_hebrew}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className={`w-full h-full ${gradientClass} flex items-center justify-center`}>
              <UtensilsCrossed className="w-5 h-5 text-white/70" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[var(--color-ink)] truncate">
              {restaurant.name_english || restaurant.name_hebrew}
            </span>
            {restaurant.mention_level && (
              <MentionLevelBadge mentionLevel={restaurant.mention_level} />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)] mt-0.5">
            {restaurant.location?.city && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {restaurant.location.city}
              </span>
            )}
            {restaurant.cuisine_type && <span>· {restaurant.cuisine_type}</span>}
            {restaurant.rating?.google_rating != null && restaurant.rating.google_rating > 0 && (
              <span className="flex items-center gap-0.5">
                · <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {restaurant.rating.google_rating.toFixed(1)}
              </span>
            )}
          </div>
          {/* Quote preview */}
          {!expanded && (restaurant.engaging_quote || restaurant.host_quotes?.[0]) && (
            <p className="text-xs text-[var(--color-ink-subtle)] mt-0.5 truncate italic">
              &ldquo;{restaurant.engaging_quote || restaurant.host_quotes?.[0]}&rdquo;
            </p>
          )}
        </div>

        {/* Distance + chevron */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-ink-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-ink-muted)]" />
          )}
          {showDistance && distanceMeters != null && (
            <span className="text-[10px] text-[var(--color-accent)]">
              {formatDistance(distanceMeters)}
            </span>
          )}
        </div>
      </button>

      {/* Expanded: full restaurant card */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] animate-fade-up">
          <RestaurantCardNew
            restaurant={restaurant}
            imageUrl={imageUrl || undefined}
            showDistance={showDistance}
            distanceMeters={distanceMeters}
            onTap={() => onNavigate?.(restaurantId)}
          />
        </div>
      )}
    </div>
  );
}
