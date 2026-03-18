'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type LocationMode = 'nearby' | 'manual' | null;

export interface LocationFilterState {
  mode: LocationMode;
  userCoords: { lat: number; lng: number } | null;
  maxDistanceKm: number;
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

interface LocationFilterContextType extends LocationFilterState {
  isActive: boolean;
  isInitialized: boolean;
  setNearbyMode: (coords: { lat: number; lng: number }) => void;
  setManualMode: (city: string, neighborhood?: string | null) => void;
  setMaxDistance: (km: number) => void;
  clearLocation: () => void;
  clearCitySelection: () => void;
  getDisplayLabel: () => string;
}

const LocationFilterContext = createContext<LocationFilterContextType | undefined>(undefined);

export function LocationFilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationFilterState>(defaultState);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Don't restore 'nearby' mode automatically - user must re-enable
        if (parsed.mode === 'nearby') {
          setState({ ...defaultState, ...parsed, mode: null, userCoords: null });
        } else {
          setState({ ...defaultState, ...parsed });
        }
      }
    } catch {
      // ignore
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }
  }, [state, isInitialized]);

  const setNearbyMode = useCallback((coords: { lat: number; lng: number }) => {
    setState((prev) => ({
      ...prev,
      mode: 'nearby',
      userCoords: coords,
      city: null,
      neighborhood: null,
    }));
  }, []);

  const setManualMode = useCallback((city: string, neighborhood: string | null = null) => {
    setState((prev) => ({
      ...prev,
      mode: 'manual',
      city,
      neighborhood,
      userCoords: null,
    }));
  }, []);

  const setMaxDistance = useCallback((km: number) => {
    setState((prev) => ({ ...prev, maxDistanceKm: km }));
  }, []);

  const clearLocation = useCallback(() => {
    setState(defaultState);
  }, []);

  const clearCitySelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mode: null,
      city: null,
      neighborhood: null,
    }));
  }, []);

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

  const isActive = state.mode !== null;

  return (
    <LocationFilterContext.Provider
      value={{
        ...state,
        isActive,
        isInitialized,
        setNearbyMode,
        setManualMode,
        setMaxDistance,
        clearLocation,
        clearCitySelection,
        getDisplayLabel,
      }}
    >
      {children}
    </LocationFilterContext.Provider>
  );
}

export function useLocationFilter() {
  const context = useContext(LocationFilterContext);
  if (context === undefined) {
    throw new Error('useLocationFilter must be used within a LocationFilterProvider');
  }
  return context;
}
