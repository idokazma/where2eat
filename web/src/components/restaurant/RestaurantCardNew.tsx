'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { Heart, Star, Play, MapPin, ExternalLink, Camera, Calendar, ChevronLeft, ChevronRight, Instagram, X } from 'lucide-react';
import { Restaurant, getCardId } from '@/types/restaurant';
import { EpisodeBadge } from './EpisodeBadge';
import { DistanceBadge } from './DistanceBadge';
import { useFavorites } from '@/contexts/favorites-context';
import { normalizeHostOpinion, getPriceDisplay } from '@/lib/data-normalizer';
import { getTimedYouTubeUrl } from '@/lib/youtube';
import { getYouTubeEmbedUrl } from '@/lib/youtube-embed';
import { getRestaurantImages } from '@/lib/images';

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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Gallery lightbox carousel
  const allImages = getRestaurantImages(restaurant);
  const [galleryRef, galleryApi] = useEmblaCarousel({
    loop: true,
    direction: 'rtl',
  });
  const [gallerySlide, setGallerySlide] = useState(0);

  useEffect(() => {
    if (!galleryApi) return;
    const onSelect = () => setGallerySlide(galleryApi.selectedScrollSnap());
    galleryApi.on('select', onSelect);
    return () => { galleryApi.off('select', onSelect); };
  }, [galleryApi]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (allImages.length > 0) {
      setLightboxOpen(true);
    }
  }, [allImages.length]);

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
  const restaurantId = getCardId(restaurant);
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
      <div className="restaurant-card-image" onClick={allImages.length > 0 ? handleImageClick : undefined} style={allImages.length > 0 ? { cursor: 'pointer' } : undefined}>
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
            timestampSeconds={restaurant.mention_timestamp_seconds}
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
        {/* Status badges */}
        {!!restaurant.is_closing && (
          <span className="inline-block px-2 py-0.5 mb-1 bg-red-500/10 text-red-600 text-xs font-semibold rounded">
            נסגר לצמיתות
          </span>
        )}
        {restaurant.status === 'closing_soon' && !restaurant.is_closing && (
          <span className="inline-block px-2 py-0.5 mb-1 bg-amber-500/10 text-amber-600 text-xs font-semibold rounded">
            נסגר בקרוב
          </span>
        )}
        {restaurant.status === 'new_opening' && (
          <span className="inline-block px-2 py-0.5 mb-1 bg-emerald-500/10 text-emerald-600 text-xs font-semibold rounded">
            חדש!
          </span>
        )}

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

        {/* Episode date */}
        {formattedDate && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-ink-muted)] mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>{formattedDate}</span>
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

  const lightbox = lightboxOpen && allImages.length > 0 ? (
    <div
      className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center"
      onClick={() => setLightboxOpen(false)}
    >
      {/* Close button */}
      <button
        onClick={() => setLightboxOpen(false)}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Photo counter */}
      {allImages.length > 1 && (
        <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium">
          {gallerySlide + 1} / {allImages.length}
        </div>
      )}

      {/* Navigation buttons */}
      {allImages.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); galleryApi?.scrollNext(); }}
            className="absolute right-3 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); galleryApi?.scrollPrev(); }}
            className="absolute left-14 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Embla Carousel */}
      <div
        className="w-full max-w-3xl max-h-[80vh] mx-4 overflow-hidden"
        ref={galleryRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-[80vh]">
          {allImages.map((url, index) => (
            <div key={index} className="relative flex-[0_0_100%] min-w-0">
              <Image
                src={url}
                alt={`${restaurant.name_hebrew} - ${index + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
                priority={index === gallerySlide}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {allImages.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
          {allImages.map((_, index) => (
            <button
              key={index}
              onClick={(e) => { e.stopPropagation(); galleryApi?.scrollTo(index); }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === gallerySlide ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to photo ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;

  // If no video, render card without carousel wrapper
  if (!embedUrl) return <>{cardContent}{lightbox}</>;

  // Swipeable card: slide 1 = restaurant card (96% width to peek YouTube), slide 2 = YouTube embed
  return (
    <>
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex gap-2" style={{ direction: 'rtl' }}>
          {/* Slide 1: Restaurant card — 96% width so YouTube peeks from the left */}
          <div className="flex-[0_0_96%] min-w-0">
            {cardContent}
          </div>

          {/* Slide 2: YouTube embed */}
          <div className="flex-[0_0_96%] min-w-0 bg-black rounded-2xl overflow-hidden">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-2">
                  <Play className="w-12 h-12 text-white/50" />
                  <span className="text-white/40 text-xs">צפה בסרטון</span>
                </div>
              )}
            </div>
            {/* Back to card button */}
            <button
              onClick={() => emblaApi?.scrollTo(0)}
              className="w-full py-3 text-center text-white/70 text-sm hover:text-white transition-colors"
            >
              ← חזרה לכרטיס
            </button>
          </div>
        </div>
      </div>
      {lightbox}
    </>
  );
}
