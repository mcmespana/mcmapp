import { Appearance } from 'react-native';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useEffect, useState } from 'react';

export function useColorScheme(): 'light' | 'dark' {
  const { settings } = useAppSettings();
  const [deviceScheme, setDeviceScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setDeviceScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => subscription.remove();
  }, []);

  if (settings.theme === 'system') {
    return deviceScheme;
  }

  return settings.theme;
}
