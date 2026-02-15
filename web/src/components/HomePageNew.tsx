'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Restaurant } from '@/types/restaurant';
import { PageLayout } from '@/components/layout';
import { FilterBar, FilterChip, LocationFilter } from '@/components/filters';
import { TrendingSection, DiscoveryFeed } from '@/components/feed';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PageLoadingSkeleton } from '@/components/ui/skeleton';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { useFavorites } from '@/contexts/favorites-context';
import { endpoints } from '@/lib/config';

const PAGE_SIZE = 20;

// Available cuisines for filtering
const CUISINES = [
  'הומוס',
  'שווארמה',
  'איטלקי',
  'אסייתי',
  'דגים',
  'בשרים',
  'קינוחים',
  'קפה',
];

// Price range options
const PRICE_RANGES = [
  { value: 'budget', label: '₪' },
  { value: 'mid-range', label: '₪₪' },
  { value: 'expensive', label: '₪₪₪' },
];

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
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [isCuisineSheetOpen, setIsCuisineSheetOpen] = useState(false);
  const [isPriceSheetOpen, setIsPriceSheetOpen] = useState(false);

  // Location filter
  const locationFilter = useLocationFilter();

  // Favorites context
  const { setAllRestaurants: setFavoriteContext } = useFavorites();

  // Ref to prevent duplicate fetches
  const isFetchingRef = useRef(false);

  // Build search params from current filters
  const buildSearchParams = useCallback(
    (page: number): Record<string, string> => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
      };

      if (locationFilter.mode === 'manual' && locationFilter.city) {
        params.location = locationFilter.city;
      }

      if (selectedCuisines.length > 0) {
        params.cuisine = selectedCuisines[0];
      }

      if (selectedPriceRanges.length > 0) {
        params.price_range = selectedPriceRanges[0];
      }

      return params;
    },
    [locationFilter.mode, locationFilter.city, selectedCuisines, selectedPriceRanges]
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
        const totalPages = data.analytics?.total_pages ?? 1;
        setHasMore(1 < totalPages);
      }
    } catch (err) {
      console.error('Failed to load restaurants:', err);
      setError('לא ניתן לטעון מסעדות');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [buildSearchParams, setFavoriteContext]);

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
    let result = restaurants;

    // Filter by neighborhood (API only filters by city)
    if (locationFilter.mode === 'manual' && locationFilter.neighborhood) {
      result = result.filter(
        (r) => r.location?.neighborhood === locationFilter.neighborhood
      );
    }

    // Multi-cuisine filtering (API only supports one value; client handles the rest)
    if (selectedCuisines.length > 1) {
      result = result.filter((r) =>
        selectedCuisines.some((c) =>
          r.cuisine_type?.toLowerCase().includes(c.toLowerCase())
        )
      );
    }

    // Multi-price-range filtering
    if (selectedPriceRanges.length > 1) {
      result = result.filter((r) =>
        selectedPriceRanges.includes(r.price_range || '')
      );
    }

    return result;
  }, [
    restaurants,
    locationFilter.mode,
    locationFilter.neighborhood,
    selectedCuisines,
    selectedPriceRanges,
  ]);

  // Handle restaurant click
  const handleRestaurantClick = (restaurant: Restaurant) => {
    const id = restaurant.google_places?.place_id;
    if (id) {
      router.push(`/restaurant/${id}`);
    }
  };

  // Toggle cuisine selection
  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  // Toggle price range selection
  const togglePriceRange = (price: string) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(price)
        ? prev.filter((p) => p !== price)
        : [...prev, price]
    );
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
    <PageLayout showHeader showBottomNav>
      {/* Filter Bar */}
      <div className="animate-fade-up stagger-section-1">
        <FilterBar>
          <LocationFilter />

          {/* Cuisine filter */}
          <FilterChip
            label={selectedCuisines.length > 0 ? `סוג (${selectedCuisines.length})` : 'סוג'}
            isSelected={selectedCuisines.length > 0}
            hasDropdown
            onClick={() => setIsCuisineSheetOpen(true)}
            onClear={selectedCuisines.length > 0 ? () => setSelectedCuisines([]) : undefined}
          />

          {/* Price filter */}
          <FilterChip
            label={selectedPriceRanges.length > 0 ? `מחיר (${selectedPriceRanges.length})` : 'מחיר'}
            isSelected={selectedPriceRanges.length > 0}
            hasDropdown
            onClick={() => setIsPriceSheetOpen(true)}
            onClear={selectedPriceRanges.length > 0 ? () => setSelectedPriceRanges([]) : undefined}
          />
        </FilterBar>
      </div>

      {/* Trending Section */}
      <div className="animate-fade-up stagger-section-2">
        <TrendingSection
          restaurants={restaurants}
          onRestaurantClick={handleRestaurantClick}
          className="mt-2"
        />
      </div>

      {/* Discovery Feed */}
      <div className="animate-fade-up stagger-section-3">
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

      {/* Cuisine Filter Sheet */}
      <BottomSheet
        isOpen={isCuisineSheetOpen}
        onClose={() => setIsCuisineSheetOpen(false)}
        title="סוג מסעדה"
      >
        <div className="grid grid-cols-2 gap-2">
          {CUISINES.map((cuisine) => (
            <button
              key={cuisine}
              onClick={() => toggleCuisine(cuisine)}
              className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                selectedCuisines.includes(cuisine)
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-border)]'
              }`}
            >
              {cuisine}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsCuisineSheetOpen(false)}
          className="w-full mt-4 p-4 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] font-medium"
        >
          אישור
        </button>
      </BottomSheet>

      {/* Price Filter Sheet */}
      <BottomSheet
        isOpen={isPriceSheetOpen}
        onClose={() => setIsPriceSheetOpen(false)}
        title="טווח מחירים"
      >
        <div className="flex gap-2">
          {PRICE_RANGES.map((price) => (
            <button
              key={price.value}
              onClick={() => togglePriceRange(price.value)}
              className={`flex-1 p-4 rounded-lg text-lg font-medium transition-colors ${
                selectedPriceRanges.includes(price.value)
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-border)]'
              }`}
            >
              {price.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsPriceSheetOpen(false)}
          className="w-full mt-4 p-4 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] font-medium"
        >
          אישור
        </button>
      </BottomSheet>
    </PageLayout>
  );
}
