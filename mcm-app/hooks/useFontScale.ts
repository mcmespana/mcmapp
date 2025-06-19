import { useAppSettings } from '@/contexts/AppSettingsContext';

export default function useFontScale(extra: number = 1) {
  const { settings } = useAppSettings();
  return settings.fontScale * extra;
}
