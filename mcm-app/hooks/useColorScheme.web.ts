import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAppSettings } from '@/contexts/AppSettingsContext';

/** El estado de hidratación no cambia nunca: no hay a qué suscribirse. */
const neverChanges = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme(): 'light' | 'dark' {
  // `false` en el render del servidor y en el de hidratación, `true` a partir
  // de ahí. Es lo mismo que hacía el `useEffect(() => setHasHydrated(true))`,
  // pero declarado en vez de provocado por un render extra.
  const hasHydrated = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
  const { settings } = useAppSettings();
  const deviceScheme = useRNColorScheme();

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
