// utils/comunica/calendar.ts
//
// El calendario (plan 16, `stic-calendar.php`), lógica pura: el color de una sesión, las bandas de los eventos, los puntitos de cada día, la lista del día, la
// agenda y el mes. Sin React, sin hex: los colores salen de los tonos de `theme.ts`.
//
//   C4. Una sesión que empieza DESPUÉS de ahora es «Próxima», tenga la marca que tenga; si no, `yes` «Asististe», `no_unjustified` «No asististe», sin marca
//       «Sin registrar»; `partial` y `no_justified` se juntan con esos dos (`JOIN_PARTIAL_AND_JUSTIFIED`; es una constante por si se cambia).
//   C5. Bandas de día completo: «Con plaza» y «Abierto a inscripción», SALVO si el evento ya aporta sesiones. Un evento de varios días marca TODOS sus días.
//   C6. Mes desde el lunes, sin semanas de relleno ni días de otros meses; hasta 4 puntitos por día.

import type {
  CalendarData,
  CalendarEvent,
  CalendarSession,
} from '@/services/comunica/contract';
import { fullDay } from './dates';
import { addDays, daysBetween, madridDay, madridTime, weekday } from './madrid';

/** «Parcial» y «justificada» se juntan con «Asististe» y «No asististe» (decisión `calendario-marcas`: como el plugin). */
export const JOIN_PARTIAL_AND_JUSTIFIED = true;

export type SessionState = 'upcoming' | 'attended' | 'missed' | 'unmarked';
export type Tone = 'info' | 'positive' | 'negative' | 'neutral' | 'accent';

export const STATE_LABEL: Record<SessionState, string> = {
  upcoming: 'Próxima',
  attended: 'Asististe',
  missed: 'No asististe',
  unmarked: 'Sin registrar',
};
export const STATE_TONE: Record<SessionState, Tone> = {
  upcoming: 'info',
  attended: 'positive',
  missed: 'negative',
  unmarked: 'neutral',
};

/** `nowMs` es el instante de ahora. */
export function sessionState(
  s: Pick<CalendarSession, 'startsAt' | 'attendance'>,
  nowMs: number,
): SessionState {
  if (new Date(s.startsAt).getTime() > nowMs) return 'upcoming';
  switch (s.attendance) {
    case 'yes':
      return 'attended';
    case 'no_unjustified':
      return 'missed';
    case 'partial':
      return JOIN_PARTIAL_AND_JUSTIFIED ? 'attended' : 'unmarked';
    case 'no_justified':
      return JOIN_PARTIAL_AND_JUSTIFIED ? 'missed' : 'unmarked';
    default:
      return 'unmarked';
  }
}

/** «17:30 – 19:00»; si no tiene fin o cruza la medianoche, solo el inicio. */
export function timeRange(
  s: Pick<CalendarSession, 'startsAt' | 'endsAt'>,
): string {
  const start = madridTime(s.startsAt);
  if (!s.endsAt) return start;
  if (madridDay(new Date(s.endsAt)) !== madridDay(new Date(s.startsAt)))
    return start;
  return `${start} – ${madridTime(s.endsAt)}`;
}

/** Todos los días de un evento (el último, el de fin; sin fin, solo el de inicio). Con tope, por si un dato viene mal. */
export function eventDays(
  e: Pick<CalendarEvent, 'startDate' | 'endDate'>,
  cap = 400,
): string[] {
  const end = e.endDate && e.endDate > e.startDate ? e.endDate : e.startDate;
  const n = Math.min(daysBetween(e.startDate, end), cap);
  return Array.from({ length: n + 1 }, (_, i) => addDays(e.startDate, i));
}

// ── Lo que hay cada día ─────────────────────────────────────────────────────

export type DayItem =
  | {
      kind: 'session';
      id: string;
      name: string;
      eventId: string;
      eventName: string;
      time: string;
      state: SessionState;
      sortKey: string;
    }
  | {
      kind: 'registered' | 'open';
      id: string;
      name: string;
      eventId: string;
      eventName: string;
      time: null;
      state: null;
      sortKey: string;
    };

/** Las cosas de cada día: sesiones y bandas. Las bandas de un evento que ya aporta sesiones se quitan (C5). */
export function dayItems(
  data: Pick<CalendarData, 'sessions' | 'registeredEvents' | 'openEvents'>,
  nowMs: number,
): Map<string, DayItem[]> {
  const out = new Map<string, DayItem[]>();
  const push = (day: string, item: DayItem) => {
    const list = out.get(day) ?? [];
    list.push(item);
    out.set(day, list);
  };
  const withSessions = new Set(data.sessions.map((s) => s.eventId));
  for (const s of data.sessions)
    push(madridDay(new Date(s.startsAt)), {
      kind: 'session',
      id: s.id,
      name: s.name,
      eventId: s.eventId,
      eventName: s.eventName,
      time: timeRange(s),
      state: sessionState(s, nowMs),
      sortKey: `1${madridTime(s.startsAt)}`,
    });
  const bands = (
    events: readonly CalendarEvent[],
    kind: 'registered' | 'open',
  ) => {
    for (const e of events) {
      if (withSessions.has(e.id)) continue;
      for (const day of eventDays(e))
        push(day, {
          kind,
          id: e.id,
          name: e.name,
          eventId: e.id,
          eventName: e.name,
          time: null,
          state: null,
          // El día completo, antes que las horas.
          sortKey: `0${kind === 'registered' ? 0 : 1}`,
        });
    }
  };
  bands(data.registeredEvents, 'registered');
  bands(data.openEvents, 'open');
  for (const list of out.values())
    list.sort((a, b) =>
      a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0,
    );
  return out;
}

export const MAX_DOTS = 4;

/** El color de un puntito o de una banda. */
export function itemTone(i: Pick<DayItem, 'kind' | 'state'>): Tone {
  if (i.kind === 'session') return STATE_TONE[i.state as SessionState];
  return i.kind === 'registered' ? 'positive' : 'accent';
}

/** Hasta 4 puntitos por día, cada uno con el color de lo que hay. */
export const dotsOf = (items: readonly DayItem[]): Tone[] =>
  items.slice(0, MAX_DOTS).map(itemTone);

/** «Todo el día · Convivencia · Con plaza» o «17:30 · Curso · Asististe». */
export function itemLine(i: DayItem): string {
  const what =
    i.kind === 'session'
      ? STATE_LABEL[i.state]
      : i.kind === 'registered'
        ? 'Con plaza'
        : 'Abierto a inscripción';
  return `${i.time ?? 'Todo el día'} · ${i.eventName} · ${what}`;
}

/** «14 de octubre, 2 actividades» para el lector de pantalla. */
export function dayLabel(day: string, count: number): string {
  const [, m, d] = day.split('-').map(Number);
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const n =
    count === 0
      ? 'sin actividades'
      : count === 1
        ? '1 actividad'
        : `${count} actividades`;
  return `${d} de ${months[m - 1]}, ${n}`;
}

// ── El mes ──────────────────────────────────────────────────────────────────

const MONTHS = [
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
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/** `month` = `YYYY-MM`. «Octubre 2025». */
export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** «Martes, 14 de octubre». */
export function dayTitle(day: string): string {
  const w = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ][weekday(day)];
  const [, m, d] = day.split('-').map(Number);
  return `${w}, ${d} de ${MONTHS[m - 1].toLowerCase()}`;
}

export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/** Las semanas del mes desde el lunes, solo con los días del mes (el resto, `null`) y sin semanas de relleno. */
export function monthWeeks(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (weekday(first) + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from(
      { length: days },
      (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
    ),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
}

/** Al cambiar de mes se elige hoy si cae dentro; si no, el día 1. */
export const dayOnMonthChange = (month: string, today: string): string =>
  today.startsWith(`${month}-`) ? today : `${month}-01`;

/** Las leyendas bajo la rejilla, sin frase. */
export const LEGEND: { key: string; label: string; tone: Tone }[] = [
  { key: 'upcoming', label: 'Próxima', tone: 'info' },
  { key: 'attended', label: 'Asististe', tone: 'positive' },
  { key: 'missed', label: 'No asististe', tone: 'negative' },
  { key: 'unmarked', label: 'Sin registrar', tone: 'neutral' },
  { key: 'open', label: 'Abierto a inscripción', tone: 'accent' },
  { key: 'registered', label: 'Con plaza', tone: 'positive' },
];

// ── La agenda ───────────────────────────────────────────────────────────────

/** El mes por días, en orden; los días sin nada no salen. */
export function agendaOfMonth(
  items: Map<string, DayItem[]>,
  month: string,
): { day: string; items: DayItem[] }[] {
  return [...items.entries()]
    .filter(([day]) => day.startsWith(`${month}-`))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, list]) => ({ day, items: list }));
}

export interface AgendaItem {
  kind: 'open' | 'session';
  id: string;
  eventId: string;
  title: string;
  /** `YYYY-MM-DD` del inicio. */
  day: string;
  line: string;
}

/** Para la portada de familias: primero los abiertos a inscripción (los más cercanos) y luego las próximas sesiones; `n` como mucho. */
export function upcomingAgendaItems(
  data: Pick<CalendarData, 'sessions' | 'openEvents'>,
  today: string,
  n: number,
  nowMs: number,
): AgendaItem[] {
  const open: AgendaItem[] = data.openEvents
    .filter((e) => (e.endDate ?? e.startDate) >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
    .map((e) => ({
      kind: 'open' as const,
      id: e.id,
      eventId: e.id,
      title: e.name,
      day: e.startDate,
      line: `${fullDay(e.startDate)} · Abierto a inscripción`,
    }));
  const sessions: AgendaItem[] = data.sessions
    .filter((s) => new Date(s.startsAt).getTime() > nowMs)
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
    .map((s) => ({
      kind: 'session' as const,
      id: s.id,
      eventId: s.eventId,
      title: s.name,
      day: madridDay(new Date(s.startsAt)),
      line: `${fullDay(madridDay(new Date(s.startsAt)))} · ${timeRange(s)}`,
    }));
  return [...open, ...sessions].slice(0, n);
}

export const CALENDAR_TEXT = {
  title: 'Calendario',
  month: 'Mes',
  agenda: 'Agenda',
  nothingToday: 'No hay actividades este día',
  nothingMonth: 'No hay actividades en estas fechas',
  unavailable: 'Esta sesión ya no está disponible',
} as const;
