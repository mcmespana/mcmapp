import { logger } from '@/utils/logger';
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the shape of the settings
export interface SongSettings {
  chordsVisible: boolean;
  fontSize: number; // Using number for em value
  fontFamily: string;
  notation: 'EN' | 'ES';
}

// Define the shape of the context value
interface SettingsContextType {
  settings: SongSettings;
  setSettings: (settings: Partial<SongSettings>) => void;
  isLoadingSettings: boolean;
  /**
   * Modo administrador local: se activa al introducir la contraseña del panel
   * secreto y se persiste en el dispositivo. Mientras esté activo, el panel de
   * edición del cantoral se abre sin volver a pedir la contraseña.
   */
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
}

export const DEFAULT_FONT_SIZE_EM = 1.25; // baseline font size (ligeramente mayor para mejor legibilidad)

// Default settings
const defaultSettings: SongSettings = {
  chordsVisible: true,
  fontSize: DEFAULT_FONT_SIZE_EM,
  fontFamily: "'Roboto Mono', 'Courier New', monospace", // Default font
  notation: 'ES',
};

// Storage key
const SETTINGS_STORAGE_KEY = '@mcm_song_settings';
// Storage key independiente para el modo admin (no forma parte de SongSettings).
const ADMIN_STORAGE_KEY = '@mcm_is_admin';

// Create the context
const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

// Define the props for the provider
interface SettingsProviderProps {
  children: ReactNode;
}

// Create the provider component
export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  const [settings, setAppSettings] = useState<SongSettings>(defaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isAdmin, setIsAdminState] = useState(false);

  // Load settings from AsyncStorage when the provider mounts
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          // Merge with defaults to ensure all keys are present if some were missing
          setAppSettings((prev) => ({
            ...defaultSettings,
            ...parsedSettings,
            fontSize: parsedSettings.fontSize || defaultSettings.fontSize,
          }));
        } else {
          setAppSettings(defaultSettings);
        }
      } catch (error) {
        logger.error('Failed to load settings from AsyncStorage:', error);
        setAppSettings(defaultSettings); // Fallback to defaults on error
      }
      // Cargar el modo admin persistido (independiente de SongSettings).
      try {
        const storedAdmin = await AsyncStorage.getItem(ADMIN_STORAGE_KEY);
        setIsAdminState(storedAdmin === 'true');
      } catch (error) {
        logger.error('Failed to load admin flag from AsyncStorage:', error);
      }
      setIsLoadingSettings(false);
    };

    loadSettings();
  }, []);

  // Save settings to AsyncStorage whenever they change
  useEffect(() => {
    const saveSettings = async () => {
      // Don't save during initial loading or if settings are still the default ones (unless explicitly set)
      if (isLoadingSettings) return;
      try {
        await AsyncStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(settings),
        );
      } catch (error) {
        logger.error('Failed to save settings to AsyncStorage:', error);
      }
    };

    saveSettings();
  }, [settings, isLoadingSettings]);

  const handleSetSettings = useCallback((newValues: Partial<SongSettings>) => {
    setAppSettings((prevSettings) => ({
      ...prevSettings,
      ...newValues,
    }));
  }, []);

  const handleSetIsAdmin = useCallback((nextValue: boolean) => {
    setIsAdminState(nextValue);
    AsyncStorage.setItem(ADMIN_STORAGE_KEY, nextValue ? 'true' : 'false').catch(
      (error) => {
        logger.error('Failed to save admin flag to AsyncStorage:', error);
      },
    );
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setSettings: handleSetSettings,
      isLoadingSettings,
      isAdmin,
      setIsAdmin: handleSetIsAdmin,
    }),
    [settings, handleSetSettings, isLoadingSettings, isAdmin, handleSetIsAdmin],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use the SettingsContext
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    // SSG/SSR fallback — provider not mounted during static render.
    return {
      settings: defaultSettings,
      setSettings: () => {},
      isLoadingSettings: true,
      isAdmin: false,
      setIsAdmin: () => {},
    };
  }
  return context;
};
