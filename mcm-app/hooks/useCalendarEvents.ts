import { logger } from '@/utils/logger';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import type { CalendarConfig } from './useCalendarConfigs';

export interface CalendarEvent {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (only present for non all-day events)
  endTime?: string; // HH:MM
  title: string;
  description?: string;
  location?: string;
  url?: string;
  conferenceUrl?: string; // Detected Meet/Zoom/Teams link
  calendarIndex: number;
  isAllDay?: boolean; // Track if this is an all-day event
  isSingleDay?: boolean; // Track if this is effectively a single day event (after corrections)
}

const CONFERENCE_URL_REGEX =
  /https?:\/\/(?:[\w-]+\.)*(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|gotomeeting\.com|whereby\.com|jit\.si|meet\.jit\.si)\/[^\s<>"')]+/i;

function parseICS(text: string): Omit<CalendarEvent, 'calendarIndex'>[] {
  // Unfold lines that start with a space as specified in RFC 5545
  const unfolded: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.startsWith(' ')) {
      if (unfolded.length) {
        unfolded[unfolded.length - 1] += rawLine.slice(1);
      }
    } else {
      unfolded.push(rawLine);
    }
  }

  const events: Omit<CalendarEvent, 'calendarIndex'>[] = [];
  let current: Partial<Omit<CalendarEvent, 'calendarIndex'>> = {};

  for (const line of unfolded) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (current.startDate && current.title) {
        // Post-process to handle all-day events correctly
        if (current.isAllDay && current.endDate) {
          // For all-day events, DTEND is exclusive (next day)
          // So we need to subtract one day from endDate
          const endDate = new Date(current.endDate + 'T12:00:00'); // Use noon to avoid timezone issues
          endDate.setDate(endDate.getDate() - 1);
          const adjustedEndDate = endDate.toISOString().split('T')[0];

          // If after adjustment the end date equals start date,
          // it's a single-day event, remove endDate completely
          if (adjustedEndDate === current.startDate) {
            current.endDate = undefined;
            current.isSingleDay = true;
          } else {
            current.endDate = adjustedEndDate;
            current.isSingleDay = false;
          }
        } else if (!current.endDate) {
          // Events without endDate are single-day by default
          current.isSingleDay = true;
        }

        events.push(current as Omit<CalendarEvent, 'calendarIndex'>);
      }
      current = {};
    } else if (line.startsWith('SUMMARY:')) {
      current.title = line.slice('SUMMARY:'.length).trim();
    } else if (line.startsWith('DESCRIPTION:')) {
      const raw = line
        .slice('DESCRIPTION:'.length)
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .trim();
      current.description = raw || undefined;
      // If we haven't found a conference URL yet, try to detect one in the description
      if (!current.conferenceUrl && raw) {
        const match = raw.match(CONFERENCE_URL_REGEX);
        if (match) current.conferenceUrl = match[0];
      }
    } else if (line.startsWith('X-GOOGLE-CONFERENCE:')) {
      current.conferenceUrl = line.slice('X-GOOGLE-CONFERENCE:'.length).trim();
    } else if (line.startsWith('LOCATION:')) {
      current.location =
        line
          .slice('LOCATION:'.length)
          .replace(/\\n/gi, '\n')
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .replace(/\\\\/g, '\\')
          .trim()
          .split('\n')
          .filter((part) => part.trim().toLowerCase() !== 'españa')
          .join('\n')
          .trim() || undefined;
    } else if (line.startsWith('URL:')) {
      current.url = line.slice('URL:'.length).trim();
    } else if (line.startsWith('DTSTART')) {
      // Soporta DTSTART:YYYYMMDD y DTSTART;VALUE=DATE:YYYYMMDD y variantes
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const value = line.slice(idx + 1).trim();
        // Check if this is a date-only value (all-day event)
        const isDateOnly = !value.includes('T') && /^\d{8}$/.test(value);
        if (isDateOnly) {
          current.isAllDay = true;
        }

        const datePart = value.replace(/T.*$/, '');
        if (/^\d{8}$/.test(datePart)) {
          const year = datePart.substring(0, 4);
          const month = datePart.substring(4, 6);
          const day = datePart.substring(6, 8);
          current.startDate = `${year}-${month}-${day}`;
        }

        const timeMatch = value.match(/T(\d{2})(\d{2})/);
        if (timeMatch && !isDateOnly) {
          current.startTime = `${timeMatch[1]}:${timeMatch[2]}`;
        }
      }
    } else if (line.startsWith('DTEND')) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const value = line.slice(idx + 1).trim();
        const datePart = value.replace(/T.*$/, '');
        if (/^\d{8}$/.test(datePart)) {
          const year = datePart.substring(0, 4);
          const month = datePart.substring(4, 6);
          const day = datePart.substring(6, 8);
          current.endDate = `${year}-${month}-${day}`;
        }

        const timeMatch = value.match(/T(\d{2})(\d{2})/);
        if (timeMatch && !value.match(/^\d{8}$/)) {
          current.endTime = `${timeMatch[1]}:${timeMatch[2]}`;
        }
      }
    }
  }
  return events;
}

type CalendarFetchResult = {
  map: Record<string, CalendarEvent[]>;
  anyFailed: boolean;
};

// Descarga + parseo de TODOS los calendarios, COALESCIDO por la lista de URLs:
// `useCalendarEvents` se monta a la vez en Home y en Calendario; sin esto cada
// instancia descargaba y parseaba todos los ICS por su cuenta. Dos monturas
// concurrentes con la misma lista comparten un único ciclo fetch+parse.
const calendarInflight = new Map<string, Promise<CalendarFetchResult>>();

/** Solo para tests: vacía el coalescer de calendarios. */
export function __resetCalendarCacheForTests() {
  calendarInflight.clear();
}

function fetchAndParseCalendars(
  calendars: CalendarConfig[],
): Promise<CalendarFetchResult> {
  const key = calendars.map((c) => c.url).join('|');
  const existing = calendarInflight.get(key);
  if (existing) return existing;

  const run = async (): Promise<CalendarFetchResult> => {
    const map: Record<string, CalendarEvent[]> = {};
    let anyFailed = false;
    for (let i = 0; i < calendars.length; i++) {
      const cfg = calendars[i];
      try {
        const proxyBase = process.env.EXPO_PUBLIC_CORS_PROXY_URL;
        const proxyUrl = proxyBase
          ? proxyBase + encodeURIComponent(cfg.url)
          : null;
        let res: Response | null = null;
        if (proxyUrl) {
          try {
            res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('Proxy request failed');
          } catch {
            // Fallback to direct fetch if proxy fails
            res = await fetch(cfg.url);
          }
        } else {
          res = await fetch(cfg.url);
        }
        const text = await res.text();
        const events = parseICS(text);

        events.forEach((ev) => {
          const withCal: CalendarEvent = { ...ev, calendarIndex: i };

          // If no endDate or it's a single-day event, only add to the start date
          if (!ev.endDate || ev.isSingleDay) {
            const dateStr = ev.startDate;
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(withCal);
          } else {
            // For multi-day events, iterate through the range
            const start = new Date(ev.startDate);
            const end = new Date(ev.endDate);
            for (
              let d = new Date(start);
              d <= end;
              d.setDate(d.getDate() + 1)
            ) {
              const dateStr = d.toISOString().split('T')[0];
              if (!map[dateStr]) map[dateStr] = [];
              map[dateStr].push(withCal);
            }
          }
        });
      } catch (e) {
        // Antes este catch era vacío: un calendario roto (o su fuente caída)
        // desaparecía sin rastro. Marcamos el fallo para no pisar la caché
        // buena con un resultado parcial (ver más abajo).
        anyFailed = true;
        logger.error('[calendar] fallo cargando calendario', i, cfg.url, e);
      }
    }
    return { map, anyFailed };
  };

  const promise = run().finally(() => {
    calendarInflight.delete(key);
  });
  calendarInflight.set(key, promise);
  return promise;
}

export default function useCalendarEvents(calendars: CalendarConfig[]) {
  const [eventsByDate, setEventsByDate] = useState<
    Record<string, CalendarEvent[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const state = await Network.getNetworkStateAsync();
      const connected =
        state.isConnected && state.isInternetReachable !== false;

      // 1. Caché primero SIEMPRE (online u offline): stale-while-revalidate.
      //    Antes la caché solo se usaba offline; online el usuario esperaba a
      //    que bajaran todos los ICS aunque hubiera datos válidos cacheados.
      const cachedStr = await AsyncStorage.getItem('calendar_events');
      let hadCache = false;
      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr) as Record<
            string,
            CalendarEvent[]
          >;
          hadCache = true;
          if (mounted) {
            setEventsByDate(cached);
            setLoading(false);
          }
        } catch (e) {
          logger.error('[calendar] caché local corrupta', e);
        }
      }

      // 2. Offline: nos quedamos con la caché (o con nada si no la había).
      if (!connected) {
        if (mounted) setLoading(false);
        return;
      }

      // 3. Online: revalidar en background (coalescido entre Home y Calendario).
      const { map, anyFailed } = await fetchAndParseCalendars(calendars);
      if (!mounted) return;

      if (!anyFailed) {
        // Resultado completo y autoritativo → actualiza vista y persiste.
        setEventsByDate(map);
        AsyncStorage.setItem('calendar_events', JSON.stringify(map)).catch(
          () => {},
        );
      } else if (!hadCache) {
        // Parcial pero no había caché: mostrar lo que sí llegó (mejor que nada).
        // NO se persiste: solo se guarda un resultado completo.
        setEventsByDate(map);
      }
      // Parcial CON caché: mantenemos la vista cacheada (no la degradamos con
      // un resultado incompleto) y tampoco pisamos el disco.
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [calendars]);

  return { eventsByDate, loading };
}
