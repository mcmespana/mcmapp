import { logger } from '@/utils/logger';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeScheme = 'light' | 'dark' | 'system';

interface AppSettings {
  fontScale: number;
  theme: ThemeScheme;
  /**
   * Overrides de tamaño de letra por sección (p.ej. 'contigo').
   * Si una sección NO tiene entrada aquí, hereda del `fontScale` global — así
   * el usuario nota una transición suave. En cuanto configura un tamaño
   * específico para la sección, esta pasa a ser independiente del global.
   * Reutilizable para otras secciones de lectura (materiales de eventos…).
   */
  sectionFontScales: Record<string, number>;
}

interface AppSettingsContextType {
  settings: AppSettings;
  setSettings: (values: Partial<AppSettings>) => void;
  loading: boolean;
}

const defaultSettings: AppSettings = {
  fontScale: 1,
  theme: 'system',
  sectionFontScales: {},
};

const STORAGE_KEY = '@app_settings';

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined,
);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          setSettingsState((prev) => ({ ...prev, ...JSON.parse(data) }));
        }
      } catch (e) {
        logger.error('Failed loading app settings', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch((e) => {
      logger.error('Failed saving app settings', e);
    });
  }, [settings, loading]);

  const update = useCallback((values: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...values }));
  }, []);

  const value = useMemo(
    () => ({ settings, setSettings: update, loading }),
    [settings, update, loading],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    // During SSG/SSR (production web builds), components may render outside
    // of providers.  Return safe defaults so the static shell can be generated
    // without crashing.  At runtime the provider is always present.
    return {
      settings: defaultSettings,
      setSettings: () => {},
      loading: true,
    } as AppSettingsContextType;
  }
  return ctx;
};
