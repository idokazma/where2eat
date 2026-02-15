'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCoordinates } from '@/types/restaurant';

// Fix Leaflet default icon issue with Next.js/webpack
// The default icons don't load properly in Next.js, so we use CDN
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapRestaurant {
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
  };
  host_opinion?: 'positive' | 'negative' | 'mixed' | 'neutral' | null;
}

interface MapViewProps {
  restaurants: MapRestaurant[];
  favoriteIds?: Set<string>;
}

// Custom marker icons based on host opinion
const createCustomIcon = (opinion: MapRestaurant['host_opinion'], isFavorite: boolean = false) => {
  const colors = {
    positive: '#4ade80',
    mixed: '#f59e0b',
    neutral: '#6b7280',
    negative: '#ef4444'
  };

  const color = isFavorite ? '#ef4444' : (opinion && colors[opinion]) || colors.neutral;
  const innerContent = isFavorite
    ? `<path d="M16 26c-.3 0-.5-.1-.7-.3C14.6 25 8 19 8 14c0-4.4 3.6-8 8-8s8 3.6 8 8c0 5-6.6 11-7.3 11.7-.2.2-.4.3-.7.3z" fill="white"/><path d="M16 11c-1.7 0-3 1.3-3 3 0 2.2 3 5 3 5s3-2.8 3-5c0-1.7-1.3-3-3-3z" fill="${color}"/>`
    : `<circle cx="16" cy="14" r="6" fill="white"/><text x="16" y="18" font-size="10" text-anchor="middle" fill="${color}">🍽️</text>`;

  const svgIcon = `
    <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 24 16 24s16-13 16-24C32 7.163 24.837 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      ${innerContent}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40]
  });
};

// Component to handle "Center on me" button
function LocationButton() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleCenterOnMe = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.flyTo([latitude, longitude], 13, {
            duration: 1.5
          });
          setIsLocating(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsLocating(false);
          alert('לא ניתן לגשת למיקום הנוכחי שלך');
        }
      );
    } else {
      setIsLocating(false);
      alert('הדפדפן שלך לא תומך במיקום גיאוגרפי');
    }
  };

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: '10px', marginLeft: '10px' }}>
      <div className="leaflet-control leaflet-bar">
        <Button
          onClick={handleCenterOnMe}
          disabled={isLocating}
          className="bg-white hover:bg-gray-100 text-[var(--color-ink)] border border-gray-300 shadow-sm"
          size="sm"
          style={{ borderRadius: '4px', padding: '6px 12px' }}
        >
          <Navigation className={`w-4 h-4 ml-1 ${isLocating ? 'animate-pulse' : ''}`} />
          {isLocating ? 'מאתר...' : 'המיקום שלי'}
        </Button>
      </div>
    </div>
  );
}

export default function MapView({ restaurants, favoriteIds }: MapViewProps) {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);

  // Filter restaurants that have coordinates
  const mappableRestaurants = restaurants.filter(
    (r) => getCoordinates(r.location) !== null
  );

  useEffect(() => {
    // Fit map to show all markers when restaurants change
    if (mapRef.current && mappableRestaurants.length > 0) {
      const bounds = L.latLngBounds(
        mappableRestaurants.map((r) => {
          const coords = getCoordinates(r.location)!;
          return [coords.latitude, coords.longitude];
        })
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [mappableRestaurants]);

  const handleMarkerClick = (restaurant: MapRestaurant) => {
    const restaurantId = restaurant.google_places?.place_id || restaurant.id;
    if (restaurantId) {
      router.push(`/restaurant/${restaurantId}`);
    }
  };

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
        {/* OpenStreetMap tiles - free, no API key needed */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Location button */}
        <LocationButton />

        {/* Restaurant markers */}
        {mappableRestaurants.map((restaurant, index) => {
          const { latitude, longitude } = getCoordinates(restaurant.location)!;
          const restaurantId = restaurant.google_places?.place_id || restaurant.id || `restaurant-${index}`;

          return (
            <Marker
              key={restaurantId}
              position={[latitude, longitude]}
              icon={createCustomIcon(restaurant.host_opinion, favoriteIds?.has(restaurant.google_places?.place_id || restaurant.name_hebrew))}
            >
              <Popup
                className="rtl-popup"
                maxWidth={300}
              >
                <div className="text-right" dir="rtl">
                  <h3 className="text-lg font-bold text-[var(--color-primary)] mb-1">
                    {restaurant.name_hebrew}
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
                    onClick={() => handleMarkerClick(restaurant)}
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

      {/* Map info overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md z-[1000]">
        <p className="text-sm text-[var(--color-ink)] font-semibold">
          {mappableRestaurants.length} מסעדות על המפה
        </p>
      </div>

      {/* Custom CSS for RTL popup */}
      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          direction: rtl;
        }
        .custom-marker {
          background: transparent;
          border: none;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
