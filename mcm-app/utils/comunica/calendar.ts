// utils/comunica/calendar.ts
//
// El calendario de familias (plan 16), puro. El plan 11 adelanta lo que
// necesita la portada: `upcomingAgendaItems`, la agenda «Próximas
// actividades». El 16 añade aquí el resto (colores, bandas, puntitos).
//
// Regla de la agenda (`sticpa_home_agenda_items`, `inc/stic-calendar.php`):
// los eventos ABIERTOS a inscripción para el perfil activo que empiezan hoy o
// después, por fecha, cinco como mucho. ⚠️ El plugin dejó de listar las
// sesiones el 24/10/2026 («te apuntas al evento, no a sus sesiones»; a un
// monitor le enseñaba las de los chavales) y manda el código: el plan 11 y el
// 16, escritos antes, decían «luego las sesiones próximas».

import type {
  CalendarData,
  CalendarEvent,
  CalendarSession,
} from '@/services/comunica/contract';
import { longDay } from './dates';
import { addDays, madridDay, madridTime } from './madrid';

export interface AgendaItem {
  /** Por ahora solo hay abiertos (ver arriba). */
  kind: 'open';
  /** El id del evento: su ficha es el destino. */
  eventId: string;
  title: string;
  /** `YYYY-MM-DD`, el día en que empieza. */
  day: string;
}

/** Cuántas filas tiene la agenda de la portada. */
export const AGENDA_LIMIT = 5;

export function upcomingAgendaItems(
  data: Pick<CalendarData, 'openEvents'>,
  today: string,
  limit = AGENDA_LIMIT,
): AgendaItem[] {
  return data.openEvents
    .filter((e) => e.startDate >= today)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.name.localeCompare(b.name, 'es'),
    )
    .slice(0, Math.max(1, limit))
    .map((e) => ({
      kind: 'open' as const,
      eventId: e.id,
      title: e.name,
      day: e.startDate,
    }));
}

// ── El calendario (plan 16): colores, bandas, puntitos ──────────────────────
//
// Origen: `inc/stic-calendar.php` (`sticpa_session_bucket`,
// `sticpa_calendar_effective_bucket`, `sticpa_calendar_fc_events`, la
// leyenda) y `sticpa_time_range_text` (`inc/stic-sessions.php`).

/** Los estados que se pintan (los de la paleta del plugin, ya juntados). */
export type CalendarBucket =
  'upcoming' | 'attended' | 'absent' | 'pending' | 'open' | 'registered';

/**
 * C4 (`calendario-marcas` = «como el plugin», 24/10): «parcial» y «falta
 * justificada» están APAGADOS y se juntan con «Asististe» y «No asististe».
 * Encender uno es cambiar aquí (y añadir su color y su etiqueta).
 */
export const CALENDAR_ENABLED_STATES = {
  partial: false,
  absentJustified: false,
} as const;

export const BUCKET_LABEL: Record<CalendarBucket, string> = {
  upcoming: 'Próxima',
  attended: 'Asististe',
  absent: 'No asististe',
  pending: 'Sin registrar',
  open: 'Abierto a inscripción',
  registered: 'Con plaza',
};

/** La leyenda, en el orden del plugin (solo los estados encendidos). */
export const CALENDAR_LEGEND: CalendarBucket[] = [
  'upcoming',
  'attended',
  'absent',
  'pending',
  'open',
  'registered',
];

/**
 * C4: si empieza después de ahora, «Próxima» (tenga la marca que tenga); si
 * no, por su asistencia, con «parcial» y «justificada» juntadas.
 */
export function sessionBucket(
  s: Pick<CalendarSession, 'startsAt' | 'attendance'>,
  now: Date,
): CalendarBucket {
  if (new Date(s.startsAt).getTime() > now.getTime()) return 'upcoming';
  switch (s.attendance) {
    case 'yes':
      return 'attended';
    case 'partial':
      // Apagado: cuenta como asistir (si se enciende, necesita su color).
      return 'attended';
    case 'no_unjustified':
    case 'no_justified':
      return 'absent';
    default:
      return 'pending';
  }
}

/** El nombre sin el « | 30/10/2026 17:30h» del CRM (`sticpa_calendar_session_title`). */
export function sessionTitle(name: string): string {
  const short = name
    .replace(
      /\s*\|\s*\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*h?)?\s*$/u,
      '',
    )
    .trim();
  return short || name;
}

/** Sin fin y a las 00:00: una salida de día entero («Todo el día»). */
export const isAllDaySession = (
  s: Pick<CalendarSession, 'startsAt' | 'endsAt'>,
) => !s.endsAt && madridTime(s.startsAt) === '00:00';

/**
 * `sticpa_time_range_text`: «17:30 – 19:00»; si no tiene fin, cruza la
 * medianoche o acaba antes de empezar, solo el inicio.
 */
export function timeRangeText(startsAt: string, endsAt: string | null): string {
  const start = madridTime(startsAt);
  if (!endsAt) return start;
  const a = new Date(startsAt);
  const b = new Date(endsAt);
  if (b.getTime() <= a.getTime() || madridDay(a) !== madridDay(b)) return start;
  return `${start} – ${madridTime(endsAt)}`;
}

/** Todos los días de un evento (inclusive). Un fin anterior al inicio, solo el inicio. */
export function eventDays(e: Pick<CalendarEvent, 'startDate' | 'endDate'>) {
  const end = e.endDate && e.endDate > e.startDate ? e.endDate : e.startDate;
  const out: string[] = [];
  // Tope de un año: un evento mal cerrado no llena el calendario de días.
  for (let d = e.startDate; d <= end && out.length < 366; d = addDays(d, 1)) {
    out.push(d);
  }
  return out;
}

/** Una fila del día (y un puntito del mes). */
export interface CalendarItem {
  kind: 'session' | 'open' | 'registered';
  /** El id de la sesión o del evento. */
  id: string;
  eventId: string;
  title: string;
  /** «17:30» o `null` (todo el día). */
  time: string | null;
  /** El evento de una sesión (vacío en las bandas). */
  eventName: string;
  bucket: CalendarBucket;
}

/**
 * C5: cada cosa del calendario, por día. Las bandas de evento («Con plaza» y
 * «Abierto a inscripción») marcan TODOS sus días, salvo si el evento ya
 * aporta sesiones (un curso de octubre a mayo taparía el mes). Dentro del
 * día, primero lo de todo el día y luego por hora.
 */
export function calendarItemsByDay(
  data: Pick<CalendarData, 'sessions' | 'registeredEvents' | 'openEvents'>,
  now: Date,
): Map<string, CalendarItem[]> {
  const out = new Map<string, CalendarItem[]>();
  const add = (day: string, item: CalendarItem) => {
    const list = out.get(day);
    if (list) list.push(item);
    else out.set(day, [item]);
  };
  const withSessions = new Set(data.sessions.map((s) => s.eventId));
  const bands = (events: CalendarEvent[], kind: 'open' | 'registered') => {
    for (const e of events) {
      if (withSessions.has(e.id)) continue;
      for (const day of eventDays(e)) {
        add(day, {
          kind,
          id: e.id,
          eventId: e.id,
          title: e.name,
          time: null,
          eventName: '',
          bucket: kind,
        });
      }
    }
  };
  bands(data.registeredEvents, 'registered');
  // Abierto Y con plaza no puede ser (el servidor quita los que tienen plaza).
  bands(data.openEvents, 'open');
  for (const s of data.sessions) {
    add(madridDay(new Date(s.startsAt)), {
      kind: 'session',
      id: s.id,
      eventId: s.eventId,
      title: sessionTitle(s.name),
      time: isAllDaySession(s) ? null : madridTime(s.startsAt),
      eventName: s.eventName,
      bucket: sessionBucket(s, now),
    });
  }
  for (const list of out.values()) {
    list.sort(
      (a, b) =>
        (a.time ?? '').localeCompare(b.time ?? '') ||
        a.title.localeCompare(b.title, 'es'),
    );
  }
  return out;
}

/** Hasta cuatro puntitos por día (C6). */
export const MAX_DAY_DOTS = 4;
export const dayDots = (items: readonly CalendarItem[]): CalendarBucket[] =>
  items.slice(0, MAX_DAY_DOTS).map((i) => i.bucket);

/** «17:30 · Catequesis COM · Asististe» o «Todo el día · Con plaza». */
export function itemLine(item: CalendarItem): string {
  return [item.time ?? 'Todo el día', item.eventName, BUCKET_LABEL[item.bucket]]
    .filter(Boolean)
    .join(' · ');
}

/** Al cambiar de mes: hoy si cae dentro; si no, el día 1. `month` = `YYYY-MM`. */
export const dayForMonth = (month: string, today: string): string =>
  today.startsWith(`${month}-`) ? today : `${month}-01`;

/** `YYYY-MM` sumando meses. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** «Octubre 2025». */
export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** «Martes, 14 de octubre». */
export function dayTitle(day: string): string {
  const s = longDay(day, true);
  const space = s.indexOf(' ');
  return `${s.slice(0, space)},${s.slice(space)}`;
}

/** Lo que oye el lector en cada día: «14 de octubre, 2 actividades». */
export function dayA11y(day: string, count: number): string {
  const s = longDay(day);
  const date = s.slice(s.indexOf(' ') + 1);
  const n =
    count === 0
      ? 'sin actividades'
      : count === 1
        ? '1 actividad'
        : `${count} actividades`;
  return `${date}, ${n}`;
}

/** Los días de un mes con algo, en orden (la Agenda). */
export function agendaDays(
  byDay: Map<string, CalendarItem[]>,
  month: string,
): string[] {
  return [...byDay.keys()].filter((d) => d.startsWith(`${month}-`)).sort();
}
