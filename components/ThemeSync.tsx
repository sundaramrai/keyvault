'use client';

import { useEffect } from 'react';
import { THEME_STORAGE_KEY, getStoredThemePreference, syncThemePreference } from '@/lib/theme';

export function ThemeSync() {
  useEffect(() => {
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: light)');

    const applyStoredTheme = () => {
      syncThemePreference(getStoredThemePreference());
    };

    const handleSystemThemeChange = () => {
      if (getStoredThemePreference() === 'system') {
        applyStoredTheme();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === THEME_STORAGE_KEY) {
        applyStoredTheme();
      }
    };

    applyStoredTheme();
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    globalThis.addEventListener('storage', handleStorage);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      globalThis.removeEventListener('storage', handleStorage);
    };
  }, []);

  return null;
}
