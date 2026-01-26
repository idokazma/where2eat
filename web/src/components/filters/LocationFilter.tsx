'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, X } from 'lucide-react';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { NearMeToggle } from './NearMeToggle';
import { CityPicker } from './CityPicker';

interface LocationFilterProps {
  className?: string;
}

export function LocationFilter({ className = '' }: LocationFilterProps) {
  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);

  const {
    mode,
    city,
    neighborhood,
    setNearbyMode,
    setManualMode,
    clearLocation,
    getDisplayLabel,
    isActive,
  } = useLocationFilter();

  const handleNearbyActivate = (coords: { lat: number; lng: number }) => {
    setNearbyMode(coords);
  };

  const handleNearbyDeactivate = () => {
    clearLocation();
  };

  const handleCitySelect = (selectedCity: string, selectedNeighborhood: string | null) => {
    setManualMode(selectedCity, selectedNeighborhood);
  };

  const handleClearCity = () => {
    clearLocation();
  };

  // Get last used from localStorage for the picker
  const lastUsedCity = typeof window !== 'undefined'
    ? city
    : null;
  const lastUsedNeighborhood = typeof window !== 'undefined'
    ? neighborhood
    : null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Near Me Toggle */}
      <NearMeToggle
        isActive={mode === 'nearby'}
        onActivate={handleNearbyActivate}
        onDeactivate={handleNearbyDeactivate}
      />

      {/* City/Neighborhood Selector */}
      <button
        onClick={() => setIsCityPickerOpen(true)}
        className={`filter-chip ${mode === 'manual' ? 'selected' : ''}`}
        type="button"
      >
        <MapPin className="w-4 h-4" />
        <span>{mode === 'manual' ? getDisplayLabel() : 'מיקום'}</span>

        {mode === 'manual' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearCity();
            }}
            className="flex-shrink-0 -mr-1 p-0.5 rounded-full hover:bg-[var(--color-accent)] hover:text-white transition-colors"
            aria-label="Clear location"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0 -mr-1" />
        )}
      </button>

      {/* City Picker Bottom Sheet */}
      <CityPicker
        isOpen={isCityPickerOpen}
        onClose={() => setIsCityPickerOpen(false)}
        selectedCity={city}
        selectedNeighborhood={neighborhood}
        lastUsedCity={lastUsedCity}
        lastUsedNeighborhood={lastUsedNeighborhood}
        onSelectCity={handleCitySelect}
      />
    </div>
  );
}
