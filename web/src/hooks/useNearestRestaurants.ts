'use client';

import { useMemo } from 'react';
import { GeoCoords, WithDistance, sortByDistance } from '@/lib/geo-utils';

interface HasLocation {
  location?: {
    coordinates?: { latitude: number; longitude: number };
    lat?: number;
    lng?: number;
  };
}

function extractCoords(r: HasLocation): GeoCoords | null {
  if (r.location?.coordinates?.latitude && r.location?.coordinates?.longitude) {
    return { lat: r.location.coordinates.latitude, lng: r.location.coordinates.longitude };
  }
  if (r.location?.lat && r.location?.lng) {
    return { lat: r.location.lat, lng: r.location.lng };
  }
  return null;
}

export function useNearestRestaurants<T extends HasLocation>(
  restaurants: T[],
  userCoords: GeoCoords | null,
  count: number = 10
): {
  sorted: WithDistance<T>[];
  nearest: WithDistance<T>[];
  bounds: [[number, number], [number, number]] | null;
} {
  return useMemo(() => {
    if (!userCoords) {
      return { sorted: [], nearest: [], bounds: null };
    }

    const sorted = sortByDistance(restaurants, userCoords, extractCoords);
    const nearest = sorted.slice(0, count);

    // Compute bounds including all nearest + user location
    if (nearest.length === 0) {
      return { sorted, nearest, bounds: null };
    }

    let minLat = userCoords.lat;
    let maxLat = userCoords.lat;
    let minLng = userCoords.lng;
    let maxLng = userCoords.lng;

    for (const { item } of nearest) {
      const c = extractCoords(item);
      if (!c) continue;
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    }

    const bounds: [[number, number], [number, number]] = [
      [minLat, minLng],
      [maxLat, maxLng],
    ];

    return { sorted, nearest, bounds };
  }, [restaurants, userCoords, count]);
}
