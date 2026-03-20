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
  // Check by coordinates (rough Israel bounding box)
  const lat = restaurant.location?.lat;
  const lng = restaurant.location?.lng;
  if (lat && lng && lat >= 29.5 && lat <= 33.4 && lng >= 34.2 && lng <= 35.9) return true;
  return false;
}

const PAGE_SIZE = 15;

export function HomePageNew() {
  const router = useRouter();

  // Data state
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Location filter
  const locationFilter = useLocationFilter();

  // User settings
  const { settings } = useSettings();

  // Favorites context
  const { setAllRestaurants: setFavoriteContext } = useFavorites();

  // Ref to prevent duplicate fetches
  const isFetchingRef = useRef(false);

  const isNearby = locationFilter.mode === 'nearby';

  // Build search params from current filters
  const buildSearchParams = useCallback(
    (page: number): Record<string, string> => {
      const params: Record<string, string> = {
        page: String(page),
        // When nearby, fetch a large batch so distance sort covers all restaurants
        limit: isNearby ? '500' : String(PAGE_SIZE),
      };

      if (locationFilter.mode === 'manual' && locationFilter.city) {
        params.location = locationFilter.city;
      }

      return params;
    },
    [locationFilter.mode, locationFilter.city, isNearby]
  );

  // Load restaurants (first page)
  const loadRestaurants = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const params = buildSearchParams(1);
      const response = await fetch(endpoints.restaurants.search(params));
      const data = await response.json();

      if (data.restaurants) {
        setRestaurants(data.restaurants);
        setFavoriteContext(data.restaurants);
        setCurrentPage(1);
        // When nearby, all restaurants are in one batch — no more pages
        const totalPages = data.analytics?.total_pages ?? 1;
        setHasMore(!isNearby && 1 < totalPages);
      }
    } catch (err) {
      console.error('Failed to load restaurants:', err);
      setError('לא ניתן לטעון מסעדות');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [buildSearchParams, setFavoriteContext, isNearby]);

  // Load more restaurants (next page)
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore) return;
    isFetchingRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const params = buildSearchParams(nextPage);
      const response = await fetch(endpoints.restaurants.search(params));
      const data = await response.json();

      if (data.restaurants?.length) {
        setRestaurants((prev) => {
          const updated = [...prev, ...data.restaurants];
          setFavoriteContext(updated);
          return updated;
        });
        setCurrentPage(nextPage);
        const totalPages = data.analytics?.total_pages ?? 1;
        setHasMore(nextPage < totalPages);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more restaurants:', err);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [currentPage, hasMore, buildSearchParams, setFavoriteContext]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  // Client-side filtering for neighborhood (not supported by API) and multi-value filters
  const filteredRestaurants = useMemo(() => {
    // Exclude closed restaurants
    let result = restaurants.filter((r) => !r.is_closing && r.status !== 'closed');

    // Search by name
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.name_hebrew?.toLowerCase().includes(q) ||
          r.name_english?.toLowerCase().includes(q) ||
          r.cuisine_type?.toLowerCase().includes(q)
      );
    }

    // Filter by neighborhood (API only filters by city)
    if (locationFilter.mode === 'manual' && locationFilter.neighborhood) {
      result = result.filter(
        (r) => r.location?.neighborhood === locationFilter.neighborhood
      );
    }

    // Settings: show only Israel
    if (settings.showOnlyIsrael) {
      result = result.filter(isInIsrael);
    }

    // Nearby mode: keep all restaurants with coordinates (DiscoveryFeed sorts by distance)
    // Restaurants without coordinates go to the end of the list


    return result;
  }, [
    restaurants,
    searchQuery,
    locationFilter.mode,
    locationFilter.neighborhood,
    settings.showOnlyIsrael,
  ]);

  // Handle restaurant click
  const handleRestaurantClick = (restaurant: Restaurant) => {
    const id = restaurant.google_places?.place_id || restaurant.id;
    if (id) {
      router.push(`/restaurant/${encodeURIComponent(id)}`);
    }
  };

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <PageLayout showHeader showBottomNav>
        <PageLoadingSkeleton />
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout showHeader showBottomNav>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center px-4">
            <p className="text-lg font-medium text-[var(--color-negative)]">{error}</p>
            <button
              onClick={loadRestaurants}
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

      {/* Discovery Feed */}
      <div className="animate-fade-up stagger-section-2">
        <DiscoveryFeed
          restaurants={filteredRestaurants}
          onRestaurantClick={handleRestaurantClick}
          showDistances={locationFilter.mode === 'nearby'}
          userCoords={locationFilter.userCoords}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          className="mt-6 pb-8"
        />
      </div>

    </PageLayout>
  );
}
