'use client';

import Image from 'next/image';
import { Flame } from 'lucide-react';
import { Restaurant } from '@/types/restaurant';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getRestaurantImage } from '@/lib/images';

interface TrendingSectionProps {
  restaurants: Restaurant[];
  onRestaurantClick?: (restaurant: Restaurant) => void;
  className?: string;
}

// Get cuisine gradient class
const getCuisineGradient = (cuisine: string | null | undefined): string => {
  if (!cuisine) return 'gradient-default';
  const lower = cuisine.toLowerCase();
  if (lower.includes('הומוס') || lower.includes('hummus')) return 'gradient-hummus';
  if (lower.includes('שווארמה') || lower.includes('shawarma')) return 'gradient-shawarma';
  if (lower.includes('אסי') || lower.includes('סיני') || lower.includes('יפני')) return 'gradient-asian';
  if (lower.includes('איטלקי') || lower.includes('פיצה')) return 'gradient-italian';
  if (lower.includes('דגים') || lower.includes('ים')) return 'gradient-fish';
  if (lower.includes('בשר') || lower.includes('סטייק') || lower.includes('המבורגר')) return 'gradient-meat';
  if (lower.includes('קינוח') || lower.includes('מאפ') || lower.includes('קפה')) return 'gradient-dessert';
  return 'gradient-default';
};

const getPriceDisplay = (priceRange: string | null | undefined): string => {
  switch (priceRange) {
    case 'budget': return '₪';
    case 'mid-range': return '₪₪';
    case 'expensive': return '₪₪₪';
    default: return '';
  }
};

export function TrendingSection({
  restaurants,
  onRestaurantClick,
  className = '',
}: TrendingSectionProps) {
  // Take top 10 for trending
  const trendingRestaurants = restaurants.slice(0, 10);

  if (trendingRestaurants.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <SectionHeader
        icon={<Flame className="w-5 h-5 text-[var(--color-accent)]" />}
        title="חם השבוע"
        action={{
          label: 'ראה הכל',
          href: '/trending',
        }}
      />

      {/* Horizontal scroll container */}
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-2">
        {trendingRestaurants.map((restaurant, index) => (
          <button
            key={restaurant.google_places?.place_id || restaurant.name_hebrew}
            onClick={() => onRestaurantClick?.(restaurant)}
            className="trending-card text-right"
          >
            {/* Image/gradient area */}
            <div className={`trending-card-image ${getCuisineGradient(restaurant.cuisine_type)}`}>
              {getRestaurantImage(restaurant) ? (
                <Image
                  src={getRestaurantImage(restaurant)!}
                  alt={restaurant.name_hebrew}
                  fill
                  className="object-cover"
                  sizes="140px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/80 text-lg font-light">
                    {restaurant.cuisine_type || 'מסעדה'}
                  </span>
                </div>
              )}

              {/* Rank badge */}
              <div className="trending-card-rank">
                #{index + 1}
              </div>
            </div>

            {/* Title */}
            <p className="trending-card-title">{restaurant.name_hebrew}</p>

            {/* Meta */}
            <p className="trending-card-meta">
              {restaurant.location?.city}
              {getPriceDisplay(restaurant.price_range) && (
                <> • {getPriceDisplay(restaurant.price_range)}</>
              )}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
