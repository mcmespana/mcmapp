// services/comunica/fake/index.ts
//
// Servidor falso del área nativa (plan 00 §4): implementa `ComunicaApi` en
// memoria, con los datos inventados de `fixtures.ts`. Con él se construye y se
// prueba toda la app sin servidor; el día que exista `mcm-comunica-api` se
// cambia `EXPO_PUBLIC_COMUNICA_API` y nada más.
//
// Se porta como el de verdad en lo que importa a las pantallas:
//   · Responde con los MISMOS esquemas zod que valida el cliente (si el falso
//     devolviera algo que el contrato no admite, revienta aquí, no en una
//     pantalla).
//   · Aplica la autorización por delegación: lo de otra delegación es
//     `forbidden`, también si no existe (nunca un 404 que lo confirme).
//   · Aplica los rechazos de Pasar Lista, `notSaved`, «no reescribir lo que no
//     cambia» e idempotencia por `clientId`, y cuenta las escrituras.
//   · Tiene MANDOS (latencia, sin conexión, CRM caído, error en una ruta,
//     reloj, persona con la que se entra…) para ver cada estado de pantalla.
//
// Solo lo importa `services/comunica/` (lo vigila un test).

import {
  GroupsResponse,
  HealthNote,
  MeResponse,
  type Mark,
  RollDetail,
  RollWrite,
  RollWriteResult,
  type RouteName,
  TodayResponse,
  type RollCallSummary,
  type Role,
  type Me,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import {
  generateFakeData,
  markOf,
  type FakeData,
  type FakeRoll,
  type FakeSession,
  type PersonaId,
} from './fixtures';
import { madridDay } from '@/utils/comunica/madrid';

export interface FakeControls {
  /** Espera de cada respuesta, en ms. */
  latencyMs: number;
  /** Todo falla como si no hubiera red. */
  offline: boolean;
  /** Las escrituras devuelven `crm_unavailable` (las lecturas siguen). */
  crmDown: boolean;
  /** Esta ruta falla con `crm_unavailable`. */
  failRoute: RouteName | null;
  /** Con quién se «entra». */
  persona: PersonaId;
  /** Hora del servidor (ISO). `null` = la de verdad. */
  clock: string | null;
  /** El falso no sabe inscribir a quien no está inscrito. */
  cannotRegister: boolean;
}

export const DEFAULT_CONTROLS: FakeControls = {
  latencyMs: 300,
  offline: false,
  crmDown: false,
  failRoute: null,
  persona: 'monitor',
  clock: null,
  cannotRegister: false,
};

const PERSONA_ROLES: Record<PersonaId, { roles: Role[]; scope: Me['scope'] }> =
  {
    monitor: { roles: ['monitor'], scope: 'delegation' },
    coordination: { roles: ['monitor', 'coordination'], scope: 'delegation' },
    accompaniment: { roles: ['accompaniment'], scope: { segments: ['com_1'] } },
    other: { roles: ['monitor'], scope: 'delegation' },
  };

export interface FakeServer extends ComunicaApi {
  controls: FakeControls;
  setControls(patch: Partial<FakeControls>): void;
  subscribe(listener: () => void): () => void;
  /** Escrituras que habrían llegado al CRM (para comprobar «no reescribir»). */
  readonly writeCount: number;
  /** Vuelve a los datos de partida y a los mandos por defecto. */
  reset(): void;
  /** Los datos en bruto, para los tests. */
  readonly data: FakeData;
}

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

export function createFakeServer(
  initial: Partial<FakeControls> = {},
): FakeServer {
  let data = generateFakeData();
  let controls: FakeControls = { ...DEFAULT_CONTROLS, ...initial };
  let writeCount = 0;
  const seenClientIds = new Map<string, unknown>();
  const listeners = new Set<() => void>();

  const now = () => (controls.clock ? new Date(controls.clock) : new Date());
  const nowIso = () =>
    now()
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
  const today = () => madridDay(now());

  async function gate(route: RouteName, write = false) {
    if (controls.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, controls.latencyMs));
    }
    if (controls.offline) {
      throw new ComunicaApiError('network', 'Sin conexión con el servidor');
    }
    if (controls.failRoute === route || (write && controls.crmDown)) {
      throw new ComunicaApiError('crm_unavailable', 'El CRM no responde', 503);
    }
  }

  const persona = () => data.personas[controls.persona];
  const me = () => data.people.find((p) => p.id === persona().personId)!;
  const delegationId = () => me().delegationId;
  const person = (id: string) => data.people.find((p) => p.id === id);

  /** Un grupo de MI delegación, o `forbidden`. */
  const myGroup = (gid: string) => {
    const g = data.groups.find((x) => x.id === gid);
    if (!g || g.delegationId !== delegationId()) throw forbidden();
    return g;
  };
  const mySession = (sid: string) => {
    const s = data.sessions.find((x) => x.id === sid);
    if (!s || s.delegationId !== delegationId()) throw forbidden();
    return s;
  };
  const rollOf = (sid: string, gid: string) =>
    data.rolls.find((r) => r.sessionId === sid && r.groupId === gid);

  const summary = (r: FakeRoll): RollCallSummary => {
    const marks = Object.values(r.marks);
    return {
      sessionId: r.sessionId,
      groupId: r.groupId,
      status: r.status,
      takenAt: r.takenAt,
      counts: {
        came: marks.filter((m) => m === 'yes' || m === 'partial').length,
        missed: marks.filter(
          (m) => m === 'no_justified' || m === 'no_unjustified',
        ).length,
      },
    };
  };

  const sessionSummary = (s: FakeSession) => ({
    id: s.id,
    eventId: s.eventId,
    date: s.date,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    kind: s.kind,
  });

  const nameOf = (id: string) => {
    const p = person(id)!;
    return `${p.firstName} ${p.lastName}`;
  };

  function buildRoll(sid: string, gid: string) {
    const g = myGroup(gid);
    const s = mySession(sid);
    const roll = rollOf(sid, gid);
    // Las tres sesiones del mismo evento celebradas ANTES, la última primero.
    const previous = data.sessions
      .filter((x) => x.eventId === s.eventId && x.date < s.date)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3);
    const entries = g.participantIds
      .map((pid) => person(pid)!)
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'))
      .map((p) => ({
        person: {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          schoolLevel: p.schoolLevel,
          badges: { ...p.badges },
        },
        mark: markOf(roll, p.id),
        note: roll?.notes[p.id] ?? '',
        previousMarks: previous.map((x): Mark => {
          const r = rollOf(x.id, gid);
          return r?.status === 'taken' ? markOf(r, p.id) : null;
        }),
      }));
    return RollDetail.parse({
      generatedAt: nowIso(),
      session: sessionSummary(s),
      groupId: g.id,
      roll: roll ? summary(roll) : null,
      monitors: g.monitorIds.map((id) => {
        const m = person(id)!;
        return { id, firstName: m.firstName, lastName: m.lastName };
      }),
      entries,
    });
  }

  const notify = () => listeners.forEach((l) => l());

  const server: FakeServer = {
    get controls() {
      return controls;
    },
    get writeCount() {
      return writeCount;
    },
    get data() {
      return data;
    },
    setControls(patch) {
      controls = { ...controls, ...patch };
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      data = generateFakeData();
      controls = { ...DEFAULT_CONTROLS };
      writeCount = 0;
      seenClientIds.clear();
      notify();
    },

    async getMe() {
      await gate('me');
      const p = me();
      const delegation = data.delegations.find((d) => d.id === p.delegationId)!;
      const { roles, scope } = PERSONA_ROLES[controls.persona];
      return MeResponse.parse({
        generatedAt: nowIso(),
        me: {
          personId: p.id,
          name: `${p.firstName} ${p.lastName}`,
          delegation,
          roles,
          scope,
          canSeeHealth: true,
        },
      });
    },

    async getGroups() {
      await gate('groups');
      const did = delegationId();
      const groups = data.groups.filter((g) => g.delegationId === did);
      const weekly = data.sessions.filter(
        (s) => s.delegationId === did && s.kind === 'weekly' && s.stage,
      );
      const byEvent = new Map<string, FakeSession[]>();
      weekly.forEach((s) =>
        byEvent.set(s.eventId, [...(byEvent.get(s.eventId) ?? []), s]),
      );
      return GroupsResponse.parse({
        generatedAt: nowIso(),
        season: data.season,
        groups: groups.map((g) => ({
          id: g.id,
          code: g.code,
          name: g.name,
          stage: g.stage,
          segment: g.segment,
          schoolLevels: g.schoolLevels,
          counts: {
            participants: g.participantIds.length,
            monitors: g.monitorIds.length,
          },
          monitorNames: g.monitorIds.map(nameOf),
        })),
        myGroupIds: groups
          .filter((g) => g.monitorIds.includes(persona().personId))
          .map((g) => g.id),
        stageEvents: [...byEvent.entries()].map(([eventId, list]) => ({
          stage: list[0].stage,
          eventId,
          sessions: list.map(sessionSummary),
        })),
        hiddenGroups: 0,
        participantsWithoutGroup: did === data.delegations[0].id ? 3 : 0,
      });
    },

    async getToday() {
      await gate('today');
      const did = delegationId();
      const day = today();
      const groupIds = new Set(
        data.groups.filter((g) => g.delegationId === did).map((g) => g.id),
      );
      const events = data.events.filter((e) => e.delegationId === did);
      const meeting = data.sessions.find(
        (s) => s.delegationId === did && s.kind === 'meeting' && s.date <= day,
      );
      const isCoordination =
        PERSONA_ROLES[controls.persona].roles.includes('coordination');
      return TodayResponse.parse({
        generatedAt: nowIso(),
        rollCalls: data.rolls
          .filter((r) => groupIds.has(r.groupId))
          .map(summary),
        eventsToday: events
          .filter((e) => e.startDay === day || e.endDay === day)
          .map((e) => ({
            id: e.id,
            name: e.name,
            startsAt: `${e.startDay}T10:00:00+02:00`,
            endsAt: `${e.endDay}T18:00:00+02:00`,
            todayIs:
              e.startDay === e.endDay
                ? 'single'
                : e.startDay === day
                  ? 'start'
                  : 'end',
          })),
        eventsThisSeason: events.length,
        pendingMeeting:
          isCoordination &&
          meeting &&
          !data.rolls.some((r) => r.sessionId === meeting.id)
            ? {
                sessionId: meeting.id,
                date: meeting.date,
                name: meeting.name ?? 'Reunión',
              }
            : null,
      });
    },

    async getRoll(sid, gid) {
      await gate('roll');
      return buildRoll(sid, gid);
    },

    async saveRoll(sid, gid, body) {
      await gate('saveRoll', true);
      const parsed = RollWrite.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'La lista no tiene la forma esperada');
      const write = parsed.data;
      const repeated = seenClientIds.get(write.clientId);
      if (repeated) return RollWriteResult.parse(repeated);

      const g = myGroup(gid);
      const s = mySession(sid);
      if (s.date > today()) {
        throw validation('session_in_future', 'Esta sesión aún no ha llegado');
      }
      const existing = rollOf(sid, gid);
      const notSaved: {
        personId: string;
        reason: 'not_in_group' | 'no_registration';
      }[] = [];

      if (write.action === 'skip') {
        if (existing)
          throw validation('already_taken', 'Esta lista ya está pasada');
        data.rolls.push({
          sessionId: sid,
          groupId: gid,
          status: 'skipped',
          takenAt: nowIso(),
          marks: {},
          notes: {},
        });
        writeCount += 1;
      } else {
        if (Object.keys(write.marks).length === 0) {
          throw validation('nothing_marked', 'No has marcado a nadie');
        }
        const roll: FakeRoll = existing ?? {
          sessionId: sid,
          groupId: gid,
          status: 'taken',
          takenAt: nowIso(),
          marks: {},
          notes: {},
        };
        if (!existing) {
          data.rolls.push(roll);
          writeCount += 1; // la lista
        }
        roll.status = 'taken';
        for (const [pid, mark] of Object.entries(write.marks)) {
          if (!g.participantIds.includes(pid)) {
            notSaved.push({ personId: pid, reason: 'not_in_group' });
            continue;
          }
          if (
            controls.cannotRegister &&
            data.unregistrable.includes(pid) &&
            !(pid in roll.marks)
          ) {
            notSaved.push({ personId: pid, reason: 'no_registration' });
            continue;
          }
          const note = write.notes[pid] ?? roll.notes[pid] ?? '';
          // «No se reescribe lo que no cambia».
          if (roll.marks[pid] === mark && (roll.notes[pid] ?? '') === note)
            continue;
          roll.marks[pid] = mark;
          if (note) roll.notes[pid] = note;
          else delete roll.notes[pid];
          writeCount += 1;
        }
      }

      const finalRoll = rollOf(sid, gid)!;
      const result = RollWriteResult.parse({
        clientId: write.clientId,
        status: 'applied',
        roll: buildRoll(sid, gid),
        rollCall: summary(finalRoll),
        notSaved,
      });
      seenClientIds.set(write.clientId, result);
      return result;
    },

    async getHealth(personId) {
      await gate('health');
      const p = person(personId);
      if (!p || p.delegationId !== delegationId()) throw forbidden();
      return HealthNote.parse({
        generatedAt: nowIso(),
        personId,
        text: data.health[personId] ?? '',
      });
    },
  };
  return server;
}
