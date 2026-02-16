'use client';

import { useState, useCallback, useRef } from 'react';

export interface GeolocationState {
  coords: {
    lat: number;
    lng: number;
  } | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  timestamp: number | null;
  isWatching: boolean;
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

function getErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'לא ניתן לאתר מיקום - אנא אשר גישה למיקום';
    case error.POSITION_UNAVAILABLE:
      return 'מיקום לא זמין';
    case error.TIMEOUT:
      return 'זמן הבקשה פג - נסה שוב';
    default:
      return 'שגיאה באיתור מיקום';
  }
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    accuracy: null,
    loading: false,
    error: null,
    timestamp: null,
    isWatching: false,
  });

  const watchIdRef = useRef<number | null>(null);
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
          setState((prev) => ({
            ...prev,
            coords,
            accuracy: position.coords.accuracy,
            loading: false,
            error: null,
            timestamp: position.timestamp,
          }));
          resolve(coords);
        },
        (error) => {
          const errorMessage = getErrorMessage(error);
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

  const watchPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
        loading: false,
      }));
      return;
    }

    // Stop existing watch if any
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setState((prev) => ({ ...prev, loading: true, error: null, isWatching: true }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setState((prev) => ({
          ...prev,
          coords,
          accuracy: position.coords.accuracy,
          loading: false,
          error: null,
          timestamp: position.timestamp,
          isWatching: true,
        }));
      },
      (error) => {
        const errorMessage = getErrorMessage(error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
      },
      {
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        timeout: mergedOptions.timeout,
        maximumAge: mergedOptions.maximumAge,
      }
    );
  }, [mergedOptions.enableHighAccuracy, mergedOptions.timeout, mergedOptions.maximumAge]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isWatching: false }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearCoords = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState({
      coords: null,
      accuracy: null,
      loading: false,
      error: null,
      timestamp: null,
      isWatching: false,
    });
  }, []);

  return {
    ...state,
    getCurrentPosition,
    watchPosition,
    stopWatching,
    clearError,
    clearCoords,
  };
}
