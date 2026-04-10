import { useEffect } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import {
  registerHeroUIRuntimeTheme,
  syncHeroUITheme,
} from '@/utils/heroUIRuntimeTheme';

registerHeroUIRuntimeTheme();

export default function UniwindThemeBridge() {
  const { settings } = useAppSettings();

  useEffect(() => {
    syncHeroUITheme(settings.theme);
  }, [settings.theme]);

  return null;
}
