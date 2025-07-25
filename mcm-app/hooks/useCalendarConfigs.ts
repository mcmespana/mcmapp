import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirebaseData } from './useFirebaseData';

export interface CalendarConfigFirebase {
  id: string;
  name: string;
  url: string;
  color: string;
  defaultSelected: boolean;
}

export interface CalendarConfig {
  name: string;
  url: string;
  color: string;
}

const CALENDAR_SETTINGS_KEY = '@mcm_calendar_settings';

export function useCalendarConfigs() {
  const {
    data: calendarData,
    loading,
    offline,
  } = useFirebaseData<CalendarConfigFirebase[]>('calendars', 'calendars');
  
  const [visibleCalendars, setVisibleCalendars] = useState<boolean[]>([]);
  const [calendarConfigs, setCalendarConfigs] = useState<CalendarConfig[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Fallback configuration in case Firebase data is not available
  const fallbackConfigs: CalendarConfigFirebase[] = useMemo(
    () => [
      {
        id: 'mcm-europa',
        name: 'MCM Europa',
        url: 'https://calendar.google.com/calendar/ical/consolacion.org_11dp4qj27sgud37d7fjanghfck%40group.calendar.google.com/public/basic.ics',
        color: '#31AADF',
        defaultSelected: true,
      },
    ],
    [],
  );

  // Load user calendar settings from AsyncStorage
  useEffect(() => {
    async function loadSettings() {
      try {
        const storedSettings = await AsyncStorage.getItem(
          CALENDAR_SETTINGS_KEY,
        );
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          setVisibleCalendars(parsedSettings);
        }
      } catch (error) {
        console.error('Error loading calendar settings:', error);
      } finally {
        setSettingsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  // Process calendar data when it's available
  useEffect(() => {
    if (!settingsLoaded) return;

    const calendarsToUse = calendarData || fallbackConfigs;
    
    // Convert Firebase format to CalendarConfig format
    const configs: CalendarConfig[] = calendarsToUse.map((cal) => ({
      name: cal.name,
      url: cal.url,
      color: cal.color,
    }));
    
    setCalendarConfigs(configs);

    // If no user settings exist, use default selection
    if (visibleCalendars.length === 0) {
      const defaultSelection = calendarsToUse.map((cal) => cal.defaultSelected);
      setVisibleCalendars(defaultSelection);
    } else if (visibleCalendars.length !== calendarsToUse.length) {
      // Adjust array length if number of calendars changed
      const newSelection = [...visibleCalendars];
      while (newSelection.length < calendarsToUse.length) {
        newSelection.push(false);
      }
      if (newSelection.length > calendarsToUse.length) {
        newSelection.splice(calendarsToUse.length);
      }
      setVisibleCalendars(newSelection);
    }
  }, [calendarData, settingsLoaded, fallbackConfigs, visibleCalendars]);

  // Save user settings to AsyncStorage whenever they change
  useEffect(() => {
    if (!settingsLoaded || visibleCalendars.length === 0) return;
    
    async function saveSettings() {
      try {
        await AsyncStorage.setItem(
          CALENDAR_SETTINGS_KEY,
          JSON.stringify(visibleCalendars),
        );
      } catch (error) {
        console.error('Error saving calendar settings:', error);
      }
    }
    saveSettings();
  }, [visibleCalendars, settingsLoaded]);

  const toggleCalendarVisibility = (index: number) => {
    if (index >= 0 && index < visibleCalendars.length) {
      const newVisibility = [...visibleCalendars];
      newVisibility[index] = !newVisibility[index];
      setVisibleCalendars(newVisibility);
    }
  };

  return {
    calendarConfigs,
    visibleCalendars,
    toggleCalendarVisibility,
    loading: loading || !settingsLoaded,
    offline,
  };
}
