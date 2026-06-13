import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirebaseData } from './useFirebaseData';
import { useResolvedProfileConfig } from './useResolvedProfileConfig';

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

// La selección se guarda por ID de calendario ({ [id]: boolean }), no por
// índice. Así sobrevive a reordenamientos, altas/bajas de calendarios y al
// fallback transitorio mientras Firebase carga (que antes truncaba el array
// guardado y perdía la selección del usuario).
const CALENDAR_SELECTION_KEY = '@mcm_calendar_selection_v2';
// Clave antigua (array booleano por índice) — se migra una sola vez.
const LEGACY_SETTINGS_KEY = '@mcm_calendar_settings';

type SelectionMap = Record<string, boolean>;

export function useCalendarConfigs() {
  const {
    data: calendarData,
    loading,
    offline,
  } = useFirebaseData<CalendarConfigFirebase[]>('calendars', 'calendars');

  const resolved = useResolvedProfileConfig();

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

  const calendarsToUse = useMemo(
    () =>
      calendarData && calendarData.length > 0 ? calendarData : fallbackConfigs,
    [calendarData, fallbackConfigs],
  );

  // `null` mientras no se ha leído AsyncStorage; mapa explícito del usuario una
  // vez cargado. Las claves ausentes caen al default del perfil/calendario.
  const [selection, setSelection] = useState<SelectionMap | null>(null);
  const legacyRef = useRef<boolean[] | null>(null);
  const migratedRef = useRef(false);

  // Default de un calendario cuando el usuario no lo ha tocado explícitamente.
  const defaultFor = useCallback(
    (cal: CalendarConfigFirebase) => {
      const profileDefaults = resolved.defaultCalendars;
      if (profileDefaults && profileDefaults.length > 0) {
        return profileDefaults.includes(cal.id);
      }
      return cal.defaultSelected;
    },
    [resolved.defaultCalendars],
  );

  // Carga la selección persistida una sola vez.
  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        const stored = await AsyncStorage.getItem(CALENDAR_SELECTION_KEY);
        if (stored) {
          migratedRef.current = true;
          if (mounted) setSelection(JSON.parse(stored));
          return;
        }
        // Si no hay clave nueva, recordamos la antigua para migrarla cuando
        // tengamos la lista real de calendarios (no el fallback).
        const legacy = await AsyncStorage.getItem(LEGACY_SETTINGS_KEY);
        if (legacy) legacyRef.current = JSON.parse(legacy);
      } catch (error) {
        console.error('Error loading calendar settings:', error);
      } finally {
        if (mounted) {
          setSelection((prev) => prev ?? {});
        }
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  // Migración one-shot del array por índice → mapa por ID, en cuanto llega la
  // lista real de Firebase (no el fallback).
  useEffect(() => {
    if (migratedRef.current) return;
    if (!calendarData || calendarData.length === 0) return;
    migratedRef.current = true;
    const legacy = legacyRef.current;
    if (!legacy) return;
    const map: SelectionMap = {};
    calendarData.forEach((cal, idx) => {
      if (idx < legacy.length) map[cal.id] = legacy[idx];
    });
    setSelection(map);
    AsyncStorage.setItem(CALENDAR_SELECTION_KEY, JSON.stringify(map)).catch(
      () => {},
    );
    AsyncStorage.removeItem(LEGACY_SETTINGS_KEY).catch(() => {});
  }, [calendarData]);

  const calendarConfigs: CalendarConfig[] = useMemo(
    () =>
      calendarsToUse.map((cal) => ({
        name: cal.name,
        url: cal.url,
        color: cal.color,
      })),
    [calendarsToUse],
  );

  // Booleanos alineados con `calendarConfigs` (interfaz que esperan los
  // consumidores), derivados del mapa por ID + defaults.
  const visibleCalendars = useMemo(() => {
    if (selection === null) return [];
    return calendarsToUse.map((cal) =>
      Object.prototype.hasOwnProperty.call(selection, cal.id)
        ? selection[cal.id]
        : defaultFor(cal),
    );
  }, [selection, calendarsToUse, defaultFor]);

  const toggleCalendarVisibility = useCallback(
    (index: number) => {
      const cal = calendarsToUse[index];
      if (!cal) return;
      setSelection((prev) => {
        const base = prev ?? {};
        const current = Object.prototype.hasOwnProperty.call(base, cal.id)
          ? base[cal.id]
          : defaultFor(cal);
        const next: SelectionMap = { ...base, [cal.id]: !current };
        AsyncStorage.setItem(
          CALENDAR_SELECTION_KEY,
          JSON.stringify(next),
        ).catch((error) => {
          console.error('Error saving calendar settings:', error);
        });
        return next;
      });
    },
    [calendarsToUse, defaultFor],
  );

  return {
    calendarConfigs,
    visibleCalendars,
    toggleCalendarVisibility,
    loading: loading || selection === null,
    offline,
  };
}
