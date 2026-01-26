'use client';

import { useState, useCallback } from 'react';

export interface GeolocationState {
  coords: {
    lat: number;
    lng: number;
  } | null;
  loading: boolean;
  error: string | null;
  timestamp: number | null;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000, // 5 minutes
};

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    loading: false,
    error: null,
    timestamp: null,
  });

  const mergedOptions = { ...defaultOptions, ...options };

  const getCurrentPosition = useCallback((): Promise<GeolocationState['coords']> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by this browser';
        setState((prev) => ({ ...prev, error, loading: false }));
        reject(new Error(error));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setState({
            coords,
            loading: false,
            error: null,
            timestamp: position.timestamp,
          });
          resolve(coords);
        },
        (error) => {
          let errorMessage: string;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'לא ניתן לאתר מיקום - אנא אשר גישה למיקום';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'מיקום לא זמין';
              break;
            case error.TIMEOUT:
              errorMessage = 'זמן הבקשה פג - נסה שוב';
              break;
            default:
              errorMessage = 'שגיאה באיתור מיקום';
          }
          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage,
          }));
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge,
        }
      );
    });
  }, [mergedOptions.enableHighAccuracy, mergedOptions.timeout, mergedOptions.maximumAge]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearCoords = useCallback(() => {
    setState({
      coords: null,
      loading: false,
      error: null,
      timestamp: null,
    });
  }, []);

  return {
    ...state,
    getCurrentPosition,
    clearError,
    clearCoords,
  };
}
