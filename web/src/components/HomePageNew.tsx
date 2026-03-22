'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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

const PAGE_SIZE = 50;

export function HomePageNew() {
  const router = useRouter();

  // Paginated restaurants from server
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);

  // Search (instant, client-side)
  const [searchQuery, setSearchQuery] = useState('');

  // Location filter
  const locationFilter = useLocationFilter();

  // User settings
  const { settings } = useSettings();

  // Favorites context
  const { setAllRestaurants: setFavoriteContext } = useFavorites();

  // Fetch a page of restaurants
  const loadPage = useCallback(async (pageNum: number, append: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    try {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        sort_by: 'published_at',
        sort_direction: 'desc',
      };
      const response = await fetch(endpoints.restaurants.search(params));
      const data = await response.json();
      if (data.restaurants) {
        const newRestaurants = append
          ? [...allRestaurants, ...data.restaurants]
          : data.restaurants;
        setAllRestaurants(newRestaurants);
        setFavoriteContext(newRestaurants);
        setHasMorePages(data.restaurants.length === PAGE_SIZE);
      }
    } catch {
      setError('לא ניתן לטעון מסעדות');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [allRestaurants, setFavoriteContext]);

  // Load first page on mount
  useEffect(() => {
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    }

    return result;
  }, [allRestaurants, searchQuery, locMode, locCity, locNeighborhood, locLat, locLng, settings.showOnlyIsrael]);

  const hasMore = hasMorePages && !searchQuery.trim() && locationFilter.mode !== 'manual';

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMorePages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage, true);
  }, [isLoadingMore, hasMorePages, page, loadPage]);

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
              onClick={() => { setPage(1); loadPage(1); }}
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
          restaurants={processedRestaurants}
          onRestaurantClick={handleRestaurantClick}
          showDistances={locationFilter.mode === 'nearby'}
          userCoords={locationFilter.userCoords}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
          className="mt-6 pb-8"
          totalCount={processedRestaurants.length}
        />
      </div>

    </PageLayout>
  );
}
