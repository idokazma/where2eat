'use client';

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Restaurant } from '@/types/restaurant';
import { PageLayout } from '@/components/layout';
import { FilterBar, FilterChip, LocationFilter } from '@/components/filters';
import { TrendingSection, DiscoveryFeed } from '@/components/feed';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { useFavorites } from '@/contexts/favorites-context';
import { endpoints } from '@/lib/config';

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
  // Data state
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [isCuisineSheetOpen, setIsCuisineSheetOpen] = useState(false);
  const [isPriceSheetOpen, setIsPriceSheetOpen] = useState(false);

  // Location filter
  const locationFilter = useLocationFilter();

  // Favorites context
  const { setAllRestaurants: setFavoriteContext } = useFavorites();

  // Load restaurants
  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoints.restaurants.list());
      const data = await response.json();

      if (data.restaurants) {
        setRestaurants(data.restaurants);
        setFavoriteContext(data.restaurants);
      }
    } catch (err) {
      console.error('Failed to load restaurants:', err);
      setError('לא ניתן לטעון מסעדות');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter restaurants
  const filteredRestaurants = useMemo(() => {
    let result = restaurants;

    // Filter by location
    if (locationFilter.mode === 'manual' && locationFilter.city) {
      result = result.filter((r) => {
        if (locationFilter.neighborhood) {
          return (
            r.location?.city === locationFilter.city &&
            r.location?.neighborhood === locationFilter.neighborhood
          );
        }
        return r.location?.city === locationFilter.city;
      });
    }

    // Filter by cuisine
    if (selectedCuisines.length > 0) {
      result = result.filter((r) =>
        selectedCuisines.some((c) =>
          r.cuisine_type?.toLowerCase().includes(c.toLowerCase())
        )
      );
    }

    // Filter by price range
    if (selectedPriceRanges.length > 0) {
      result = result.filter((r) =>
        selectedPriceRanges.includes(r.price_range || '')
      );
    }

    return result;
  }, [
    restaurants,
    locationFilter.mode,
    locationFilter.city,
    locationFilter.neighborhood,
    selectedCuisines,
    selectedPriceRanges,
  ]);

  // Handle restaurant click
  const handleRestaurantClick = (restaurant: Restaurant) => {
    // TODO: Navigate to restaurant detail page
    console.log('Clicked restaurant:', restaurant.name_hebrew);
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

  // Loading state
  if (isLoading) {
    return (
      <PageLayout showHeader showBottomNav>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center animate-fade-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-accent-subtle)] flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
            <p className="text-lg font-medium text-[var(--color-ink)]">טוען מסעדות...</p>
            <p className="text-sm text-[var(--color-ink-muted)] mt-1">
              מכין את ההמלצות הטובות ביותר
            </p>
          </div>
        </div>
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

      {/* Trending Section */}
      <TrendingSection
        restaurants={restaurants}
        onRestaurantClick={handleRestaurantClick}
        className="mt-2"
      />

      {/* Discovery Feed */}
      <DiscoveryFeed
        restaurants={filteredRestaurants}
        onRestaurantClick={handleRestaurantClick}
        showDistances={locationFilter.mode === 'nearby'}
        userCoords={locationFilter.userCoords}
        className="mt-6 pb-8"
      />

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
