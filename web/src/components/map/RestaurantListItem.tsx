'use client';

import { memo } from 'react';
import { Star, Heart, MapPin } from 'lucide-react';
import { formatDistance } from '@/lib/geo-utils';

interface RestaurantListItemProps {
  name: string;
  cuisineType?: string | null;
  city?: string | null;
  googleRating?: number | null;
  totalReviews?: number | null;
  distance?: number | null; // km
  heatColor?: string;
  isFavorite?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
}

export const RestaurantListItem = memo(function RestaurantListItem({
  name,
  cuisineType,
  city,
  googleRating,
  distance,
  heatColor,
  isFavorite,
  isHighlighted,
  onClick,
}: RestaurantListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors ${
        isHighlighted
          ? 'bg-blue-50 border-r-[3px] border-r-blue-500'
          : 'bg-white hover:bg-gray-50 border-r-[3px] border-r-transparent'
      }`}
      dir="rtl"
    >
      {/* Heat color dot */}
      {heatColor && (
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: heatColor }}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-[var(--color-ink)] truncate">
            {name}
          </span>
          {isFavorite && (
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-ink-muted)]">
          {cuisineType && <span className="truncate">{cuisineType}</span>}
          {cuisineType && city && <span>·</span>}
          {city && (
            <span className="flex items-center gap-0.5 flex-shrink-0">
              <MapPin className="w-3 h-3" />
              {city}
            </span>
          )}
        </div>
      </div>

      {/* Right side: rating + distance */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {googleRating && (
          <div className="flex items-center gap-0.5">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-semibold">{googleRating.toFixed(1)}</span>
          </div>
        )}
        {distance != null && (
          <span className="text-[10px] text-[var(--color-ink-muted)]">
            {formatDistance(distance)}
          </span>
        )}
      </div>
    </button>
  );
});
