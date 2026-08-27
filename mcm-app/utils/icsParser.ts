/**
 * Parser de ICS (RFC 5545) y expansión de eventos a mapa por fecha.
 *
 * Módulo PURO a propósito: ni React, ni AsyncStorage, ni red, ni `logger`.
 * Lo importan dos sitios muy distintos:
 *
 *   - `hooks/useCalendarEvents.ts` (la app, en el dispositivo)
 *   - `functions/src/index.ts` (la Cloud Function `cacheCalendarIcs`, que
 *     precachea los ICS en Firebase cada pocas horas)
 *
 * Tener UN solo parser es el punto: los arreglos de DST, el tope de
 * `MAX_EVENT_DAYS` y el unfolding de líneas ya costaron sangre una vez.
 *
 * ── Por qué el parseo va en DOS fases ──────────────────────────────────────
 *
 * El feed emite las horas en UTC (sufijo `Z`) y la app las quiere en la zona
 * del DISPOSITIVO. Si la Cloud Function (que corre en `us-central1`) aplicara
 * esa conversión al cachear, guardaría las horas en hora de Chicago y todo el
 * mundo vería los eventos desplazados. Así que:
 *
 *   1. `parseICSPortable(text)` → eventos SIN localizar, con banderas
 *      `utcStart`/`utcEnd`. Independiente de zona horaria ⇒ cacheable.
 *   2. `localizeEvents(events)` → aplica la conversión a hora local y el
 *      ajuste de `DTEND` exclusivo. Corre SIEMPRE en el dispositivo.
 *
 * `parseICS(text)` es simplemente la composición de las dos, y hay un test que
 * lo verifica (`__tests__/icsParser.test.ts`) para que la ruta cacheada y la
 * ruta directa no puedan divergir nunca.
 */

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

/** Evento ya localizado, aún sin asignar a un calendario concreto. */
export type ParsedEvent = Omit<CalendarEvent, 'calendarIndex'>;

/**
 * Evento tal y como sale del ICS: sin convertir a la zona del dispositivo y
 * sin el ajuste de `DTEND` exclusivo. Es lo que se cachea en Firebase.
 */
export interface PortableEvent {
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  conferenceUrl?: string;
  isAllDay?: boolean;
  /** El `DTSTART` traía sufijo `Z` → hay que convertirlo a hora local. */
  utcStart?: boolean;
  /** Idem para `DTEND`. */
  utcEnd?: boolean;
}

/**
 * Tope de días que se expanden de UN evento. Un ICS corrupto con un `DTEND` en
 * el año 3000 hacía un bucle de cientos de miles de iteraciones metiendo el
 * mismo evento en cada fecha; ningún evento real de este calendario dura más de
 * un año.
 */
export const MAX_EVENT_DAYS = 366;

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

/**
 * Convierte una fecha+hora en UTC (sufijo `Z` del ICS) a fecha/hora local del
 * dispositivo. El feed real (`basic.ics`, ver useCalendarConfigs.ts) emite
 * SIEMPRE `Z` para eventos con hora, sin `TZID` — verificado contra el feed
 * en vivo. Valores flotantes (sin `Z`) no pasan por aquí y se muestran tal
 * cual, como hoy.
 */
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

/** Fase 1: ICS → eventos crudos, independientes de zona horaria. */
export function parseICSPortable(text: string): PortableEvent[] {
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

  const events: PortableEvent[] = [];
  let current: Partial<PortableEvent> = {};

  for (const line of unfolded) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (current.startDate && current.title) {
        events.push(current as PortableEvent);
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

        // La conversión UTC → local NO se hace aquí: la hace `localizeEvents`
        // ya en el dispositivo (ver cabecera del módulo).
        if (startDate && startTime && value.endsWith('Z')) {
          current.utcStart = true;
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
          current.utcEnd = true;
        }
        if (endDate) current.endDate = endDate;
        if (endTime) current.endTime = endTime;
      }
    }
  }
  return events;
}

/**
 * Fase 2: eventos crudos → eventos localizados a la zona del dispositivo, con
 * el `DTEND` exclusivo de los eventos de día completo ya ajustado.
 *
 * Corre siempre en el dispositivo, tanto si los eventos vienen de un ICS
 * recién descargado como si vienen del nodo precacheado de Firebase.
 */
export function localizeEvents(events: PortableEvent[]): ParsedEvent[] {
  const out: ParsedEvent[] = [];

  for (const raw of events) {
    const { utcStart, utcEnd, ...rest } = raw;
    const ev: ParsedEvent = { ...rest };

    if (utcStart && ev.startTime) {
      const { date, time } = utcToLocal(ev.startDate, ev.startTime);
      ev.startDate = date;
      ev.startTime = time;
    }
    if (utcEnd && ev.endDate && ev.endTime) {
      const { date, time } = utcToLocal(ev.endDate, ev.endTime);
      ev.endDate = date;
      ev.endTime = time;
    }

    // Post-process to handle all-day events correctly
    if (ev.isAllDay && ev.endDate) {
      // For all-day events, DTEND is exclusive (next day)
      // So we need to subtract one day from endDate
      const adjustedEndDate = addDaysISO(ev.endDate, -1);

      // If after adjustment the end date equals start date,
      // it's a single-day event, remove endDate completely
      if (adjustedEndDate === ev.startDate) {
        ev.endDate = undefined;
        ev.isSingleDay = true;
      } else {
        ev.endDate = adjustedEndDate;
        ev.isSingleDay = false;
      }
    } else if (!ev.endDate) {
      // Events without endDate are single-day by default
      ev.isSingleDay = true;
    }

    out.push(ev);
  }

  return out;
}

/** ICS → eventos listos para pintar. Composición de las dos fases. */
export function parseICS(text: string): ParsedEvent[] {
  return localizeEvents(parseICSPortable(text));
}

/**
 * Expande una lista de calendarios (en el orden en que el usuario los ve) al
 * mapa `fecha → eventos` que consume la UI.
 *
 * El `calendarIndex` es POSICIONAL: depende del orden en que `useCalendarConfigs`
 * ordena los calendarios para ESTE usuario (su delegación primero). Por eso el
 * nodo precacheado guarda los eventos por ID de calendario y la expansión se
 * hace siempre en el dispositivo — un índice calculado en el servidor pintaría
 * los colores de otra persona.
 *
 * `onTruncate` se avisa cuando un evento supera `MAX_EVENT_DAYS`, para que cada
 * llamante lo registre con su propio logger.
 */
export function buildEventsByDate(
  calendars: (ParsedEvent[] | undefined)[],
  onTruncate?: (event: ParsedEvent) => void,
): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};

  calendars.forEach((events, i) => {
    if (!events) return;
    events.forEach((ev) => {
      const withCal: CalendarEvent = { ...ev, calendarIndex: i };

      // If no endDate or it's a single-day event, only add to the start date
      if (!ev.endDate || ev.isSingleDay) {
        const dateStr = ev.startDate;
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(withCal);
        return;
      }

      // For multi-day events, iterate through the range using pure calendar
      // arithmetic (UTC de punta a punta) — evita el bug de duplicar/saltar un
      // día al cruzar un cambio de hora DST. Acotado a MAX_EVENT_DAYS: un
      // DTEND corrupto no puede colgar el parseo.
      let days = 0;
      for (
        let cur = ev.startDate;
        cur <= ev.endDate && days < MAX_EVENT_DAYS;
        cur = addDaysISO(cur, 1), days++
      ) {
        if (!map[cur]) map[cur] = [];
        map[cur].push(withCal);
      }
      if (days >= MAX_EVENT_DAYS) onTruncate?.(ev);
    });
  });

  return map;
}
