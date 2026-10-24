// utils/comunica/sessions.ts
//
// Sesiones de un grupo para la pantalla de marcar (plan 04): si es del
// futuro, el selector de fecha y el historial. Sin React.

import type {
  RollCallSummary,
  SessionSummary,
} from '@/services/comunica/contract';
import { capsule } from './dates';
import { madridDay } from './madrid';

/** Del futuro = un día posterior al de hoy EN MADRID (hoy sí se marca). */
export const isFutureSession = (s: Pick<SessionSummary, 'date'>, now: Date) =>
  s.date > madridDay(now);

/** ¿Ha empezado ya? (hoy antes de la hora, todavía no). */
export const hasStarted = (s: Pick<SessionSummary, 'startsAt'>, now: Date) =>
  new Date(s.startsAt).getTime() <= now.getTime();

/** «15 nov». */
export function shortDate(day: string): string {
  const c = capsule(day);
  return `${c.day} ${c.month.toLowerCase()}`;
}

export type RollState = 'taken' | 'skipped' | 'missing';

export const ROLL_STATE_LABEL: Record<RollState, string> = {
  taken: 'pasada',
  skipped: 'sin registro',
  missing: 'falta',
};

export interface SessionOption {
  session: SessionSummary;
  /** Su posición en el curso (la 1.ª, la 2.ª…). */
  number: number;
  label: string;
  state: RollState;
  roll: RollCallSummary | null;
}

/**
 * Las sesiones para el selector de fecha y el historial: las celebradas (y la
 * de hoy aunque no haya empezado), la más reciente arriba. Sin futuras.
 */
export function sessionOptions(
  sessions: readonly SessionSummary[],
  rolls: ReadonlyMap<string, RollCallSummary>,
  now: Date,
): SessionOption[] {
  const sorted = [...sessions].sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : 1,
  );
  return sorted
    .map((session, i) => {
      const roll = rolls.get(session.id) ?? null;
      const state: RollState = roll ? roll.status : 'missing';
      return {
        session,
        number: i + 1,
        label: `${i + 1} · ${shortDate(session.date)}`,
        state,
        roll,
      };
    })
    .filter((o) => !isFutureSession(o.session, now))
    .reverse();
}

/** La última celebrada (para el círculo de cada grupo en el árbol). */
export function lastHeld(
  sessions: readonly SessionSummary[],
  now: Date,
): SessionSummary | null {
  const held = sessions
    .filter((s) => hasStarted(s, now))
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
  return held[0] ?? null;
}
