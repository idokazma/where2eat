'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface UserSettings {
  showOnlyIsrael: boolean;
  radiusKm: number | null;
}

const STORAGE_KEY = 'where2eat-settings';

const DEFAULTS: UserSettings = {
  showOnlyIsrael: false,
  radiusKm: null,
};

export const RADIUS_OPTIONS = [0, 1, 5, 20] as const;

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  isInitialized: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
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

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isInitialized }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
