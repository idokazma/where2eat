'use client';

import { useState, useCallback, useEffect } from 'react';

export type LocationMode = 'nearby' | 'manual' | null;

export interface LocationFilterState {
  mode: LocationMode;
  // For 'nearby' mode
  userCoords: {
    lat: number;
    lng: number;
  } | null;
  maxDistanceKm: number;
  // For 'manual' mode
  city: string | null;
  neighborhood: string | null;
}

const STORAGE_KEY = 'where2eat-location-filter';

const defaultState: LocationFilterState = {
  mode: null,
  userCoords: null,
  maxDistanceKm: 5,
  city: null,
  neighborhood: null,
};

// Load from localStorage
const loadFromStorage = (): LocationFilterState => {
  if (typeof window === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Don't restore 'nearby' mode automatically - user must re-enable
      if (parsed.mode === 'nearby') {
        return { ...defaultState, ...parsed, mode: null, userCoords: null };
      }
      return { ...defaultState, ...parsed };
    }
  } catch {
    // Ignore storage errors
  }
  return defaultState;
};

// Save to localStorage
const saveToStorage = (state: LocationFilterState) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

export function useLocationFilter() {
  const [state, setState] = useState<LocationFilterState>(defaultState);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from storage on mount (standard hydration pattern)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadFromStorage());
    setIsInitialized(true);
  }, []);

  // Save to storage when state changes
  useEffect(() => {
    if (isInitialized) {
      saveToStorage(state);
    }
  }, [state, isInitialized]);

  // Set nearby mode with coordinates
  const setNearbyMode = useCallback((coords: { lat: number; lng: number }) => {
    setState((prev) => ({
      ...prev,
      mode: 'nearby',
      userCoords: coords,
      city: null,
      neighborhood: null,
    }));
  }, []);

  // Set manual location mode
  const setManualMode = useCallback(
    (city: string, neighborhood: string | null = null) => {
      setState((prev) => ({
        ...prev,
        mode: 'manual',
        city,
        neighborhood,
        userCoords: null,
      }));
    },
    []
  );

  // Update max distance for nearby mode
  const setMaxDistance = useCallback((km: number) => {
    setState((prev) => ({
      ...prev,
      maxDistanceKm: km,
    }));
  }, []);

  // Clear location filter
  const clearLocation = useCallback(() => {
    setState(defaultState);
  }, []);

  // Clear only the city/neighborhood (keep mode)
  const clearCitySelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mode: null,
      city: null,
      neighborhood: null,
    }));
  }, []);

  // Get display label for current filter
  const getDisplayLabel = useCallback((): string => {
    if (state.mode === 'nearby' && state.userCoords) {
      return 'קרוב אליי';
    }
    if (state.mode === 'manual') {
      if (state.neighborhood && state.city) {
        return `${state.neighborhood}, ${state.city}`;
      }
      if (state.city) {
        return state.city;
      }
    }
    return 'מיקום';
  }, [state]);

  // Check if a filter is active
  const isActive = state.mode !== null;

  return {
    ...state,
    isActive,
    isInitialized,
    setNearbyMode,
    setManualMode,
    setMaxDistance,
    clearLocation,
    clearCitySelection,
    getDisplayLabel,
  };
}
