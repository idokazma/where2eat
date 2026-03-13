'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserSettings {
  showOnlyIsrael: boolean;
  radiusKm: number;
}

const STORAGE_KEY = 'where2eat-settings';

const DEFAULTS: UserSettings = {
  showOnlyIsrael: false,
  radiusKm: 5,
};

export const RADIUS_OPTIONS = [1, 5, 20] as const;

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // ignore
      }
    }
  }, [settings, isInitialized]);

  const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting, isInitialized };
}
