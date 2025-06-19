import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeScheme = 'light' | 'dark';

interface AppSettings {
  fontScale: number;
  theme: ThemeScheme;
}

interface AppSettingsContextType {
  settings: AppSettings;
  setSettings: (values: Partial<AppSettings>) => void;
  loading: boolean;
}

const defaultSettings: AppSettings = {
  fontScale: 1,
  theme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
};

const STORAGE_KEY = '@app_settings';

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          setSettingsState(prev => ({ ...prev, ...JSON.parse(data) }));
        }
      } catch (e) {
        console.error('Failed loading app settings', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(e => {
      console.error('Failed saving app settings', e);
    });
  }, [settings, loading]);

  const update = (values: Partial<AppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...values }));
  };

  return (
    <AppSettingsContext.Provider value={{ settings, setSettings: update, loading }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
};
