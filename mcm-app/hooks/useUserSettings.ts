import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserSettings {
  chordsVisible: boolean;
  fontSizeEm: number;
  fontFamily: string;
  notation: 'english' | 'spanish';
}

const DEFAULT_SETTINGS: UserSettings = {
  chordsVisible: true,
  fontSizeEm: 1.0,
  fontFamily: 'sans-serif', // This might be adjusted later
  notation: 'english',
};

const SETTINGS_KEY = 'userSettings';

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (storedSettings) {
          setSettings(JSON.parse(storedSettings));
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (e) {
        console.error('Failed to load settings from AsyncStorage.', e);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const saveSettings = async (newSettings: UserSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings to AsyncStorage.', e);
    }
  };

  const setChordsVisible = async (visible: boolean) => {
    const newSettings = { ...settings, chordsVisible: visible };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const setFontSizeEm = async (size: number) => {
    const newSettings = { ...settings, fontSizeEm: size };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const setFontFamily = async (font: string) => {
    const newSettings = { ...settings, fontFamily: font };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const setNotation = async (notationValue: 'english' | 'spanish') => {
    const newSettings = { ...settings, notation: notationValue };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  return {
    settings,
    isLoadingSettings: isLoading,
    setChordsVisible,
    setFontSizeEm,
    setFontFamily,
    setNotation,
  };
};
