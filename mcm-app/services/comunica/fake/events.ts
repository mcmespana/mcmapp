// services/comunica/fake/events.ts
//
// Pasar lista en un evento en el servidor falso (plan 07 «Datos»). Se porta
// como el plugin en lo que importa:
//   · Qué eventos (`sticpa_pl_ev_clasificar`): de la delegación, que tocan el
//     curso (1 sep - 31 ago), de 50 días o menos, sin semanales ni reuniones.
//     Fuera de esa lista, `forbidden`, exista o no.
//   · Quién sale (`sticpa_pl_ev_lista`): una vez por persona (con dos
//     inscripciones, la activa), curso de la inscripción o de la relación,
//     etapa del curso y si no la del grupo, monitores por inscripción o por
//     relación, «equipo», y «No van».
//   · Grupos de actividad (`sticpa_gac_visibles`): los anulados solo con el
//     evento terminado y alguien dentro.
//   · Al escribir (`sticpa_pl_ev_guardar`): solo gente de la lista (el resto en
//     `skipped`), lo no enviado no se toca, `sessionId: null` busca la sesión
//     del día y si no la crea (una, aunque se mande dos veces), y `applied`
//     solo si al releer está todo.

import {
  ACTIVITY_TYPES,
  type ActivityGroup,
  type ActivityMember,
  type ActivityTab,
  type Delegation,
  type EventPerson,
  EventRoll,
  EventRollWrite,
  EventRollWriteResult,
  type EventSummary,
  EventsResponse,
  NOTE_MAX,
  type Role,
  type RouteName,
  type SessionSummary,
  type Stage,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, FakeGroup, FakePerson, FakeSession } from './fixtures';
import {
  generateEventData,
  sessionTimes,
  type FakeEventData,
  type FakeLabEvent,
  type FakeRegistration,
} from './fixturesEvents';
import { daysBetween, madridInstant } from '@/utils/comunica/madrid';
import { schoolLevelFromText } from '@/utils/comunica/schoolLevels';

export interface EventsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  roles: () => readonly Role[];
  delegationId: () => string;
  today: () => string;
  nowIso: () => string;
  /** El mando «la relectura falla» (`crm_unavailable` tras escribir). */
  rereadFails: () => boolean;
  photoUrlOf: (personId: string) => string | undefined;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
}

type EventsApi = Pick<
  ComunicaApi,
  'getEvents' | 'getEventRoll' | 'saveEventRoll'
>;

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

const MAX_DAYS = 50;
const TEAM: readonly Role[] = ['monitor', 'coordination', 'accompaniment'];

/** El curso que contiene `day`: del 1 de septiembre al 31 de agosto. */
export function courseOf(day: string) {
  const [y, m] = day.split('-').map(Number);
  const start = m >= 9 ? y : y - 1;
  return { start: `${start}-09-01`, end: `${start + 1}-08-31` };
}

export function createEventRoutes(ctx: EventsCtx): EventsApi & {
  /** Los datos de eventos (para los tests). */
  readonly eventData: FakeEventData;
} {
  // Se generan con el «hoy» de la primera petición, y otra vez tras `reset()`
  // (que cambia los datos de partida).
  let ev: FakeEventData | null = null;
  let evFor: FakeData | null = null;
  const evData = () => {
    if (!ev || evFor !== ctx.data()) {
      evFor = ctx.data();
      ev = generateEventData(evFor, ctx.today());
    }
    return ev;
  };
  const d = () => ctx.data();

  const requireTeam = () => {
    if (!ctx.roles().some((r) => TEAM.includes(r))) throw forbidden();
  };

  /** Los eventos que se ofrecen (`sticpa_pl_ev_clasificar`). */
  const offered = (): FakeLabEvent[] => {
    const course = courseOf(ctx.today());
    return evData().events.filter(
      (e) =>
        e.delegationId === ctx.delegationId() &&
        !e.recurring &&
        e.endDay >= course.start &&
        e.startDay <= course.end &&
        daysBetween(e.startDay, e.endDay) <= MAX_DAYS,
    );
  };
  const offeredEvent = (id: string) => {
    const e = offered().find((x) => x.id === id);
    if (!e) throw forbidden();
    return e;
  };

  const summaryOf = (e: FakeLabEvent): EventSummary => ({
    id: e.id,
    name: e.name,
    startDate: e.startDay,
    endDate: e.endDay,
    startsAt: madridInstant(e.startDay, e.startTime),
    endsAt: madridInstant(e.endDay, e.endTime),
  });

  const personOf = (id: string): FakePerson | undefined =>
    d().people.find((p) => p.id === id) ??
    evData().people.find((p) => p.id === id);
  const delegationOf = (id: string): Delegation =>
    d().delegations.find((x) => x.id === id) ?? { id, name: id };
  const homeGroupOf = (personId: string, did: string): FakeGroup | undefined =>
    d().groups.find(
      (g) => g.delegationId === did && g.participantIds.includes(personId),
    );
  const isMonitorIn = (personId: string, did: string) =>
    d().groups.some(
      (g) => g.delegationId === did && g.monitorIds.includes(personId),
    );

  const ended = (e: FakeLabEvent) => e.endDay < ctx.today();

  /** Los grupos que se enseñan (`sticpa_gac_visibles`). */
  const visibleGroups = (e: FakeLabEvent) => {
    const data = evData();
    const withPeople = new Set(data.members.map((m) => m.groupId));
    return data.groups.filter(
      (g) =>
        g.eventId === e.id && (g.active || (ended(e) && withPeople.has(g.id))),
    );
  };
  const tabKeyOf = (type: string, batch: string | null) =>
    `${type}|${(batch ?? '').trim().toLowerCase()}`;

  /** Una vez por persona: la activa más reciente; si no hay, la más reciente. */
  const pickRegistrations = (regs: readonly FakeRegistration[]) => {
    const byPerson = new Map<string, FakeRegistration>();
    for (const r of regs) {
      const prev = byPerson.get(r.personId);
      const better =
        !prev ||
        (!r.status && prev.status) ||
        (!r.status === !prev.status && r.createdAt > prev.createdAt);
      if (better) byPerson.set(r.personId, r);
    }
    return [...byPerson.values()];
  };

  const stageOf = (key: string | null, g?: FakeGroup): EventPerson['stage'] => {
    if (key?.startsWith('ep')) return 'mic';
    if (
      key &&
      (key.startsWith('eso') || key.startsWith('bach') || key.startsWith('fp'))
    )
      return 'com';
    const s: Stage | null | undefined = g?.stage;
    return s === 'mic' || s === 'com' || s === 'lc' ? s : null;
  };

  const eventPersonOf = (
    e: FakeLabEvent,
    r: FakeRegistration,
    groupIds: Map<string, string[]>,
  ): EventPerson | null => {
    const p = personOf(r.personId);
    if (!p) return null;
    const role =
      r.role !== 'participant'
        ? r.role
        : isMonitorIn(p.id, e.delegationId)
          ? 'monitor'
          : 'participant';
    const home =
      role === 'participant' ? homeGroupOf(p.id, e.delegationId) : undefined;
    const level =
      role === 'participant'
        ? schoolLevelFromText(r.schoolLevel ?? p.schoolLevel)
        : null;
    const photoUrl = ctx.photoUrlOf(p.id);
    return {
      person: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        ...(photoUrl ? { photoUrl } : {}),
        badges: { ...p.badges },
      },
      schoolLevel: level,
      role,
      stage: role === 'participant' ? stageOf(level?.key ?? null, home) : null,
      homeGroup: home ? { id: home.id, code: home.code } : null,
      otherDelegation:
        p.delegationId === e.delegationId ? null : delegationOf(p.delegationId),
      activityGroupIds: groupIds.get(p.id) ?? [],
      ...(r.status ? { registrationStatus: r.status } : {}),
    };
  };

  const sessionsOf = (eventId: string) =>
    evData()
      .sessions.filter((s) => s.eventId === eventId)
      .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const sessionSummary = (s: FakeSession): SessionSummary => ({
    id: s.id,
    eventId: s.eventId,
    date: s.date,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    kind: 'event',
  });

  const rollOf = (e: FakeLabEvent): EventRoll => {
    const data = evData();
    const groups = visibleGroups(e);
    const ids = new Set(groups.map((g) => g.id));
    const members = data.members.filter((m) => ids.has(m.groupId));
    const groupIds = new Map<string, string[]>();
    for (const m of members) {
      if (!m.personId) continue;
      groupIds.set(m.personId, [
        ...(groupIds.get(m.personId) ?? []),
        m.groupId,
      ]);
    }
    const regs = pickRegistrations(data.registrations[e.id] ?? []);
    const people: EventPerson[] = [];
    const notGoing: EventPerson[] = [];
    for (const r of regs) {
      const p = eventPersonOf(e, r, groupIds);
      if (!p) continue;
      (r.status ? notGoing : people).push(p);
    }
    const sessions = sessionsOf(e.id);
    const tabs = new Map<string, ActivityTab>();
    const outGroups: ActivityGroup[] = groups.map((g) => {
      const key = tabKeyOf(g.type, g.batch);
      const t = tabs.get(key) ?? {
        key,
        type: g.type,
        batch: g.batch,
        groupCount: 0,
      };
      t.groupCount += 1;
      tabs.set(key, t);
      return {
        id: g.id,
        tabKey: key,
        name: g.name,
        type: g.type,
        capacity: g.capacity,
        withMonitors: g.withMonitors,
      };
    });
    const tabOf = new Map(outGroups.map((g) => [g.id, g.tabKey]));
    const outMembers: ActivityMember[] = members.map((m) => ({
      groupId: m.groupId,
      tabKey: tabOf.get(m.groupId)!,
      role: m.role,
      personId: m.personId,
      name: m.name,
    }));
    return EventRoll.parse({
      generatedAt: ctx.nowIso(),
      event: summaryOf(e),
      sessions: sessions.map(sessionSummary),
      marksBySession: Object.fromEntries(
        sessions.map((s) => [s.id, { ...(data.marks[s.id] ?? {}) }]),
      ),
      people,
      notGoing,
      activity: {
        tabs: [...tabs.values()].sort(
          (a, b) =>
            ACTIVITY_TYPES.indexOf(a.type) - ACTIVITY_TYPES.indexOf(b.type) ||
            (a.batch ?? '').localeCompare(b.batch ?? ''),
        ),
        groups: outGroups,
        members: outMembers,
      },
    });
  };

  /** La sesión del día; si no hay, se crea (`sticpa_pl_ev_sesion_del_dia`). */
  const sessionOfDay = (e: FakeLabEvent, day: string): FakeSession => {
    const found = sessionsOf(e.id).find((s) => s.date === day);
    if (found) return found;
    const time =
      day === e.startDay ? e.startTime : day === e.endDay ? e.endTime : '09:00';
    const s: FakeSession = {
      id: `f-ses-new-${e.id.slice(5)}-${day}`,
      eventId: e.id,
      date: day,
      ...sessionTimes(day, time),
      kind: 'event',
      delegationId: e.delegationId,
      stage: null,
    };
    evData().sessions.push(s);
    ctx.bumpWrites();
    return s;
  };

  return {
    get eventData() {
      return evData();
    },

    async getEvents() {
      await ctx.gate('events');
      requireTeam();
      const course = courseOf(ctx.today());
      return EventsResponse.parse({
        generatedAt: ctx.nowIso(),
        season: `${course.start.slice(0, 4)}-${course.end.slice(0, 4)}`,
        events: offered().map(summaryOf),
      });
    },

    async getEventRoll(eventId) {
      await ctx.gate('eventRoll');
      requireTeam();
      return rollOf(offeredEvent(eventId));
    },

    async saveEventRoll(eventId, body) {
      await ctx.gate('saveEventRoll', true);
      requireTeam();
      const w = EventRollWrite.parse(body);
      const e = offeredEvent(eventId);
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) {
        if (ctx.rereadFails()) {
          throw new ComunicaApiError(
            'crm_unavailable',
            'El CRM no responde',
            503,
          );
        }
        return repeated as EventRollWriteResult;
      }
      for (const m of Object.values(w.marks)) {
        if ((m.reason ?? '').length > NOTE_MAX) {
          throw validation('reason_too_long', 'El motivo es demasiado largo');
        }
      }
      let session: FakeSession;
      if (w.sessionId) {
        const s = sessionsOf(e.id).find((x) => x.id === w.sessionId);
        if (!s) throw forbidden();
        session = s;
      } else {
        session = sessionOfDay(e, w.day);
      }
      const roll = rollOf(e);
      const allowed = new Set(roll.people.map((p) => p.person.id));
      const marks = (evData().marks[session.id] ??= {});
      const skipped: string[] = [];
      for (const [pid, entry] of Object.entries(w.marks)) {
        if (!allowed.has(pid)) {
          skipped.push(pid);
          continue;
        }
        const reason = entry.reason?.trim();
        marks[pid] = { mark: entry.mark, ...(reason ? { reason } : {}) };
        ctx.bumpWrites();
      }
      const values = Object.values(marks);
      const result = EventRollWriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
        sessionId: session.id,
        counts: {
          came: values.filter((m) => m.mark === 'yes' || m.mark === 'partial')
            .length,
          missed: values.filter(
            (m) => m.mark === 'no_justified' || m.mark === 'no_unjustified',
          ).length,
        },
        skipped,
      });
      ctx.seen.set(w.clientId, result);
      // Escrito, pero la relectura no lo confirma: la cola reintenta (y el
      // reintento no duplica: la sesión ya está y el `clientId` también).
      if (ctx.rereadFails()) {
        throw new ComunicaApiError(
          'crm_unavailable',
          'El CRM no responde',
          503,
        );
      }
      return result;
    },
  };
}
