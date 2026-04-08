'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Shuffle } from 'lucide-react';
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

  // Feeling Lucky — shuffle seed (null = default order, number = shuffled)
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);

  const handleShuffle = useCallback(() => {
    setShuffleSeed(Math.random());
    setRenderCount(RENDER_BATCH);
  }, []);

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
      const params: Record<string, string> = { page: '1', limit: '500' };
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

  // Stable references for memo deps
  const locMode = locationFilter.mode;
  const locCity = locationFilter.city;
  const locNeighborhood = locationFilter.neighborhood;
  const locLat = locationFilter.userCoords?.lat ?? null;
  const locLng = locationFilter.userCoords?.lng ?? null;

  // Client-side filter + sort (instant)
  const processedRestaurants = useMemo(() => {
    let result = allRestaurants.filter((r) => !r.is_hidden && !r.is_closing && r.status !== 'closed' && r.status !== 'סגור');

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
    if (locMode === 'manual' && locCity) {
      const city = locCity.toLowerCase();
      result = result.filter(
        (r) => (r.location?.city || '').toLowerCase().includes(city)
      );
    }

    // Filter by neighborhood
    if (locMode === 'manual' && locNeighborhood) {
      result = result.filter(
        (r) => r.location?.neighborhood === locNeighborhood
      );
    }

    // Settings: show only Israel
    if (settings.showOnlyIsrael) {
      result = result.filter(isInIsrael);
    }

    // Sort by distance when nearby (only when we have coords)
    if (locMode === 'nearby' && locLat !== null && locLng !== null) {
      result = [...result].sort((a, b) => {
        const coordsA = getCoordinates(a.location);
        const distA = coordsA ? calculateDistance(locLat, locLng, coordsA.latitude, coordsA.longitude) : Infinity;
        const coordsB = getCoordinates(b.location);
        const distB = coordsB ? calculateDistance(locLat, locLng, coordsB.latitude, coordsB.longitude) : Infinity;
        return distA - distB;
      });
    } else if (shuffleSeed !== null) {
      // Feeling Lucky — stable shuffle: each item gets a deterministic random
      // value derived from both its index AND the seed, so every click produces
      // a different order but the same seed always gives the same order (no
      // re-shuffle on re-render).
      result = result.map((r, i) => ({
        r,
        rand: Math.sin(shuffleSeed + i * 127.1) * 43758.5453 % 1,
      })).sort((a, b) => a.rand - b.rand).map(({ r }) => r);
    }

    return result;
  }, [allRestaurants, searchQuery, locMode, locCity, locNeighborhood, locLat, locLng, settings.showOnlyIsrael, shuffleSeed]);

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
          <button
            onClick={handleShuffle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${
              shuffleSeed !== null
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-ink-subtle)] border border-[var(--color-border)]'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>ערבב</span>
          </button>
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
          className="mt-2 pb-8"
        />
      </div>

    </PageLayout>
  );
}
