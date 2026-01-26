'use client';

import { useState, useCallback } from 'react';
import { MapPin, Loader2, Check } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

interface NearMeToggleProps {
  isActive: boolean;
  onActivate: (coords: { lat: number; lng: number }) => void;
  onDeactivate: () => void;
  className?: string;
}

export function NearMeToggle({
  isActive,
  onActivate,
  onDeactivate,
  className = '',
}: NearMeToggleProps) {
  const { loading, error, getCurrentPosition, clearError } = useGeolocation();
  const [showError, setShowError] = useState(false);

  const handleClick = useCallback(async () => {
    if (isActive) {
      onDeactivate();
      return;
    }

    try {
      clearError();
      setShowError(false);
      const coords = await getCurrentPosition();
      if (coords) {
        onActivate(coords);
      }
    } catch {
      setShowError(true);
      // Auto-hide error after 3 seconds
      setTimeout(() => setShowError(false), 3000);
    }
  }, [isActive, onActivate, onDeactivate, getCurrentPosition, clearError]);

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`filter-chip ${isActive ? 'active' : ''} ${className}`}
        type="button"
        aria-pressed={isActive}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>מאתר...</span>
          </>
        ) : isActive ? (
          <>
            <MapPin className="w-4 h-4" />
            <span>קרוב אליי</span>
            <Check className="w-4 h-4" />
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            <span>קרוב אליי</span>
          </>
        )}
      </button>

      {/* Error toast */}
      {showError && error && (
        <div className="absolute top-full mt-2 right-0 left-0 min-w-[200px] p-3 bg-[var(--color-negative-subtle)] border border-[var(--color-negative)] rounded-lg text-sm text-[var(--color-negative)] animate-fade-up z-10">
          {error}
        </div>
      )}
    </div>
  );
}
