'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Heart, Star, Play, MapPin, ExternalLink, Camera } from 'lucide-react';
import { Restaurant } from '@/types/restaurant';
import { EpisodeBadge } from './EpisodeBadge';
import { DistanceBadge } from './DistanceBadge';
import { useFavorites } from '@/contexts/favorites-context';

interface RestaurantCardNewProps {
  restaurant: Restaurant;
  variant?: 'default' | 'compact' | 'featured';
  showDistance?: boolean;
  distanceMeters?: number;
  onTap?: () => void;
  className?: string;
  imageUrl?: string;
}

// Cuisine to gradient mapping
const cuisineGradients: Record<string, string> = {
  'הומוס': 'gradient-hummus',
  'hummus': 'gradient-hummus',
  'שווארמה': 'gradient-shawarma',
  'shawarma': 'gradient-shawarma',
  'אסייתי': 'gradient-asian',
  'asian': 'gradient-asian',
  'סיני': 'gradient-asian',
  'יפני': 'gradient-asian',
  'תאילנדי': 'gradient-asian',
  'איטלקי': 'gradient-italian',
  'italian': 'gradient-italian',
  'פיצה': 'gradient-italian',
  'דגים': 'gradient-fish',
  'fish': 'gradient-fish',
  'פירות ים': 'gradient-fish',
  'בשרים': 'gradient-meat',
  'meat': 'gradient-meat',
  'סטייק': 'gradient-meat',
  'המבורגר': 'gradient-meat',
  'קינוחים': 'gradient-dessert',
  'dessert': 'gradient-dessert',
  'מאפים': 'gradient-dessert',
  'קפה': 'gradient-dessert',
};

const getGradientClass = (cuisine: string | null | undefined): string => {
  if (!cuisine) return 'gradient-default';
  const lowerCuisine = cuisine.toLowerCase();
  for (const [key, value] of Object.entries(cuisineGradients)) {
    if (lowerCuisine.includes(key.toLowerCase())) {
      return value;
    }
  }
  return 'gradient-default';
};

const getPriceDisplay = (priceRange: string | null | undefined): string => {
  switch (priceRange) {
    case 'budget':
      return '₪';
    case 'mid-range':
      return '₪₪';
    case 'expensive':
      return '₪₪₪';
    default:
      return '';
  }
};

export function RestaurantCardNew({
  restaurant,
  variant = 'default',
  showDistance = false,
  distanceMeters,
  onTap,
  className = '',
  imageUrl,
}: RestaurantCardNewProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [imageError, setImageError] = useState(false);

  const [imageLoading, setImageLoading] = useState(true);
  const hasImage = imageUrl && !imageError;
  const photoCount = restaurant.photos?.length || 0;
  const restaurantId = restaurant.google_places?.place_id || restaurant.name_hebrew;
  const isSaved = isFavorite(restaurantId);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved) {
      removeFavorite(restaurantId);
    } else {
      addFavorite(restaurantId);
    }
  };

  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (restaurant.episode_info?.video_url) {
      window.open(restaurant.episode_info.video_url, '_blank');
    }
  };

  const handleNavigateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (restaurant.google_places?.google_url) {
      window.open(restaurant.google_places.google_url, '_blank');
    } else if (restaurant.location?.address) {
      const query = encodeURIComponent(
        `${restaurant.name_hebrew} ${restaurant.location.address}`
      );
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  // Build meta items
  const metaItems: string[] = [];
  if (restaurant.location?.city) {
    metaItems.push(restaurant.location.city);
  }
  if (restaurant.location?.neighborhood) {
    metaItems.push(restaurant.location.neighborhood);
  }
  if (restaurant.cuisine_type) {
    metaItems.push(restaurant.cuisine_type);
  }
  const priceDisplay = getPriceDisplay(restaurant.price_range);
  if (priceDisplay) {
    metaItems.push(priceDisplay);
  }

  // Extract episode number from video URL if available
  const getEpisodeNumber = (): number | undefined => {
    // This would typically come from the API
    return undefined;
  };

  return (
    <article
      className={`restaurant-card ${className}`}
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
    >
      {/* Image Section */}
      <div className="restaurant-card-image">
        {hasImage ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 shimmer bg-[var(--color-surface)]" />
            )}
            <Image
              src={imageUrl}
              alt={restaurant.name_hebrew}
              fill
              className={`object-cover transition-opacity duration-500 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onError={() => setImageError(true)}
              onLoad={() => setImageLoading(false)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </>
        ) : (
          <div
            className={`absolute inset-0 typography-card-bg ${getGradientClass(
              restaurant.cuisine_type
            )}`}
          >
            <span className="opacity-80">{restaurant.cuisine_type || 'מסעדה'}</span>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 overlay-dark" />

        {/* Badges */}
        <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between">
          <EpisodeBadge
            episodeNumber={getEpisodeNumber()}
            showName="פודי"
            videoUrl={restaurant.episode_info?.video_url}
            size="sm"
          />

          <div className="flex items-center gap-2">
            {photoCount > 1 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-white text-xs font-medium">
                <Camera className="w-3 h-3" />
                {photoCount}
              </span>
            )}
            {showDistance && distanceMeters && (
              <DistanceBadge distanceMeters={distanceMeters} />
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="restaurant-card-content">
        {/* Title */}
        <h3 className="restaurant-card-title">{restaurant.name_hebrew}</h3>

        {/* Meta line */}
        {metaItems.length > 0 && (
          <div className="restaurant-card-meta">
            {metaItems.map((item, index) => (
              <span key={index} className="flex items-center gap-2">
                {index > 0 && <span className="restaurant-card-meta-separator" />}
                {item}
              </span>
            ))}
          </div>
        )}

        {/* Host quote */}
        {restaurant.host_comments && restaurant.host_opinion === 'positive' && (
          <div className="restaurant-card-quote">
            &ldquo;{restaurant.host_comments}&rdquo;
          </div>
        )}

        {/* Actions */}
        <div className="restaurant-card-actions">
          {/* Rating */}
          {restaurant.rating?.google_rating && (
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium">
              <Star className="w-4 h-4 text-[var(--color-gold)] fill-[var(--color-gold)]" />
              <span className="font-accent">{restaurant.rating.google_rating.toFixed(1)}</span>
            </button>
          )}

          {/* Save */}
          <button
            onClick={handleSaveClick}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isSaved
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]'
            }`}
            aria-label={isSaved ? 'Remove from saved' : 'Save'}
          >
            <Heart
              className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`}
            />
          </button>

          {/* Watch */}
          {restaurant.episode_info?.video_url && (
            <button
              onClick={handleWatchClick}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
              aria-label="Watch episode"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          {/* Navigate */}
          {(restaurant.google_places?.google_url || restaurant.location?.address) && (
            <button
              onClick={handleNavigateClick}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors mr-auto"
              aria-label="Navigate to restaurant"
            >
              <MapPin className="w-4 h-4" />
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
