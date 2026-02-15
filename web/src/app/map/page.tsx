'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PageLayout } from '@/components/layout';
import { endpoints } from '@/lib/config';
import { MapPin, Loader2 } from 'lucide-react';

// Dynamic import to avoid SSR issues with Leaflet (uses window)
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-ink-muted)]" />
    </div>
  ),
});

export default function MapPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(endpoints.restaurants.list())
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch restaurants');
        }
        return res.json();
      })
      .then(data => {
        setRestaurants(data.restaurants || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching restaurants:', err);
        setError('שגיאה בטעינת המסעדות');
        setLoading(false);
      });
  }, []);

  const mappableRestaurants = restaurants.filter(
    (r: any) => r.location?.coordinates?.latitude && r.location?.coordinates?.longitude
  );

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
        <div className="h-[calc(100vh-140px)]">
          <MapView restaurants={mappableRestaurants} />
        </div>
      )}
    </PageLayout>
  );
}
