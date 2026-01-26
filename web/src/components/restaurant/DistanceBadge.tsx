'use client';

import { MapPin } from 'lucide-react';

interface DistanceBadgeProps {
  distanceMeters: number;
  className?: string;
}

export function DistanceBadge({ distanceMeters, className = '' }: DistanceBadgeProps) {
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} מ׳`;
    }
    const km = meters / 1000;
    if (km < 10) {
      return `${km.toFixed(1)} ק״מ`;
    }
    return `${Math.round(km)} ק״מ`;
  };

  return (
    <span className={`distance-badge ${className}`}>
      <MapPin className="w-3 h-3" />
      <span>{formatDistance(distanceMeters)}</span>
    </span>
  );
}
