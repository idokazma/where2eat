'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { Heart, Star, Play, MapPin, ExternalLink, Camera, Calendar, ChevronLeft, Instagram } from 'lucide-react';
import { Restaurant } from '@/types/restaurant';
import { EpisodeBadge } from './EpisodeBadge';
import { DistanceBadge } from './DistanceBadge';
import { useFavorites } from '@/contexts/favorites-context';
import { normalizeHostOpinion, getPriceDisplay } from '@/lib/data-normalizer';
import { getTimedYouTubeUrl } from '@/lib/youtube';
import { getYouTubeEmbedUrl } from '@/lib/youtube-embed';

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

// Removed: now using getPriceDisplay from data-normalizer

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
  const [showVideo, setShowVideo] = useState(false);

  const videoUrl = restaurant.episode_info?.video_url;
  const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl, restaurant.mention_timestamp_seconds) : null;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    direction: 'rtl',
    watchDrag: !!embedUrl,
  });

  // Track which slide is active
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setShowVideo(emblaApi.selectedScrollSnap() === 1);
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  // First-time swipe hint: auto-slide then snap back
  const [hintPlayed, setHintPlayed] = useState(false);
  useEffect(() => {
    if (!emblaApi || !embedUrl || hintPlayed) return;
    // Check localStorage — only show once ever
    const key = 'w2e_swipe_hint_shown';
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return;

    const timer = setTimeout(() => {
      if (!emblaApi) return;
      // Scroll partially to reveal YouTube card
      emblaApi.scrollTo(1);
      setTimeout(() => {
        emblaApi.scrollTo(0);
        if (typeof window !== 'undefined') localStorage.setItem(key, '1');
        setHintPlayed(true);
      }, 800);
    }, 1500);

    return () => clearTimeout(timer);
  }, [emblaApi, embedUrl, hintPlayed]);
  const hasImage = imageUrl && !imageError;
  const photoCount = restaurant.photos?.length || 0;
  const restaurantId = restaurant.id || restaurant.google_places?.place_id || restaurant.name_hebrew;
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
    const videoUrl = restaurant.episode_info?.video_url;
    if (videoUrl) {
      window.open(
        getTimedYouTubeUrl(videoUrl, restaurant.mention_timestamp_seconds),
        '_blank'
      );
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

  // Check if restaurant is from last 7 days
  const isNew = (() => {
    const dateStr = restaurant.published_at || restaurant.episode_info?.published_at || restaurant.episode_info?.analysis_date;
    if (!dateStr) return false;
    const diff = Date.now() - new Date(dateStr).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  })();

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

  // Format episode date
  const episodeDate = restaurant.published_at || restaurant.episode_info?.published_at || restaurant.episode_info?.analysis_date;
  const formattedDate = episodeDate
    ? new Date(episodeDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Extract episode number from video URL if available
  const getEpisodeNumber = (): number | undefined => {
    // This would typically come from the API
    return undefined;
  };

  const cardContent = (
    <article
      className={`restaurant-card ${className}`}
      onClick={!showVideo ? onTap : undefined}
      role={onTap && !showVideo ? 'button' : undefined}
      tabIndex={onTap && !showVideo ? 0 : undefined}
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

        {/* Status badges — top right on image (closed/closing only) */}
        {(!!restaurant.is_closing || restaurant.status === 'closing_soon') && (
          <div className="absolute top-3 right-3 z-10">
            {!!restaurant.is_closing && (
              <span className="px-2 py-1 bg-red-600 backdrop-blur-sm rounded text-white text-[10px] font-bold">
                נסגר
              </span>
            )}
            {restaurant.status === 'closing_soon' && !restaurant.is_closing && (
              <span className="px-2 py-1 bg-amber-500 backdrop-blur-sm rounded text-white text-[10px] font-bold">
                נסגר בקרוב
              </span>
            )}
          </div>
        )}

        {/* Bottom badges */}
        <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between">
          <div />
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
        {/* Title - prefer Hebrew name, fall back to Google name */}
        <h3 className="restaurant-card-title">
          {restaurant.name_english || restaurant.name_hebrew || restaurant.google_places?.google_name}
        </h3>

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

        {/* Episode date + new badge */}
        {formattedDate && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)] mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>{formattedDate}</span>
            {isNew && (
              <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded leading-none">
                חדש
              </span>
            )}
          </div>
        )}

        {/* Host quote */}
        {restaurant.host_comments && (
          <div className="restaurant-card-quote">
            &ldquo;{restaurant.host_comments}&rdquo;
          </div>
        )}

        {/* Actions */}
        <div className="restaurant-card-actions">
          {/* Rating */}
          {restaurant.rating?.google_rating != null && restaurant.rating.google_rating > 0 && (
            <button className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <Star className="w-3.5 h-3.5 text-[var(--color-gold)] fill-[var(--color-gold)]" />
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

          {/* Watch — swipe to see video inline */}
          {embedUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                emblaApi?.scrollTo(1);
              }}
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
              aria-label="Navigate to restaurant"
            >
              <MapPin className="w-4 h-4" />
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {/* Instagram */}
          {restaurant.instagram_url && (
            <a
              href={restaurant.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium text-pink-500 hover:text-pink-600 transition-colors mr-auto"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  );

  // If no video, render card without carousel wrapper
  if (!embedUrl) return cardContent;

  // Swipeable card: slide 1 = restaurant card (96% width to peek YouTube), slide 2 = YouTube embed
  return (
    <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
      <div className="flex gap-2" style={{ direction: 'rtl' }}>
        {/* Slide 1: Restaurant card — 96% width so YouTube peeks from the left */}
        <div className="flex-[0_0_96%] min-w-0">
          {cardContent}
        </div>

        {/* Slide 2: YouTube embed */}
        <div className="flex-[0_0_96%] min-w-0 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-accent)' }}>
          <div className="relative w-full" style={{ paddingBottom: '75%' }}>
            {showVideo && (
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${restaurant.name_hebrew} - Episode`}
              />
            )}
            {!showVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ backgroundColor: 'var(--color-accent)' }}>
                <Play className="w-12 h-12 text-white/80" />
                <span className="text-white/70 text-xs font-medium">צפה בסרטון</span>
              </div>
            )}
          </div>
          {/* Back to card button */}
          <button
            onClick={() => emblaApi?.scrollTo(0)}
            className="w-full py-3 text-center text-white/80 text-sm font-medium hover:text-white transition-colors"
          >
            ← חזרה לכרטיס
          </button>
        </div>
      </div>
    </div>
  );
}
