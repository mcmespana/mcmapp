import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
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
}

// Default settings
const defaultSettings: SongSettings = {
  chordsVisible: true,
  fontSize: 1.0, // 1.0em
  fontFamily: "'Roboto Mono', 'Courier New', monospace", // Default font
  notation: 'ES',
};

// Storage key
const SETTINGS_STORAGE_KEY = '@mcm_song_settings';

// Create the context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Define the props for the provider
interface SettingsProviderProps {
  children: ReactNode;
}

// Create the provider component
export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setAppSettings] = useState<SongSettings>(defaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Load settings from AsyncStorage when the provider mounts
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          // Merge with defaults to ensure all keys are present if some were missing
          setAppSettings(prev => ({
            ...defaultSettings,
            ...parsedSettings,
            fontSize: parsedSettings.fontSize || defaultSettings.fontSize,
          }));
        } else {
          setAppSettings(defaultSettings);
        }
      } catch (error) {
        console.error('Failed to load settings from AsyncStorage:', error);
        setAppSettings(defaultSettings); // Fallback to defaults on error
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
        await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save settings to AsyncStorage:', error);
      }
    };

    saveSettings();
  }, [settings, isLoadingSettings]);

  // Ensure latest settings are persisted if the provider unmounts before
  // the save effect above runs (e.g. user quickly leaves the screen)
  useEffect(() => {
    return () => {
      if (isLoadingSettings) return;
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch(error => {
        console.error('Failed to save settings to AsyncStorage on unmount:', error);
      });
    };
  }, [settings, isLoadingSettings]);

  const handleSetSettings = (newValues: Partial<SongSettings>) => {
    setAppSettings(prevSettings => ({
      ...prevSettings,
      ...newValues,
    }));
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings: handleSetSettings, isLoadingSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use the SettingsContext
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
