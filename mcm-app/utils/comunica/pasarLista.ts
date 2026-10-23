// utils/comunica/pasarLista.ts
//
// Reglas de la portada de Pasar Lista, sin React (plan 04 «Comportamiento»;
// `PASAR-LISTA.md` §6.1 del plugin). Todo en días y horas de Madrid.

import type {
  GroupsResponse,
  GroupWithMonitors,
  RollCallSummary,
  SessionSummary,
  Stage,
  Segment,
} from '@/services/comunica/contract';
import { daysBetween, madridDay } from './madrid';

export type SessionNotice =
  | { kind: 'not_started'; startsAt: string }
  | { kind: 'days_ago'; days: number }
  | { kind: 'next'; date: string }
  | null;

export interface Proposal {
  session: SessionSummary;
  notice: SessionNotice;
}

/**
 * Qué sesión se propone para pasar lista:
 *   · hoy hay → la de hoy (si no ha empezado, se avisa pero no se bloquea);
 *   · hoy no hay → la última empezada, sin límite («es la de hace N días»);
 *   · no ha empezado ninguna → la próxima («la próxima es el sábado 22…»).
 * Dos el mismo día: la primera.
 */
export function proposeSession(
  sessions: readonly SessionSummary[],
  now: Date,
): Proposal | null {
  if (sessions.length === 0) return null;
  const today = madridDay(now);
  const sorted = [...sessions].sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0,
  );
  const todays = sorted.find((s) => s.date === today);
  if (todays) {
    const started = new Date(todays.startsAt).getTime() <= now.getTime();
    return {
      session: todays,
      notice: started
        ? null
        : { kind: 'not_started', startsAt: todays.startsAt },
    };
  }
  const past = sorted.filter((s) => s.date < today);
  if (past.length > 0) {
    const last = past[past.length - 1];
    return {
      session: last,
      notice: { kind: 'days_ago', days: daysBetween(last.date, today) },
    };
  }
  const next = sorted[0];
  return { session: next, notice: { kind: 'next', date: next.date } };
}

/** Las sesiones del evento semanal de la etapa de un grupo. */
export function sessionsForGroup(
  group: Pick<GroupWithMonitors, 'stage'>,
  stageEvents: GroupsResponse['stageEvents'],
): SessionSummary[] {
  if (!group.stage) return [];
  return stageEvents.find((e) => e.stage === group.stage)?.sessions ?? [];
}

export const rollKey = (sessionId: string, groupId: string) =>
  `${sessionId}:${groupId}`;

export function rollIndex(rollCalls: readonly RollCallSummary[]) {
  const map = new Map<string, RollCallSummary>();
  for (const r of rollCalls) {
    if (r.groupId) map.set(rollKey(r.sessionId, r.groupId), r);
  }
  return map;
}

export interface MissingRoll {
  group: GroupWithMonitors;
  session: SessionSummary;
}

/** Cuántas sesiones celebradas hacia atrás se miran para «lo que falta». */
export const MISSING_LOOKBACK = 4;

/**
 * «Te faltan N listas»: de todos tus grupos, la sesión propuesta sin lista y
 * las anteriores sin lista de las cuatro últimas celebradas, la más reciente
 * arriba. Lo que ya está en la cola del móvil no falta (`queued`); el atajo se
 * quita fuera (`exclude`).
 */
export function missingRolls({
  groups,
  stageEvents,
  rollCalls,
  now,
  queued = new Set<string>(),
  exclude,
}: {
  groups: readonly GroupWithMonitors[];
  stageEvents: GroupsResponse['stageEvents'];
  rollCalls: readonly RollCallSummary[];
  now: Date;
  queued?: ReadonlySet<string>;
  exclude?: string;
}): MissingRoll[] {
  const index = rollIndex(rollCalls);
  const today = madridDay(now);
  const out: MissingRoll[] = [];
  for (const group of groups) {
    if (group.counts.participants === 0) continue;
    const held = sessionsForGroup(group, stageEvents)
      .filter(
        (s) =>
          s.date < today ||
          (s.date === today && new Date(s.startsAt).getTime() <= now.getTime()),
      )
      .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1))
      .slice(0, MISSING_LOOKBACK);
    for (const session of held) {
      const key = rollKey(session.id, group.id);
      if (index.has(key) || queued.has(key) || key === exclude) continue;
      out.push({ group, session });
    }
  }
  return out.sort((a, b) => (a.session.startsAt < b.session.startsAt ? 1 : -1));
}

/** Las filas de «Pasar lista de otro grupo», en el orden del plugin. */
export type StageBucket = {
  key: string;
  label: string;
  stage: Stage | null;
  segment?: Segment | 'none';
  participants: number;
  groups: number;
};

const BUCKETS: Omit<StageBucket, 'participants' | 'groups'>[] = [
  { key: 'mic', label: 'MIC', stage: 'mic' },
  { key: 'com_1', label: 'COM I', stage: 'com', segment: 'com_1' },
  { key: 'com_2', label: 'COM II', stage: 'com', segment: 'com_2' },
  { key: 'com_3', label: 'COM III', stage: 'com', segment: 'com_3' },
  { key: 'com', label: 'COM', stage: 'com', segment: 'none' },
  { key: 'lc', label: 'LC', stage: 'lc' },
  { key: 'apoyo', label: 'Apoyo', stage: 'apoyo' },
  { key: 'none', label: 'Sin etapa', stage: null },
];

export function stageBuckets(
  groups: readonly GroupWithMonitors[],
): StageBucket[] {
  return BUCKETS.map((b) => {
    const mine = groups.filter((g) => {
      if (g.stage !== b.stage) return false;
      if (b.stage !== 'com') return true;
      return b.segment === 'none' ? !g.segment : g.segment === b.segment;
    });
    return {
      ...b,
      groups: mine.length,
      participants: mine.reduce((n, g) => n + g.counts.participants, 0),
    };
  }).filter((b) => b.groups > 0);
}

/**
 * Orden natural de los códigos: M4.2 antes que M4.10; sin código, por nombre.
 */
export function compareGroups(
  a: Pick<GroupWithMonitors, 'code' | 'name'>,
  b: Pick<GroupWithMonitors, 'code' | 'name'>,
): number {
  if (a.code && !b.code) return -1;
  if (!a.code && b.code) return 1;
  const ka = a.code ?? a.name;
  const kb = b.code ?? b.name;
  return ka.localeCompare(kb, 'es', { numeric: true, sensitivity: 'base' });
}
