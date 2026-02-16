'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PageLayout } from '@/components/layout';
import { endpoints } from '@/lib/config';
import { MapPin, Loader2, Heart, Calendar, MessageSquare } from 'lucide-react';
import { useFavorites } from '@/contexts/favorites-context';
import { Button } from '@/components/ui/button';
import { getCoordinates } from '@/types/restaurant';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearestRestaurants } from '@/hooks/useNearestRestaurants';
import type { ColorMode, MapRestaurant } from '@/components/map/MapView';
import type { MapBottomSheetHandle } from '@/components/map/MapBottomSheet';
import type { WithDistance } from '@/lib/geo-utils';

// Dynamic imports to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-ink-muted)]" />
    </div>
  ),
});

const MapBottomSheet = dynamic(
  () => import('@/components/map/MapBottomSheet').then((mod) => mod.MapBottomSheet),
  { ssr: false }
);

export default function MapPage() {
  const [restaurants, setRestaurants] = useState<MapRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('heat');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const { favorites, setAllRestaurants } = useFavorites();
  const bottomSheetRef = useRef<MapBottomSheetHandle>(null);

  // Geolocation
  const { coords: userCoords, accuracy, isWatching, watchPosition, stopWatching } = useGeolocation();

  // Fetch restaurants
  useEffect(() => {
    fetch(endpoints.restaurants.list())
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch restaurants');
        return res.json();
      })
      .then((data) => {
        const allRestaurants = data.restaurants || [];
        setRestaurants(allRestaurants);
        setAllRestaurants(allRestaurants);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching restaurants:', err);
        setError('שגיאה בטעינת המסעדות');
        setLoading(false);
      });
  }, [setAllRestaurants]);

  // Filter to restaurants that have coordinates
  const mappableRestaurants = useMemo(
    () => restaurants.filter((r) => getCoordinates(r.location) !== null),
    [restaurants]
  );

  // Apply saved filter
  const displayedRestaurants = useMemo(() => {
    if (!showSavedOnly) return mappableRestaurants;
    return mappableRestaurants.filter((r) =>
      favorites.includes(r.google_places?.place_id || r.name_hebrew)
    );
  }, [mappableRestaurants, showSavedOnly, favorites]);

  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

  // Nearest restaurants for bottom sheet
  const { sorted: sortedRestaurants } = useNearestRestaurants(displayedRestaurants, userCoords);

  // Build distance-aware list for bottom sheet
  const restaurantsWithDistance: WithDistance<MapRestaurant>[] = useMemo(() => {
    if (sortedRestaurants.length > 0) return sortedRestaurants;
    // No user coords — show all without distance
    return displayedRestaurants.map((item) => ({ item, distance: 0 }));
  }, [sortedRestaurants, displayedRestaurants]);

  // Handle marker click from map — select and scroll bottom sheet
  const handleMarkerClick = useCallback(
    (id: string) => {
      setSelectedRestaurantId(id);
      bottomSheetRef.current?.scrollToId(id);
      bottomSheetRef.current?.expandHalf();
    },
    []
  );

  // Handle list item selection — sync to map
  const handleListSelect = useCallback((id: string) => {
    setSelectedRestaurantId(id);
  }, []);

  // Handle start/stop watching
  const handleStartWatching = useCallback(() => {
    watchPosition();
  }, [watchPosition]);

  const handleStopWatching = useCallback(() => {
    stopWatching();
  }, [stopWatching]);

  // Toggle color mode
  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => (prev === 'heat' ? 'opinion' : 'heat'));
  }, []);

  return (
    <PageLayout title="מפה" showHeader showBottomNav>
      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-ink-muted)]" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <MapPin className="w-10 h-10 text-red-500 mb-4" />
          <p className="text-red-500">{error}</p>
        </div>
      ) : mappableRestaurants.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <MapPin className="w-10 h-10 text-[var(--color-ink-muted)] mb-4" />
          <h2 className="text-xl font-bold text-[var(--color-ink)] mb-2">
            אין מסעדות עם נתוני מיקום
          </h2>
          <p className="text-[var(--color-ink-muted)] max-w-xs">
            כרגע אין מסעדות עם נתוני מיקום גיאוגרפי להצגה על המפה
          </p>
        </div>
      ) : (
        <div className="h-[calc(100vh-140px)] relative overflow-hidden">
          {/* Top controls */}
          <div className="absolute top-3 right-3 z-[1000] flex gap-2" dir="rtl">
            {/* Saved toggle */}
            <Button
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              variant={showSavedOnly ? 'default' : 'outline'}
              size="sm"
              className={
                showSavedOnly
                  ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-md'
                  : 'bg-white hover:bg-gray-100 text-[var(--color-ink)] border-gray-300 shadow-md'
              }
            >
              <Heart className={`w-4 h-4 ml-1 ${showSavedOnly ? 'fill-current' : ''}`} />
              {showSavedOnly ? 'שמורים בלבד' : 'שמורים'}
            </Button>

            {/* Color mode toggle */}
            <Button
              onClick={toggleColorMode}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-100 text-[var(--color-ink)] border-gray-300 shadow-md"
            >
              {colorMode === 'heat' ? (
                <>
                  <Calendar className="w-4 h-4 ml-1" />
                  לפי תאריך
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 ml-1" />
                  לפי דעה
                </>
              )}
            </Button>
          </div>

          {showSavedOnly && displayedRestaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Heart className="w-10 h-10 text-[var(--color-ink-muted)] mb-4" />
              <h2 className="text-xl font-bold text-[var(--color-ink)] mb-2">
                אין מסעדות שמורות עם מיקום
              </h2>
              <p className="text-[var(--color-ink-muted)] max-w-xs">
                שמור מסעדות כדי לראות אותן על המפה
              </p>
            </div>
          ) : (
            <>
              <MapView
                restaurants={displayedRestaurants}
                favoriteIds={favoriteIds}
                userCoords={userCoords}
                userAccuracy={accuracy}
                isWatching={isWatching}
                onStartWatching={handleStartWatching}
                onStopWatching={handleStopWatching}
                colorMode={colorMode}
                selectedRestaurantId={selectedRestaurantId}
                onMarkerClick={handleMarkerClick}
              />

              {/* Bottom sheet */}
              <MapBottomSheet
                ref={bottomSheetRef}
                restaurants={restaurantsWithDistance}
                selectedId={selectedRestaurantId}
                onSelect={handleListSelect}
                favoriteIds={favoriteIds}
              />
            </>
          )}
        </div>
      )}
    </PageLayout>
  );
}
