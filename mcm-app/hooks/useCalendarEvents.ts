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

/** Suma `n` días a una fecha 'YYYY-MM-DD' sin pasar por la hora local (evita
 * que un cambio de hora DST duplique o salte un día al iterar). */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d + n);
  const nd = new Date(t);
  const mm = String(nd.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nd.getUTCDate()).padStart(2, '0');
  return `${nd.getUTCFullYear()}-${mm}-${dd}`;
}

/** Convierte una fecha+hora en UTC (sufijo `Z` del ICS) a fecha/hora local del
 * dispositivo. El feed real (`basic.ics`, ver useCalendarConfigs.ts) emite
 * SIEMPRE `Z` para eventos con hora, sin `TZID` — verificado contra el feed
 * en vivo. Valores flotantes (sin `Z`) no pasan por aquí y se muestran tal
 * cual, como hoy. */
function utcToLocal(
  dateISO: string,
  timeHHMM: string,
): { date: string; time: string } {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const local = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  const time = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
  return { date, time };
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
          // For all-day events, DTEND is exclusive (next day)
          // So we need to subtract one day from endDate
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
        let startDate: string | undefined;
        if (/^\d{8}$/.test(datePart)) {
          const year = datePart.substring(0, 4);
          const month = datePart.substring(4, 6);
          const day = datePart.substring(6, 8);
          startDate = `${year}-${month}-${day}`;
        }

        const timeMatch = value.match(/T(\d{2})(\d{2})/);
        let startTime: string | undefined;
        if (timeMatch && !isDateOnly) {
          startTime = `${timeMatch[1]}:${timeMatch[2]}`;
        }

        // El feed emite las horas en UTC (sufijo Z) — convertir a local.
        if (startDate && startTime && value.endsWith('Z')) {
          ({ date: startDate, time: startTime } = utcToLocal(
            startDate,
            startTime,
          ));
        }
        if (startDate) current.startDate = startDate;
        if (startTime) current.startTime = startTime;
      }
    } else if (line.startsWith('DTEND')) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const value = line.slice(idx + 1).trim();
        const datePart = value.replace(/T.*$/, '');
        let endDate: string | undefined;
        if (/^\d{8}$/.test(datePart)) {
          const year = datePart.substring(0, 4);
          const month = datePart.substring(4, 6);
          const day = datePart.substring(6, 8);
          endDate = `${year}-${month}-${day}`;
        }

        const timeMatch = value.match(/T(\d{2})(\d{2})/);
        let endTime: string | undefined;
        if (timeMatch && !value.match(/^\d{8}$/)) {
          endTime = `${timeMatch[1]}:${timeMatch[2]}`;
        }

        if (endDate && endTime && value.endsWith('Z')) {
          ({ date: endDate, time: endTime } = utcToLocal(endDate, endTime));
        }
        if (endDate) current.endDate = endDate;
        if (endTime) current.endTime = endTime;
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

/** Solo para tests: vacía el coalescer de calendarios y la ventana de frescura. */
export function __resetCalendarCacheForTests() {
  calendarInflight.clear();
  lastFullFetch.clear();
}

// Última descarga COMPLETA por lista de URLs. Dentro de la ventana, los
// montajes nuevos sirven caché sin relanzar la descarga (Home→Calendario→
// Home re-descargaba y re-parseaba todos los ICS). 5 min: los calendarios
// cambian a ritmo humano. Solo se registra cuando el fetch fue completo
// (`!anyFailed`) — un resultado parcial no cuenta como fresco.
const FRESH_WINDOW_MS = 5 * 60 * 1000;
const lastFullFetch = new Map<string, number>();

/** Descarga (con proxy + fallback directo) y parsea UN calendario. */
async function fetchOneCalendar(
  cfg: CalendarConfig,
): Promise<Omit<CalendarEvent, 'calendarIndex'>[]> {
  const proxyBase = process.env.EXPO_PUBLIC_CORS_PROXY_URL;
  const proxyUrl = proxyBase ? proxyBase + encodeURIComponent(cfg.url) : null;
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
  return parseICS(text);
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

    // Descarga en PARALELO (antes en serie: el tiempo total era la suma de
    // los round-trips en vez del máximo). `Promise.allSettled` preserva el
    // índice posicional de cada calendario en `results[i]`, imprescindible
    // para `calendarIndex` — el merge recorre `results` en orden, así que
    // el orden de eventos por calendario dentro de cada fecha no cambia.
    const results = await Promise.allSettled(
      calendars.map((cfg) => fetchOneCalendar(cfg)),
    );

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        r.value.forEach((ev) => {
          const withCal: CalendarEvent = { ...ev, calendarIndex: i };

          // If no endDate or it's a single-day event, only add to the start date
          if (!ev.endDate || ev.isSingleDay) {
            const dateStr = ev.startDate;
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(withCal);
          } else {
            // For multi-day events, iterate through the range using pure
            // calendar arithmetic (UTC de punta a punta) — evita el bug de
            // duplicar/saltar un día al cruzar un cambio de hora DST.
            for (
              let cur = ev.startDate;
              cur <= ev.endDate;
              cur = addDaysISO(cur, 1)
            ) {
              if (!map[cur]) map[cur] = [];
              map[cur].push(withCal);
            }
          }
        });
      } else {
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
      }
    });

    if (!anyFailed) lastFullFetch.set(key, Date.now());
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

      // 2.5. Ventana de frescura: si ya hubo una descarga COMPLETA reciente
      // para esta misma lista de calendarios, la caché ya pintada (paso 1)
      // es suficiente — evita que un paseo Home→Calendario→Home
      // re-descargue y re-parsee todos los ICS en cada montaje.
      const freshnessKey = calendars.map((c) => c.url).join('|');
      const lastFetchAt = lastFullFetch.get(freshnessKey) ?? 0;
      if (Date.now() - lastFetchAt < FRESH_WINDOW_MS) {
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
