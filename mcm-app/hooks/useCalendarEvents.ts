import { logger } from '@/utils/logger';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {
  addDaysISO,
  eventDateKeys,
  parseIcsDateTimeValue,
} from '@/utils/calendarDates';
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

export function parseICS(text: string): Omit<CalendarEvent, 'calendarIndex'>[] {
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
          // En los eventos de día entero el DTEND es EXCLUSIVO (el día
          // siguiente), así que hay que restarle un día. Se hace con
          // aritmética de calendario pura: el viejo `new Date(iso + 'T12:00')`
          // + `toISOString()` mezclaba hora local y UTC y se desplazaba un día
          // en dispositivos con offset grande.
          const adjustedEndDate = addDaysISO(current.endDate, -1);

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
      // Soporta DTSTART:YYYYMMDD, DTSTART;VALUE=DATE:YYYYMMDD y el instante
      // UTC (DTSTART:YYYYMMDDTHHMMSSZ) que es lo que emite el basic.ics de
      // Google. Ver `parseIcsDateTimeValue` para el criterio de conversión.
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const { date, time, isDateOnly } = parseIcsDateTimeValue(
          line.slice(idx + 1),
        );
        if (isDateOnly) current.isAllDay = true;
        if (date) current.startDate = date;
        if (time) current.startTime = time;
      }
    } else if (line.startsWith('DTEND')) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const { date, time } = parseIcsDateTimeValue(line.slice(idx + 1));
        if (date) current.endDate = date;
        if (time) current.endTime = time;
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

// Momento de la última descarga COMPLETA por lista de URLs. Dentro de la
// ventana, un montaje nuevo sirve la caché y no relanza nada: el hook está
// montado a la vez en Home y en Calendario, así que un paseo
// Home→Calendario→Home re-descargaba y re-parseaba TODOS los ICS. Cinco
// minutos: estos calendarios cambian a ritmo humano.
const FRESH_WINDOW_MS = 5 * 60 * 1000;
const lastFullFetch = new Map<string, number>();

/** Clave de coalescing/frescura: la lista de URLs, en orden. */
const calendarsKey = (calendars: CalendarConfig[]) =>
  calendars.map((c) => c.url).join('|');

/** Solo para tests: vacía el coalescer y la ventana de frescura. */
export function __resetCalendarCacheForTests() {
  calendarInflight.clear();
  lastFullFetch.clear();
}

/** Descarga y parsea UN calendario. No toca el mapa: solo devuelve eventos. */
async function fetchOneCalendar(
  cfg: CalendarConfig,
): Promise<Omit<CalendarEvent, 'calendarIndex'>[]> {
  const proxyBase = process.env.EXPO_PUBLIC_CORS_PROXY_URL;
  const proxyUrl = proxyBase ? proxyBase + encodeURIComponent(cfg.url) : null;
  let res: Response;
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
  return parseICS(await res.text());
}

function fetchAndParseCalendars(
  calendars: CalendarConfig[],
): Promise<CalendarFetchResult> {
  const key = calendarsKey(calendars);
  const existing = calendarInflight.get(key);
  if (existing) return existing;

  const run = async (): Promise<CalendarFetchResult> => {
    const map: Record<string, CalendarEvent[]> = {};
    let anyFailed = false;

    // En paralelo: antes era un `for` con `await` dentro, así que el tiempo
    // hasta calendario fresco era la SUMA de los round-trips en vez del máximo
    // (y con el proxy caído, dos timeouts seguidos POR calendario).
    // `allSettled` + recorrer `results` en orden preserva los dos invariantes:
    // `calendarIndex` es posicional, y el orden de eventos dentro de cada fecha
    // sigue siendo el de la lista de calendarios.
    const results = await Promise.allSettled(calendars.map(fetchOneCalendar));

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        // Antes este catch era vacío: un calendario roto (o su fuente caída)
        // desaparecía sin rastro. Marcamos el fallo para no pisar la caché
        // buena con un resultado parcial (ver más abajo).
        anyFailed = true;
        logger.error(
          '[calendar] fallo cargando calendario',
          i,
          calendars[i].url,
          r.reason,
        );
        return;
      }
      r.value.forEach((ev) => {
        const withCal: CalendarEvent = { ...ev, calendarIndex: i };
        // Una clave por día del rango (o solo la de inicio si es de un día).
        // `eventDateKeys` hace la aritmética entera en el calendario civil,
        // así que el cambio de hora ya no duplica ni se salta días.
        for (const dateStr of eventDateKeys(ev)) {
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(withCal);
        }
      });
    });

    // Solo un resultado COMPLETO cuenta como "fresco": si algún calendario
    // falló, el siguiente montaje debe volver a intentarlo.
    if (!anyFailed) lastFullFetch.set(key, Date.now());

    return { map, anyFailed };
  };

  const promise = run().finally(() => {
    calendarInflight.delete(key);
  });
  calendarInflight.set(key, promise);
  return promise;
}

/**
 * `calendars` DEBE tener identidad estable (memoizada). El efecto depende de
 * ella, así que un array nuevo en cada render relanza la carga en bucle. Los
 * consumidores la reciben ya memoizada de `CalendarConfigContext`.
 */
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

      // 3. Ventana de frescura: si hace menos de FRESH_WINDOW_MS que se
      //    descargó esta misma lista COMPLETA y ya hemos pintado la caché, no
      //    hay nada que revalidar. Se exige `hadCache` a propósito: sin datos en
      //    pantalla, ahorrar la descarga dejaría el calendario vacío (la
      //    escritura de la caché es fire-and-forget y puede haber fallado).
      const key = calendarsKey(calendars);
      const freshSince = lastFullFetch.get(key) ?? 0;
      if (hadCache && Date.now() - freshSince < FRESH_WINDOW_MS) {
        if (mounted) setLoading(false);
        return;
      }

      // 4. Online: revalidar en background (coalescido entre Home y Calendario).
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
