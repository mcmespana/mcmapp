// utils/comunica/meetings.ts
//
// Las REUNIONES DE PROGRAMACIÓN (plan 06, reglas 8 y 9;
// `single_stic_pasar_lista_reuniones.php` y `sticpa_pl_reunion_pendiente`
// del plugin), sin React.
//
//   · Su estado, con el idioma del historial de un grupo: ✓ «11 vinieron · 3
//     faltas», «sin pasar», «sin registro» o «todavía no ha llegado».
//   · La reunión SIN PASAR solo es la última celebrada, sin lista y durante 30
//     días: una suspendida dejaría el ámbar puesto hasta la siguiente.
//   · El nombre manda; debajo, fecha · duración.

import type {
  Meeting,
  MeetingWrite,
  SessionSummary,
} from '@/services/comunica/contract';
import {
  MEETING_DURATIONS,
  MEETING_NAME_MAX,
} from '@/services/comunica/contract';
import { shortDayMonth } from './dates';
import { daysBetween, madridDay, madridTime } from './madrid';

export type MeetingState = 'taken' | 'skipped' | 'missing' | 'future';

const started = (s: Pick<SessionSummary, 'startsAt'>, now: Date) =>
  new Date(s.startsAt).getTime() <= now.getTime();

export function meetingState(
  m: Pick<Meeting, 'session' | 'rollCall'>,
  now: Date,
): MeetingState {
  if (m.rollCall) return m.rollCall.status === 'taken' ? 'taken' : 'skipped';
  return started(m.session, now) ? 'missing' : 'future';
}

/** Lo que dice la línea de debajo según su estado. */
export function meetingStateText(
  m: Pick<Meeting, 'session' | 'rollCall'>,
  now: Date,
): string {
  switch (meetingState(m, now)) {
    case 'taken':
      return `${m.rollCall!.counts.came} vinieron · ${m.rollCall!.counts.missed} faltas`;
    case 'skipped':
      return 'sin registro';
    case 'missing':
      return 'sin pasar';
    default:
      return 'todavía no ha llegado';
  }
}

/** «1,5 h». */
export const durationText = (h: number) =>
  `${String(Math.round(h * 10) / 10).replace('.', ',')}\u00a0h`;

/** «mar 20 oct · 20:00». */
export const meetingWhen = (s: Pick<SessionSummary, 'date' | 'startsAt'>) =>
  `${shortDayMonth(s.date)} · ${madridTime(s.startsAt)}`;

/** La línea de debajo del nombre: fecha · duración · estado. */
export function meetingMeta(m: Meeting, now: Date): string {
  return [
    meetingWhen(m.session),
    m.durationHours ? durationText(m.durationHours) : null,
    meetingStateText(m, now),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Días que dura el aviso de una reunión sin lista. */
export const PENDING_MEETING_DAYS = 30;

/**
 * La reunión sin pasar: la ÚLTIMA celebrada, sin lista y de hace 30 días o
 * menos. Si hay una posterior con lista, o es más vieja, nada.
 */
export function pendingMeeting<M extends Pick<Meeting, 'session' | 'rollCall'>>(
  meetings: readonly M[],
  now: Date,
): M | null {
  const held = meetings
    .filter((m) => started(m.session, now))
    .sort((a, b) => (a.session.startsAt < b.session.startsAt ? 1 : -1));
  const last = held[0];
  if (!last || last.rollCall) return null;
  if (daysBetween(last.session.date, madridDay(now)) > PENDING_MEETING_DAYS)
    return null;
  return last;
}

export const MEETING_NAME_PLACEHOLDER = 'Programación del 2.º trimestre';
export const DEFAULT_START = '19:00';
export const DEFAULT_DURATION = 1.5;

export type MeetingDraft = Omit<MeetingWrite, 'clientId'>;

/** Lo que falta para poder crearla, o `null` si está bien. */
export function meetingDraftError(d: {
  name: string;
  date: string;
  startTime: string;
  durationHours: number;
}): string | null {
  if (!d.name.trim()) return 'Ponle un nombre.';
  if (d.name.trim().length > MEETING_NAME_MAX) return 'El nombre es muy largo.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'Elige el día.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime))
    return 'La hora va como 19:00.';
  if (!(MEETING_DURATIONS as readonly number[]).includes(d.durationHours))
    return 'Elige cuánto dura.';
  return null;
}
