'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Restaurant, getCoordinates } from '@/types/restaurant';
import { PageLayout } from '@/components/layout';
import { FilterBar, LocationFilter } from '@/components/filters';
import { DiscoveryFeed } from '@/components/feed';
import { PageLoadingSkeleton } from '@/components/ui/skeleton';
import { useLocationFilter } from '@/contexts/location-filter-context';
import { useSettings } from '@/contexts/settings-context';
import { useFavorites } from '@/contexts/favorites-context';
import { endpoints } from '@/lib/config';

// Israeli cities/regions for filtering
const ISRAEL_REGIONS = ['צפון', 'מרכז', 'דרום', 'ירושלים', 'שרון', 'north', 'center', 'south', 'jerusalem', 'sharon'];
const ISRAEL_CITIES = ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'אשדוד', 'נתניה', 'ראשון לציון', 'פתח תקווה', 'הרצליה', 'רמת גן', 'גבעתיים', 'כפר סבא', 'רעננה', 'הוד השרון', 'רמת השרון', 'בני ברק', 'חולון', 'בת ים', 'אילת', 'טבריה', 'עכו', 'נצרת', 'קיסריה', 'זכרון יעקב', 'יפו', 'רמלה', 'לוד', 'מודיעין', 'אשקלון', 'דימונה', 'ערד', 'עפולה', 'נהריה', 'כרמיאל'];

function isInIsrael(restaurant: Restaurant): boolean {
  const region = restaurant.location?.region?.toLowerCase();
  if (region && ISRAEL_REGIONS.includes(region)) return true;
  const city = restaurant.location?.city;
  if (city && ISRAEL_CITIES.some(c => city.includes(c))) return true;
  const lat = restaurant.location?.lat;
  const lng = restaurant.location?.lng;
  if (lat && lng && lat >= 29.5 && lat <= 33.4 && lng >= 34.2 && lng <= 35.9) return true;
  return false;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// How many cards to render initially / per scroll batch
const RENDER_BATCH = 15;

export function HomePageNew() {
  const router = useRouter();

  // All restaurants loaded once
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progressive rendering — how many to show
  const [renderCount, setRenderCount] = useState(RENDER_BATCH);

  // Search (instant, client-side)
  const [searchQuery, setSearchQuery] = useState('');

  // Location filter
  const locationFilter = useLocationFilter();

  // User settings
  const { settings } = useSettings();

  // Favorites context
  const { setAllRestaurants: setFavoriteContext } = useFavorites();

  // Fetch all restaurants once
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: '1', limit: '1000' };
      const response = await fetch(endpoints.restaurants.search(params));
      const data = await response.json();
      if (data.restaurants) {
        setAllRestaurants(data.restaurants);
        setFavoriteContext(data.restaurants);
      }
    } catch {
      setError('לא ניתן לטעון מסעדות');
    } finally {
      setIsLoading(false);
    }
  }, [setFavoriteContext]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Reset render count when filters change
  useEffect(() => {
    setRenderCount(RENDER_BATCH);
  }, [searchQuery, locationFilter.mode, locationFilter.city, locationFilter.neighborhood]);

  // Client-side filter + sort (instant)
  const processedRestaurants = useMemo(() => {
    let result = allRestaurants.filter((r) => !r.is_closing && r.status !== 'closed');

    // Hide hidden restaurants
    result = result.filter((r) => !r.is_hidden);

    // Search by name, English name, cuisine, host comments
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.name_hebrew?.toLowerCase().includes(q) ||
          r.name_english?.toLowerCase().includes(q) ||
          r.cuisine_type?.toLowerCase().includes(q) ||
          r.host_comments?.toLowerCase().includes(q)
      );
    }

    // Filter by city
    if (locationFilter.mode === 'manual' && locationFilter.city) {
      const city = locationFilter.city.toLowerCase();
      result = result.filter(
        (r) => (r.location?.city || '').toLowerCase().includes(city)
      );
    }

    // Filter by neighborhood
    if (locationFilter.mode === 'manual' && locationFilter.neighborhood) {
      result = result.filter(
        (r) => r.location?.neighborhood === locationFilter.neighborhood
      );
    }

    // Settings: show only Israel
    if (settings.showOnlyIsrael) {
      result = result.filter(isInIsrael);
    }

    // Sort by distance when nearby
    if (locationFilter.mode === 'nearby' && locationFilter.userCoords) {
      const { lat, lng } = locationFilter.userCoords;
      result = [...result].sort((a, b) => {
        const coordsA = getCoordinates(a.location);
        const distA = coordsA ? calculateDistance(lat, lng, coordsA.latitude, coordsA.longitude) : Infinity;
        const coordsB = getCoordinates(b.location);
        const distB = coordsB ? calculateDistance(lat, lng, coordsB.latitude, coordsB.longitude) : Infinity;
        return distA - distB;
      });
    }

    return result;
  }, [allRestaurants, searchQuery, locationFilter, settings.showOnlyIsrael]);

  // Slice for progressive rendering
  const visibleRestaurants = useMemo(
    () => processedRestaurants.slice(0, renderCount),
    [processedRestaurants, renderCount]
  );

  const hasMore = renderCount < processedRestaurants.length;

  const handleLoadMore = useCallback(() => {
    setRenderCount((prev) => Math.min(prev + RENDER_BATCH, processedRestaurants.length));
  }, [processedRestaurants.length]);

  const handleRestaurantClick = (restaurant: Restaurant) => {
    const id = restaurant.google_places?.place_id || restaurant.id;
    if (id) {
      router.push(`/restaurant/${encodeURIComponent(id)}`);
    }
  };

  if (isLoading) {
    return (
      <PageLayout showHeader showBottomNav>
        <PageLoadingSkeleton />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout showHeader showBottomNav>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center px-4">
            <p className="text-lg font-medium text-[var(--color-negative)]">{error}</p>
            <button
              onClick={loadAll}
              className="mt-4 px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg font-medium"
            >
              נסה שוב
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout showHeader showBottomNav showSearch={false}>
      {/* Search + Filters */}
      <div className="animate-fade-up stagger-section-1">
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-subtle)]" />
            <input
              type="text"
              placeholder="חיפוש מסעדה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>
        <FilterBar>
          <LocationFilter />
        </FilterBar>
      </div>

      {/* Discovery Feed — progressive render */}
      <div className="animate-fade-up stagger-section-2">
        <DiscoveryFeed
          restaurants={visibleRestaurants}
          onRestaurantClick={handleRestaurantClick}
          showDistances={locationFilter.mode === 'nearby'}
          userCoords={locationFilter.userCoords}
          hasMore={hasMore}
          isLoadingMore={false}
          onLoadMore={handleLoadMore}
          className="mt-6 pb-8"
          totalCount={processedRestaurants.length}
        />
      </div>

    </PageLayout>
  );
}
