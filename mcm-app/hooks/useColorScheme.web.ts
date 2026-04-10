import { useEffect, useMemo, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAppSettings } from '@/contexts/AppSettingsContext';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  const { settings } = useAppSettings();
  const deviceScheme = useRNColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useMemo<'light' | 'dark'>(() => {
    if (!hasHydrated) {
      return 'light';
    }

    if (settings.theme === 'system') {
      return deviceScheme === 'dark' ? 'dark' : 'light';
    }

    return settings.theme;
  }, [deviceScheme, hasHydrated, settings.theme]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;

    root.dataset.theme = colorScheme;
    root.style.colorScheme = colorScheme;
    root.classList.toggle('dark', colorScheme === 'dark');
    root.classList.toggle('light', colorScheme === 'light');
  }, [colorScheme]);

  return colorScheme;
}
