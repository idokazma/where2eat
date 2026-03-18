'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import * as L from 'leaflet';

interface UserLocationMarkerProps {
  coords: { lat: number; lng: number };
  accuracy?: number | null;
}

export function UserLocationMarker({ coords, accuracy }: UserLocationMarkerProps) {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const pulseRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    const latLng = L.latLng(coords.lat, coords.lng);

    // Accuracy circle (translucent blue)
    if (accuracy && accuracy > 0) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng(latLng);
        accuracyCircleRef.current.setRadius(accuracy);
      } else {
        accuracyCircleRef.current = L.circle(latLng, {
          radius: accuracy,
          color: '#4285f4',
          fillColor: '#4285f4',
          fillOpacity: 0.1,
          weight: 1,
          opacity: 0.3,
          interactive: false,
        }).addTo(map);
      }
    } else if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    // Pulse ring (animated via CSS)
    if (pulseRef.current) {
      pulseRef.current.setLatLng(latLng);
    } else {
      pulseRef.current = L.circleMarker(latLng, {
        radius: 16,
        color: '#4285f4',
        fillColor: '#4285f4',
        fillOpacity: 0.2,
        weight: 2,
        opacity: 0.4,
        className: 'user-location-pulse',
        interactive: false,
      }).addTo(map);
    }

    // Blue dot (solid)
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
    } else {
      markerRef.current = L.circleMarker(latLng, {
        radius: 8,
        color: '#ffffff',
        fillColor: '#4285f4',
        fillOpacity: 1,
        weight: 3,
        opacity: 1,
        interactive: false,
      }).addTo(map);
    }

  }, [coords.lat, coords.lng, accuracy, map]);

  // Cleanup all layers on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
      if (pulseRef.current) {
        pulseRef.current.remove();
        pulseRef.current = null;
      }
    };
  }, []);

  return null;
}
