'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Restaurant } from '@/types/restaurant';
import {
  ChevronRight,
  Star,
  Heart,
  MapPin,
  Phone,
  Globe,
  Clock,
  Play,
  Navigation,
  Share2,
  ExternalLink,
  RefreshCw,
  Utensils,
  Camera,
} from 'lucide-react';
import { useFavorites } from '@/contexts/favorites-context';
import { endpoints } from '@/lib/config';
import { getRestaurantImage, getRestaurantImages, getCuisineGradient } from '@/lib/images';
import { PhotoGallery } from '@/components/restaurant/PhotoGallery';

function getPriceDisplay(priceRange?: string | null): string {
  switch (priceRange) {
    case 'budget': return '₪';
    case 'mid-range': return '₪₪';
    case 'expensive': return '₪₪₪';
    default: return '';
  }
}

function getStatusBadge(status?: string | null) {
  switch (status) {
    case 'new_opening':
      return { text: 'חדש!', className: 'bg-green-500 text-white' };
    case 'closing_soon':
      return { text: 'נסגר בקרוב', className: 'bg-red-500 text-white' };
    case 'closed':
      return { text: 'סגור', className: 'bg-gray-500 text-white' };
    default:
      return null;
  }
}

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroImageError, setHeroImageError] = useState(false);
  const [heroImageLoading, setHeroImageLoading] = useState(true);

  const restaurantId = params.id as string;

  useEffect(() => {
    const loadRestaurant = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(endpoints.restaurants.list());
        const data = await response.json();

        if (data.restaurants) {
          const found = data.restaurants.find(
            (r: Restaurant) => r.google_places?.place_id === restaurantId || r.id === restaurantId
          );
          if (found) {
            setRestaurant(found);
          } else {
            setError('המסעדה לא נמצאה');
          }
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
        setError('שגיאה בטעינת המסעדה');
      } finally {
        setIsLoading(false);
      }
    };

    if (restaurantId) {
      loadRestaurant();
    }
  }, [restaurantId]);

  const handleShare = async () => {
    if (navigator.share && restaurant) {
      try {
        await navigator.share({
          title: restaurant.name_hebrew,
          text: `מסעדת ${restaurant.name_hebrew} - Where2Eat`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    }
  };

  const handleNavigate = () => {
    if (restaurant?.google_places?.google_url) {
      window.open(restaurant.google_places.google_url, '_blank');
    } else if (restaurant?.location?.address) {
      const query = encodeURIComponent(
        `${restaurant.name_hebrew} ${restaurant.location.address}`
      );
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-paper)]">
        {/* Skeleton hero */}
        <div className="relative h-72 sm:h-96 shimmer bg-[var(--color-surface)]" />
        <div className="px-4 py-6 space-y-4">
          <div className="h-8 w-48 skeleton rounded" />
          <div className="h-4 w-32 skeleton rounded" />
          <div className="h-20 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-[var(--color-paper)] flex flex-col items-center justify-center px-4">
        <p className="text-[var(--color-ink-muted)] mb-4">{error || 'המסעדה לא נמצאה'}</p>
        <button
          onClick={() => router.back()}
          className="text-[var(--color-accent)] font-medium"
        >
          חזרה
        </button>
      </div>
    );
  }

  const statusBadge = getStatusBadge(restaurant.status);
  const isSaved = restaurant.google_places?.place_id
    ? isFavorite(restaurant.google_places.place_id)
    : false;

  const heroImage = getRestaurantImage(restaurant);
  const allPhotos = getRestaurantImages(restaurant);
  const hasHeroImage = heroImage && !heroImageError;

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      {/* Hero Section */}
      <div className="relative h-72 sm:h-96 overflow-hidden">
        {/* Background: image or gradient */}
        {hasHeroImage ? (
          <>
            {heroImageLoading && (
              <div className="absolute inset-0 shimmer bg-[var(--color-surface)]" />
            )}
            <Image
              src={heroImage}
              alt={restaurant.name_hebrew}
              fill
              className={`object-cover transition-opacity duration-700 ${
                heroImageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onError={() => setHeroImageError(true)}
              onLoad={() => setHeroImageLoading(false)}
              sizes="100vw"
              priority
            />
          </>
        ) : (
          <div
            className={`absolute inset-0 ${getCuisineGradient(restaurant.cuisine_type)}`}
          />
        )}

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />

        {/* Back button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => {
              const placeId = restaurant.google_places?.place_id;
              if (placeId) {
                if (isFavorite(placeId)) {
                  removeFavorite(placeId);
                } else {
                  addFavorite(placeId);
                }
              }
            }}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10"
          >
            <Heart
              className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-white'}`}
            />
          </button>
        </div>

        {/* Photo count badge */}
        {allPhotos.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10">
            <Camera className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-medium">{allPhotos.length} תמונות</span>
          </div>
        )}

        {/* Restaurant info overlay */}
        <div className="absolute bottom-0 right-0 left-0 p-5">
          {statusBadge && (
            <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold mb-2 ${statusBadge.className}`}>
              {statusBadge.text}
            </span>
          )}
          <h1
            className="text-3xl sm:text-4xl font-black text-white mb-1"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {restaurant.name_hebrew}
          </h1>
          {restaurant.name_english && (
            <p className="text-white/60 text-sm font-accent">{restaurant.name_english}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {restaurant.cuisine_type && (
              <span className="px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                {restaurant.cuisine_type}
              </span>
            )}
            {restaurant.price_range && restaurant.price_range !== 'not_mentioned' && (
              <span className="px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                {getPriceDisplay(restaurant.price_range)}
              </span>
            )}
            {restaurant.rating?.google_rating && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-[var(--color-gold)]/90 rounded-md text-white text-xs font-bold font-accent">
                <Star className="w-3 h-3 fill-current" />
                {restaurant.rating.google_rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      {allPhotos.length > 1 && (
        <div className="py-4">
          <PhotoGallery photos={allPhotos} restaurantName={restaurant.name_hebrew} />
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4 space-y-5">
        {/* Quick Actions Bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleNavigate}
            className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-semibold text-sm"
          >
            <Navigation className="w-4 h-4" />
            <span>נווט למסעדה</span>
          </button>
          {restaurant.contact_info?.phone && (
            <a
              href={`tel:${restaurant.contact_info.phone}`}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
            >
              <Phone className="w-5 h-5 text-[var(--color-ink)]" />
            </a>
          )}
          {restaurant.contact_info?.website && (
            <a
              href={restaurant.contact_info.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
            >
              <Globe className="w-5 h-5 text-[var(--color-ink)]" />
            </a>
          )}
        </div>

        {/* Rating detail */}
        {restaurant.rating?.google_rating && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface)]">
            <div className="flex items-center gap-1 text-[var(--color-gold)]">
              <Star className="w-5 h-5 fill-current" />
              <span className="text-lg font-bold">{restaurant.rating.google_rating.toFixed(1)}</span>
            </div>
            {restaurant.rating.total_reviews && (
              <span className="text-sm text-[var(--color-ink-muted)]">
                {restaurant.rating.total_reviews.toLocaleString()} ביקורות ב-Google
              </span>
            )}
          </div>
        )}

        {/* Episode Badge with timed YouTube link */}
        {restaurant.episode_info && (() => {
          const ts = restaurant.mention_timestamp_seconds;
          const timedUrl = ts && ts > 0
            ? `${restaurant.episode_info.video_url}${restaurant.episode_info.video_url.includes('?') ? '&' : '?'}t=${ts}`
            : restaurant.episode_info.video_url;
          const timeLabel = ts && ts > 0
            ? `${Math.floor(ts / 60)}:${String(ts % 60).padStart(2, '0')}`
            : null;

          return (
            <Link
              href={timedUrl}
              target="_blank"
              className="block p-4 rounded-xl bg-gradient-to-l from-[var(--color-gold)]/10 to-transparent border border-[var(--color-gold)]/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-gold)] flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      הוזכר בפודקאסט
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {new Date(restaurant.episode_info.analysis_date).toLocaleDateString('he-IL')}
                      {timeLabel && (
                        <span className="mr-2 text-[var(--color-gold)]">
                          צפה מ-{timeLabel}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-[var(--color-gold)]" />
              </div>
            </Link>
          );
        })()}

        {/* Host Opinion / Engaging Quote */}
        {(restaurant.engaging_quote || restaurant.host_comments) && (
          <div className="p-4 rounded-xl bg-[var(--color-surface)] border-r-4 border-r-[var(--color-gold)]">
            <h2 className="text-sm font-medium text-[var(--color-ink-muted)] mb-2">
              מה המארח אמר
            </h2>
            <p className="text-[var(--color-ink)] leading-relaxed text-[15px]">
              &ldquo;{restaurant.engaging_quote || restaurant.host_comments}&rdquo;
            </p>
            {restaurant.engaging_quote && restaurant.host_comments && restaurant.engaging_quote !== restaurant.host_comments && (
              <p className="text-[var(--color-ink-muted)] text-sm mt-2 leading-relaxed">
                {restaurant.host_comments}
              </p>
            )}
          </div>
        )}

        {/* Location */}
        {restaurant.location && (restaurant.location.address || restaurant.location.city) && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">מיקום</h2>
            <button
              onClick={handleNavigate}
              className="flex items-start gap-3 p-3 w-full text-right rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-border)] transition-colors"
            >
              <MapPin className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
              <div>
                {restaurant.location.address && (
                  <p className="text-[var(--color-ink)]">{restaurant.location.address}</p>
                )}
                {restaurant.location.neighborhood && restaurant.location.city && (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {restaurant.location.neighborhood}, {restaurant.location.city}
                  </p>
                )}
              </div>
              <ExternalLink className="w-4 h-4 text-[var(--color-ink-subtle)] mr-auto flex-shrink-0 mt-0.5" />
            </button>
          </div>
        )}

        {/* Contact Info */}
        {restaurant.contact_info?.hours && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface)]">
            <Clock className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
            <span className="text-[var(--color-ink)] text-sm">{restaurant.contact_info.hours}</span>
          </div>
        )}

        {/* Menu Items */}
        {restaurant.menu_items && restaurant.menu_items.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">מנות מומלצות</h2>
            <div className="space-y-2">
              {restaurant.menu_items.map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-[var(--color-surface)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <Utensils className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-medium text-[var(--color-ink)]">
                          {item.item_name}
                        </p>
                        {item.description && (
                          <p className="text-sm text-[var(--color-ink-muted)] mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.price && (
                      <span className="text-sm font-medium text-[var(--color-ink)] flex-shrink-0">
                        {item.price}
                      </span>
                    )}
                  </div>
                  {item.recommendation_level === 'highly_recommended' && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-[var(--color-gold)]/10 text-[var(--color-gold)] text-xs rounded font-medium">
                      מומלץ במיוחד
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Special Features */}
        {restaurant.special_features && restaurant.special_features.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">מאפיינים מיוחדים</h2>
            <div className="flex flex-wrap gap-2">
              {restaurant.special_features.map((feature, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-[var(--color-surface)] text-[var(--color-ink)] text-sm rounded-full border border-[var(--color-border)]"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Google Places Link */}
        {restaurant.google_places?.google_url && (
          <div className="pt-4 border-t border-[var(--color-border)]">
            <a
              href={restaurant.google_places.google_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-border)] transition-colors"
            >
              <span>צפה ב-Google Maps</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Bottom spacing for safe area */}
        <div className="h-8" />
      </div>
    </div>
  );
}
