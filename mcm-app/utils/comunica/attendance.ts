// utils/comunica/attendance.ts
//
// La asistencia de un chaval en su ficha (plan 05, regla 19), sin React. Es
// `sticpa_pl_att_track` y `sticpa_pl_absence_streak` del plugin:
//
//   · Solo cuentan las sesiones YA EMPEZADAS (nada del futuro).
//   · El denominador son las sesiones MARCADAS: un sábado sin lista no es una
//     falta suya, es un dato que no existe. Se cuenta aparte («N sábados sin
//     lista»). Sin ninguna marcada, «Sin datos» (`pct: null`), nunca 0 %.
//   · Las horas siguen la misma regla: «X h de Y h» de las marcadas.
//   · «Parcial» cuenta como asistencia.
//   · La racha va hacia atrás desde la última celebrada; un hueco sin marcar
//     la CORTA (no se acusa a nadie por un hueco en los datos), y un «vino»
//     también.
//   · Los eventos del curso van en la misma fila, en su fecha y redondos, pero
//     FUERA del porcentaje, y sin los que aún no han sido o no van.

import type {
  Mark,
  PersonEvent,
  SessionSummary,
  SetMark,
} from '@/services/comunica/contract';
import { isAbsence, isAttendance } from './marks';
import { madridDay } from './madrid';

export interface AttendanceSquare {
  kind: 'session';
  id: string;
  date: string;
  mark: Mark;
  reason?: string;
}

export interface EventSquare {
  kind: 'event';
  id: string;
  date: string;
  endDate: string;
  name: string;
  status: PersonEvent['status'];
  reason?: string;
}

export type TimelineSquare = AttendanceSquare | EventSquare;

export interface AttendanceTrack {
  squares: AttendanceSquare[];
  attended: number;
  missed: number;
  /** Celebradas sin marcar. */
  unknown: number;
  counted: number;
  /** 0-100, o `null` si no hay ninguna marcada («Sin datos»). */
  pct: number | null;
  hours: number;
  hoursTotal: number;
}

const started = (s: SessionSummary, now: Date) =>
  new Date(s.startsAt).getTime() <= now.getTime();

const hoursOf = (s: SessionSummary) =>
  Math.max(
    0,
    (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3_600_000,
  );

const round1 = (n: number) => Math.round(n * 10) / 10;

export function attendanceTrack(
  sessions: readonly SessionSummary[],
  marks: Readonly<Record<string, Mark>>,
  now: Date,
  reasons: Readonly<Record<string, string>> = {},
): AttendanceTrack {
  const elapsed = sessions
    .filter((s) => started(s, now))
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  let attended = 0;
  let missed = 0;
  let unknown = 0;
  let hours = 0;
  let hoursTotal = 0;
  const squares = elapsed.map((s): AttendanceSquare => {
    const mark = marks[s.id] ?? null;
    if (mark === null) unknown += 1;
    else {
      hoursTotal += hoursOf(s);
      if (isAttendance(mark)) {
        attended += 1;
        hours += hoursOf(s);
      } else missed += 1;
    }
    const reason = mark !== null ? reasons[s.id] : undefined;
    return {
      kind: 'session',
      id: s.id,
      date: s.date,
      mark,
      ...(reason ? { reason } : {}),
    };
  });
  const counted = attended + missed;
  return {
    squares,
    attended,
    missed,
    unknown,
    counted,
    pct: counted > 0 ? Math.round((attended / counted) * 100) : null,
    hours: round1(hours),
    hoursTotal: round1(hoursTotal),
  };
}

/** Ausencias seguidas desde la última celebrada; un hueco o un «vino» cortan. */
export function streakOf(track: Pick<AttendanceTrack, 'squares'>): number {
  let n = 0;
  for (let i = track.squares.length - 1; i >= 0; i--) {
    const m = track.squares[i].mark;
    if (m === null || !isAbsence(m)) break;
    n += 1;
  }
  return n;
}

/** Desde cuántas seguidas se dice (`sticpa_pl_streak_threshold`). */
export const STREAK_THRESHOLD = 3;

/** Los eventos que van en la fila: los ya empezados y a los que va. */
export function eventSquares(
  events: readonly PersonEvent[],
  now: Date,
): EventSquare[] {
  const today = madridDay(now);
  return events
    .filter((e) => e.status !== 'registered' && e.status !== 'cancelled')
    .filter((e) => madridDay(new Date(e.startsAt)) <= today)
    .map((e) => ({
      kind: 'event' as const,
      id: e.eventId,
      date: madridDay(new Date(e.startsAt)),
      endDate: madridDay(new Date(e.endsAt)),
      name: e.name,
      status: e.status,
      ...(e.reason ? { reason: e.reason } : {}),
    }));
}

/** Sesiones y eventos, por fecha. */
export function timeline(
  sessions: readonly AttendanceSquare[],
  events: readonly EventSquare[],
): TimelineSquare[] {
  return [...sessions, ...events].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? -1 : 1,
  );
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** Los cuadraditos agrupados por mes, con el mes escrito («oct»). */
export function byMonth(
  squares: readonly TimelineSquare[],
): { month: string; label: string; squares: TimelineSquare[] }[] {
  const out: { month: string; label: string; squares: TimelineSquare[] }[] = [];
  for (const sq of squares) {
    const month = sq.date.slice(0, 7);
    let row = out[out.length - 1];
    if (!row || row.month !== month) {
      row = {
        month,
        label: MONTHS[parseInt(month.slice(5, 7), 10) - 1],
        squares: [],
      };
      out.push(row);
    }
    row.squares.push(sq);
  }
  return out;
}

/** «4,5» sin «,0» y con la coma del idioma. */
export const formatHours = (h: number) =>
  String(round1(h)).replace(/\.0$/, '').replace('.', ',');

/** Lo que dice cada estado de evento. */
export const EVENT_STATUS_LABEL: Record<
  Exclude<PersonEvent['status'], SetMark>,
  string
> = {
  no_roll: 'Sin lista',
  registered: 'Apuntado/a',
  cancelled: 'No va',
};
