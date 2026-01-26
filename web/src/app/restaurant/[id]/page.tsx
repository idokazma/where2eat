'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
} from 'lucide-react';
import { Restaurant } from '@/types/restaurant';
import { useFavorites } from '@/contexts/favorites-context';
import { endpoints } from '@/lib/config';

// Cuisine gradient mapping
const cuisineGradients: Record<string, string> = {
  'Italian': 'from-red-500 to-orange-400',
  'Japanese': 'from-pink-400 to-red-500',
  'Asian': 'from-amber-400 to-red-500',
  'Mediterranean': 'from-blue-400 to-teal-400',
  'Israeli': 'from-blue-500 to-white',
  'Mexican': 'from-green-500 to-red-500',
  'American': 'from-red-500 to-blue-500',
  'French': 'from-blue-400 to-red-400',
  'default': 'from-gray-600 to-gray-400',
};

function getGradient(cuisine?: string | null): string {
  if (!cuisine) return cuisineGradients['default'];
  return cuisineGradients[cuisine] || cuisineGradients['default'];
}

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

  const restaurantId = params.id as string;

  useEffect(() => {
    const loadRestaurant = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all restaurants and find by ID (place_id)
        const response = await fetch(endpoints.restaurants.list());
        const data = await response.json();

        if (data.restaurants) {
          const found = data.restaurants.find(
            (r: Restaurant) => r.google_places?.place_id === restaurantId
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
      <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
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

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      {/* Hero Section */}
      <div className="relative h-64 sm:h-80">
        {/* Background gradient */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${getGradient(restaurant.cuisine_type)}`}
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Back button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
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
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <Heart
              className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-white'}`}
            />
          </button>
        </div>

        {/* Restaurant info overlay */}
        <div className="absolute bottom-0 right-0 left-0 p-4">
          {statusBadge && (
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${statusBadge.className}`}>
              {statusBadge.text}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {restaurant.name_hebrew}
          </h1>
          {restaurant.name_english && (
            <p className="text-white/70 text-sm">{restaurant.name_english}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {restaurant.cuisine_type && (
              <span className="text-white/90 text-sm">{restaurant.cuisine_type}</span>
            )}
            {restaurant.price_range && restaurant.price_range !== 'not_mentioned' && (
              <span className="text-white/90 text-sm">
                {getPriceDisplay(restaurant.price_range)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Rating & Quick Actions */}
        <div className="flex items-center justify-between">
          {restaurant.rating?.google_rating && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[var(--color-gold)] text-white px-3 py-1.5 rounded-full">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold">{restaurant.rating.google_rating.toFixed(1)}</span>
              </div>
              {restaurant.rating.total_reviews && (
                <span className="text-sm text-[var(--color-ink-muted)]">
                  ({restaurant.rating.total_reviews} ביקורות)
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleNavigate}
            className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-4 py-2 rounded-full font-medium"
          >
            <Navigation className="w-4 h-4" />
            <span>נווט</span>
          </button>
        </div>

        {/* Episode Badge */}
        {restaurant.episode_info && (
          <Link
            href={restaurant.episode_info.video_url}
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
                  </p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-[var(--color-gold)]" />
            </div>
          </Link>
        )}

        {/* Host Opinion */}
        {restaurant.host_comments && (
          <div className="p-4 rounded-xl bg-[var(--color-surface)]">
            <h2 className="text-sm font-medium text-[var(--color-ink-muted)] mb-2">
              מה המארח אמר
            </h2>
            <p className="text-[var(--color-ink)] leading-relaxed">
              "{restaurant.host_comments}"
            </p>
          </div>
        )}

        {/* Location */}
        {restaurant.location && (restaurant.location.address || restaurant.location.city) && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">מיקום</h2>
            <button
              onClick={handleNavigate}
              className="flex items-start gap-3 p-3 w-full text-right rounded-lg hover:bg-[var(--color-surface)] transition-colors"
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
            </button>
          </div>
        )}

        {/* Contact Info */}
        {restaurant.contact_info && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">פרטי קשר</h2>
            <div className="space-y-2">
              {restaurant.contact_info.phone && (
                <a
                  href={`tel:${restaurant.contact_info.phone}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
                >
                  <Phone className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-[var(--color-ink)]" dir="ltr">
                    {restaurant.contact_info.phone}
                  </span>
                </a>
              )}
              {restaurant.contact_info.website && (
                <a
                  href={restaurant.contact_info.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
                >
                  <Globe className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-[var(--color-ink)]">אתר המסעדה</span>
                  <ExternalLink className="w-4 h-4 text-[var(--color-ink-muted)] mr-auto" />
                </a>
              )}
              {restaurant.contact_info.hours && (
                <div className="flex items-start gap-3 p-3">
                  <Clock className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span className="text-[var(--color-ink)]">{restaurant.contact_info.hours}</span>
                </div>
              )}
            </div>
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
                  className="p-3 rounded-lg bg-[var(--color-surface)]"
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
                      <span className="text-sm font-medium text-[var(--color-ink)]">
                        {item.price}
                      </span>
                    )}
                  </div>
                  {item.recommendation_level === 'highly_recommended' && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-[var(--color-gold)]/10 text-[var(--color-gold)] text-xs rounded">
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
                  className="px-3 py-1.5 bg-[var(--color-surface)] text-[var(--color-ink)] text-sm rounded-full"
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
              className="flex items-center justify-center gap-2 p-3 rounded-lg bg-[var(--color-surface)] text-[var(--color-ink)]"
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
