import { Appearance, ColorSchemeName } from 'react-native';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useEffect, useState } from 'react';

export function useColorScheme(): 'light' | 'dark' {
  const { settings } = useAppSettings();
  const [deviceScheme, setDeviceScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const listener = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
      setDeviceScheme(colorScheme === 'dark' ? 'dark' : 'light');
    };
    const subscription = Appearance.addChangeListener(listener);
    return () => subscription.remove();
  }, []);

  if (settings.theme === 'system') {
    return deviceScheme;
  }

  return settings.theme;
}
