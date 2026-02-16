'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, NavigationOff, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCoordinates } from '@/types/restaurant';
import { UserLocationMarker } from './UserLocationMarker';
import { HeatLegend } from './HeatLegend';
import { dateToHeatColor, getDateRange } from '@/lib/color-utils';
import { haversineDistance, formatDistance, GeoCoords } from '@/lib/geo-utils';

// Fix Leaflet default icon issue with Next.js/webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface MapRestaurant {
  id?: string;
  name_hebrew: string;
  name_english?: string | null;
  cuisine_type?: string | null;
  rating?: {
    google_rating?: number;
    total_reviews?: number;
  };
  location?: {
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    lat?: number;
    lng?: number;
    city?: string | null;
  };
  google_places?: {
    place_id?: string;
    google_name?: string;
  };
  host_opinion?: 'positive' | 'negative' | 'mixed' | 'neutral' | null;
  episode_info?: {
    published_at?: string;
  };
}

export type ColorMode = 'heat' | 'opinion';

interface MapViewProps {
  restaurants: MapRestaurant[];
  favoriteIds?: Set<string>;
  userCoords?: GeoCoords | null;
  userAccuracy?: number | null;
  isWatching?: boolean;
  onStartWatching?: () => void;
  onStopWatching?: () => void;
  colorMode?: ColorMode;
  selectedRestaurantId?: string | null;
  onMarkerClick?: (id: string) => void;
}

// Custom marker icon with configurable color and optional highlight
const createCustomIcon = (
  color: string,
  isFavorite: boolean = false,
  isHighlighted: boolean = false
) => {
  const size = isHighlighted ? 42 : 32;
  const height = isHighlighted ? 52 : 40;
  const cx = size / 2;

  const innerContent = isFavorite
    ? `<path d="M${cx} ${height * 0.65}c-.3 0-.5-.1-.7-.3C${cx - 1.4} ${height * 0.625} ${cx - 8} ${height * 0.475} ${cx - 8} ${height * 0.35}c0-4.4 3.6-8 8-8s8 3.6 8 8c0 5-6.6 11-7.3 11.7-.2.2-.4.3-.7.3z" fill="white"/>`
    : `<circle cx="${cx}" cy="${height * 0.35}" r="${size * 0.19}" fill="white"/>`;

  const svgIcon = `
    <svg width="${size}" height="${height}" viewBox="0 0 ${size} ${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="M${cx} 0C${cx * 0.45} 0 0 ${height * 0.18} 0 ${height * 0.4}c0 ${height * 0.275} ${cx} ${height * 0.6} ${cx} ${height * 0.6}s${cx}-${height * 0.325} ${cx}-${height * 0.6}C${size} ${height * 0.18} ${cx * 1.55} 0 ${cx} 0z"
            fill="${color}" stroke="white" stroke-width="2"${isHighlighted ? ' filter="url(#glow)"' : ''}/>
      ${innerContent}
      ${isHighlighted ? `<defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` : ''}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: `custom-marker${isHighlighted ? ' marker-highlighted' : ''}`,
    iconSize: [size, height],
    iconAnchor: [cx, height],
    popupAnchor: [0, -height],
  });
};

// Get marker color based on mode
function getMarkerColor(
  restaurant: MapRestaurant,
  colorMode: ColorMode,
  dateRange: { min: Date; max: Date } | null,
  isFavorite: boolean
): string {
  if (isFavorite) return '#ef4444';

  if (colorMode === 'heat') {
    if (!dateRange) return '#9ca3af';
    return dateToHeatColor(restaurant.episode_info?.published_at, dateRange.min, dateRange.max);
  }

  // Opinion mode
  const colors: Record<string, string> = {
    positive: '#4ade80',
    mixed: '#f59e0b',
    neutral: '#6b7280',
    negative: '#ef4444',
  };
  return (restaurant.host_opinion && colors[restaurant.host_opinion]) || colors.neutral;
}

// Location tracking button
function LocationButton({
  isWatching,
  isLoading,
  onStart,
  onStop,
}: {
  isWatching: boolean;
  isLoading?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}) {
  const handleClick = () => {
    if (isWatching) {
      onStop?.();
    } else {
      onStart?.();
    }
  };

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: '10px', marginLeft: '10px' }}>
      <div className="leaflet-control leaflet-bar">
        <Button
          onClick={handleClick}
          disabled={isLoading}
          className={`border shadow-sm ${
            isWatching
              ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-300'
              : 'bg-white hover:bg-gray-100 text-[var(--color-ink)] border-gray-300'
          }`}
          size="sm"
          style={{ borderRadius: '4px', padding: '6px 12px' }}
        >
          {isWatching ? (
            <>
              <NavigationOff className="w-4 h-4 ml-1" />
              הפסק מעקב
            </>
          ) : (
            <>
              <Navigation className={`w-4 h-4 ml-1 ${isLoading ? 'animate-pulse' : ''}`} />
              {isLoading ? 'מאתר...' : 'המיקום שלי'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Inner component that uses useMap() for smart zoom
function SmartZoom({
  restaurants,
  userCoords,
  nearestBounds,
}: {
  restaurants: MapRestaurant[];
  userCoords?: GeoCoords | null;
  nearestBounds?: [[number, number], [number, number]] | null;
}) {
  const map = useMap();
  const hasZoomedToUserRef = useRef(false);

  // When userCoords first become available, fly to nearest bounds
  useEffect(() => {
    if (userCoords && nearestBounds && !hasZoomedToUserRef.current) {
      hasZoomedToUserRef.current = true;
      const bounds = L.latLngBounds(nearestBounds);
      map.fitBounds(bounds, {
        padding: [50, 50],
        paddingBottomRight: [50, 120],
        maxZoom: 16,
        animate: true,
      });
    }
  }, [userCoords, nearestBounds, map]);

  // If no user coords, fit to all restaurants
  useEffect(() => {
    if (!userCoords && restaurants.length > 0) {
      const points = restaurants
        .map((r) => getCoordinates(r.location))
        .filter((c): c is { latitude: number; longitude: number } => c !== null);
      if (points.length > 0) {
        const bounds = L.latLngBounds(
          points.map((c) => [c.latitude, c.longitude] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [restaurants, userCoords, map]);

  return null;
}

// Highlight selected marker by managing z-index
function MarkerHighlight({
  selectedId,
}: {
  selectedId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId) return;

    // Pan to selected marker
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        const el = layer.getElement();
        if (el?.dataset?.restaurantId === selectedId) {
          layer.setZIndexOffset(1000);
          map.panTo(layer.getLatLng(), { animate: true, duration: 0.5 });
        } else {
          layer.setZIndexOffset(0);
        }
      }
    });
  }, [selectedId, map]);

  return null;
}

export default function MapView({
  restaurants,
  favoriteIds,
  userCoords,
  userAccuracy,
  isWatching = false,
  onStartWatching,
  onStopWatching,
  colorMode = 'heat',
  selectedRestaurantId,
  onMarkerClick,
}: MapViewProps) {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);

  // Filter restaurants with coordinates
  const mappableRestaurants = useMemo(
    () => restaurants.filter((r) => getCoordinates(r.location) !== null),
    [restaurants]
  );

  // Compute date range for heat coloring
  const dateRange = useMemo(() => getDateRange(mappableRestaurants), [mappableRestaurants]);

  // Build heat color map for sharing with bottom sheet
  const heatColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of mappableRestaurants) {
      const id = r.google_places?.place_id || r.id || r.name_hebrew;
      const isFav = favoriteIds?.has(r.google_places?.place_id || r.name_hebrew) ?? false;
      map.set(id, getMarkerColor(r, colorMode, dateRange, isFav));
    }
    return map;
  }, [mappableRestaurants, colorMode, dateRange, favoriteIds]);

  // Compute nearest bounds for smart zoom
  const nearestBounds = useMemo(() => {
    if (!userCoords) return null;

    const withDist = mappableRestaurants
      .map((r) => {
        const c = getCoordinates(r.location);
        if (!c) return null;
        return { r, dist: haversineDistance(userCoords, { lat: c.latitude, lng: c.longitude }) };
      })
      .filter((x): x is { r: MapRestaurant; dist: number } => x !== null)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);

    if (withDist.length === 0) return null;

    let minLat = userCoords.lat, maxLat = userCoords.lat;
    let minLng = userCoords.lng, maxLng = userCoords.lng;

    for (const { r } of withDist) {
      const c = getCoordinates(r.location)!;
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
    }

    return [[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]];
  }, [userCoords, mappableRestaurants]);

  const handleMarkerClick = useCallback(
    (restaurant: MapRestaurant) => {
      const restaurantId = restaurant.google_places?.place_id || restaurant.id;
      if (restaurantId && onMarkerClick) {
        onMarkerClick(restaurantId);
      } else if (restaurantId) {
        router.push(`/restaurant/${restaurantId}`);
      }
    },
    [onMarkerClick, router]
  );

  if (mappableRestaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] text-center px-4">
        <MapPin className="w-10 h-10 text-[var(--color-ink-muted)] mb-4" />
        <p className="text-[var(--color-ink-muted)]">אין מסעדות עם נתוני מיקום להצגה על המפה</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[31.5, 34.8]}
        zoom={8}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
        ref={mapRef}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Smart zoom controller */}
        <SmartZoom
          restaurants={mappableRestaurants}
          userCoords={userCoords}
          nearestBounds={nearestBounds}
        />

        {/* Selected marker highlight */}
        <MarkerHighlight selectedId={selectedRestaurantId} />

        {/* Location tracking button */}
        <LocationButton
          isWatching={isWatching}
          onStart={onStartWatching}
          onStop={onStopWatching}
        />

        {/* User location blue dot */}
        {userCoords && (
          <UserLocationMarker coords={userCoords} accuracy={userAccuracy} />
        )}

        {/* Restaurant markers */}
        {mappableRestaurants.map((restaurant, index) => {
          const { latitude, longitude } = getCoordinates(restaurant.location)!;
          const restaurantId = restaurant.google_places?.place_id || restaurant.id || `restaurant-${index}`;
          const isFavorite = favoriteIds?.has(restaurant.google_places?.place_id || restaurant.name_hebrew) ?? false;
          const markerColor = heatColors.get(restaurantId) || '#6b7280';
          const isSelected = selectedRestaurantId === restaurantId;

          // Compute distance from user for popup
          const distanceKm = userCoords
            ? haversineDistance(userCoords, { lat: latitude, lng: longitude })
            : null;

          return (
            <Marker
              key={restaurantId}
              position={[latitude, longitude]}
              icon={createCustomIcon(markerColor, isFavorite, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: () => handleMarkerClick(restaurant),
              }}
            >
              <Popup className="rtl-popup" maxWidth={300}>
                <div className="text-right" dir="rtl">
                  <h3 className="text-lg font-bold text-[var(--color-primary)] mb-1">
                    {restaurant.google_places?.google_name || restaurant.name_hebrew}
                  </h3>

                  {restaurant.name_english && (
                    <p className="text-sm text-[var(--color-ink-muted)] mb-2">
                      {restaurant.name_english}
                    </p>
                  )}

                  {restaurant.cuisine_type && (
                    <p className="text-sm text-[var(--color-ink)] mb-2">
                      <span className="font-semibold">סוג מטבח:</span> {restaurant.cuisine_type}
                    </p>
                  )}

                  {restaurant.location?.city && (
                    <p className="text-sm text-[var(--color-ink-muted)] mb-2">
                      <MapPin className="inline w-3 h-3 ml-1" />
                      {restaurant.location.city}
                    </p>
                  )}

                  {distanceKm !== null && (
                    <p className="text-sm text-blue-600 mb-2">
                      <Navigation className="inline w-3 h-3 ml-1" />
                      {formatDistance(distanceKm)} ממך
                    </p>
                  )}

                  {restaurant.rating?.google_rating && (
                    <div className="flex items-center gap-1 mb-3">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-semibold">
                        {restaurant.rating.google_rating.toFixed(1)}
                      </span>
                      {restaurant.rating.total_reviews && (
                        <span className="text-xs text-[var(--color-ink-muted)]">
                          ({restaurant.rating.total_reviews} ביקורות)
                        </span>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      const id = restaurant.google_places?.place_id || restaurant.id;
                      if (id) router.push(`/restaurant/${id}`);
                    }}
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
                    size="sm"
                  >
                    לפרטים נוספים
                  </Button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Heat legend */}
      {colorMode === 'heat' && (
        <HeatLegend visible={mappableRestaurants.length > 0} />
      )}

      {/* Map info overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md z-[1000]">
        <p className="text-sm text-[var(--color-ink)] font-semibold">
          {mappableRestaurants.length} מסעדות על המפה
        </p>
      </div>

      {/* Custom CSS */}
      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          direction: rtl;
        }
        .custom-marker {
          background: transparent;
          border: none;
        }
        .marker-highlighted {
          z-index: 1000 !important;
          filter: drop-shadow(0 0 6px rgba(66, 133, 244, 0.5));
          animation: marker-bounce 0.5s ease-out;
        }
        @keyframes marker-bounce {
          0% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
          60% { transform: translateY(-2px); }
          100% { transform: translateY(0); }
        }
        .user-location-pulse {
          animation: location-pulse 2s ease-in-out infinite;
        }
        @keyframes location-pulse {
          0% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.15; transform: scale(1.4); }
          100% { opacity: 0.4; transform: scale(1); }
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
