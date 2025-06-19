import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAppSettings } from '@/contexts/AppSettingsContext';

export function useColorScheme(): 'light' | 'dark' {
  const { settings } = useAppSettings();
  const scheme = useRNColorScheme();
  const deviceScheme = scheme === 'dark' ? 'dark' : 'light';

  if (settings.theme === 'system') {
    return deviceScheme;
  }
  return settings.theme;
}
