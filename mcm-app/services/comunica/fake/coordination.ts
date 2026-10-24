// services/comunica/fake/coordination.ts
//
// Las rutas de Coordinación del servidor falso (plan 06 «Datos»). Van aparte
// de `index.ts` por tamaño; comparten con él el estado (los datos, el reloj,
// la persona que llama) a través de `ctx`.
//
// Se porta como el plugin en lo que importa (`sticpa_pl_coord_*`,
// `…_save_monitors`, `…_ensure_registrations`, `…_create_reunion`,
// `…_seguimientos`):
//   · Alcance de coordinación (la más amplia) y acompañamiento (toda la
//     delegación, pero sin los monitores sin grupo: 🔒 `alcance-coord`).
//   · La lista de monitores crea las inscripciones que faltan, no reescribe lo
//     que no cambia, recorta el motivo a 255 y no duplica con el mismo
//     `clientId`.
//   · Seguimientos: dos cierres (solo lo legible, y se vuelve a filtrar);
//     sobre uno mismo, nada.

import {
  CoordinationHome,
  CoordinationSummary,
  FollowUpsResponse,
  FollowUpWrite,
  FollowUpWriteResult,
  type Meeting,
  MeetingsResponse,
  MeetingWrite,
  MeetingWriteResult,
  MonitorDetail,
  MonitorsRoll,
  MonitorsRollWrite,
  MonitorsRollWriteResult,
  NOTE_MAX,
  type Role,
  type RollCallSummary,
  type RouteName,
  type SessionSummary,
  SessionTodayResult,
  SessionTodayWrite,
  type Stage,
  type StageStrip,
  type TeamMember,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type {
  FakeData,
  FakeGroup,
  FakeMonitorRoll,
  FakeSession,
  PersonaId,
} from './fixtures';
import { WEEKLY_END, WEEKLY_START } from './fixtures';
import {
  followUpPermissions,
  visibleFollowUps,
} from '@/utils/comunica/followUps';
import { madridDay, madridInstant } from '@/utils/comunica/madrid';
import { pendingMeeting } from '@/utils/comunica/meetings';
import { compareGroups, proposeSession } from '@/utils/comunica/pasarLista';
import { courseRank, schoolLevelFromText } from '@/utils/comunica/schoolLevels';
import { isScoped, scopeMatches, type Scope } from '@/utils/comunica/scope';
import { cleanPhone } from '@/utils/comunica/phone';

/** Lo que el servidor comparte con estas rutas. */
export interface CoordinationCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  roles: () => readonly Role[];
  /** El alcance de coordinación de quien llama (`null` = no coordina). */
  coordScope: () => Scope | null;
  delegationId: () => string;
  now: () => Date;
  nowIso: () => string;
  today: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
}

type CoordinationApi = Pick<
  ComunicaApi,
  | 'getCoordination'
  | 'getCoordinationSummary'
  | 'getMonitorsRoll'
  | 'saveMonitorsRoll'
  | 'getMeetings'
  | 'createMeeting'
  | 'getMonitor'
  | 'getFollowUps'
  | 'createFollowUp'
  | 'createSessionToday'
>;

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

const STRIP_LIMIT = 12;
const STAGE_EVENTS: readonly Stage[] = ['mic', 'com', 'lc'];
/** «Sin etapa, el primero de COM, MIC, LC» (`single_stic_pasar_lista_monitores.php`). */
const DEFAULT_STAGE_ORDER: readonly Stage[] = ['com', 'mic', 'lc'];
const MEETINGS_EVENT = 'f-evt-reuniones';

export function createCoordinationRoutes(
  ctx: CoordinationCtx,
): CoordinationApi {
  const d = () => ctx.data();
  const person = (id: string) => d().people.find((p) => p.id === id);
  const nameOf = (id: string) => {
    const p = person(id);
    return p ? `${p.firstName} ${p.lastName}` : '';
  };
  const myGroups = () =>
    d().groups.filter((g) => g.delegationId === ctx.delegationId());
  const isCoord = () => ctx.coordScope() !== null;
  const isAcomp = () => ctx.roles().includes('accompaniment');
  const requireCoord = () => {
    if (!isCoord()) throw forbidden();
  };
  const requireCoordOrAcomp = () => {
    if (!isCoord() && !isAcomp()) throw forbidden();
  };
  const started = (s: Pick<SessionSummary, 'startsAt'>) =>
    new Date(s.startsAt).getTime() <= ctx.now().getTime();
  const sessionSummary = (s: FakeSession): SessionSummary => ({
    id: s.id,
    eventId: s.eventId,
    date: s.date,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    kind: s.kind,
  });
  const byStart = (a: FakeSession, b: FakeSession) =>
    a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0;
  const weeklyEventOf = (stage: Stage) =>
    d()
      .sessions.filter(
        (s) =>
          s.delegationId === ctx.delegationId() &&
          s.kind === 'weekly' &&
          s.stage === stage,
      )
      .sort(byStart);
  const eventSessions = (eventId: string) =>
    d()
      .sessions.filter(
        (s) => s.eventId === eventId && s.delegationId === ctx.delegationId(),
      )
      .sort(byStart);
  const meetingSessions = () => eventSessions(MEETINGS_EVENT);
  const monitorRollOf = (sid: string) =>
    d().monitorRolls.find((r) => r.sessionId === sid);
  const rollSummary = (r: FakeMonitorRoll): RollCallSummary => {
    const marks = Object.values(r.marks);
    return {
      sessionId: r.sessionId,
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
  const photoOf = (pid: string) => {
    const v = d().monitorProfiles[pid]?.photo;
    return v
      ? `https://fotos.ejemplo.org/v1/people/${pid}/photo?v=${v}`
      : undefined;
  };

  // ── El equipo y su alcance ────────────────────────────────────────────────

  const groupsOfMonitor = (pid: string) =>
    myGroups()
      .filter((g) => g.monitorIds.includes(pid))
      .sort(
        (a, b) =>
          courseRank(a.schoolLevels[0]) - courseRank(b.schoolLevels[0]) ||
          compareGroups(a, b),
      );

  const memberOf = (pid: string): TeamMember => {
    const p = person(pid)!;
    const gs = groupsOfMonitor(pid);
    const loose = d().monitorMemberships.find(
      (m) => m.personId === pid && m.delegationId === ctx.delegationId(),
    );
    const first = gs[0];
    const stages = [
      ...new Set(gs.map((g) => g.stage).filter(Boolean)),
    ] as Stage[];
    const level = first ? schoolLevelFromText(first.schoolLevels[0]) : null;
    const photoUrl = photoOf(pid);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      ...(photoUrl ? { photoUrl } : {}),
      groupCodes: [...gs].sort(compareGroups).map((g) => g.code ?? g.name),
      stage: first?.stage ?? null,
      otherStages: stages.filter((s) => s !== first?.stage),
      ...(level ? { schoolLevel: level } : {}),
      ...(gs.length === 0 && loose
        ? {
            unassigned: {
              membershipId: loose.id,
              ...(loose.outsideGroupName
                ? { outsideGroupName: loose.outsideGroupName }
                : {}),
            },
          }
        : {}),
    };
  };

  /** Curso → grupo (natural) → apellido; los sin grupo, al final. */
  const sortTeam = (ids: string[]) =>
    ids.sort((a, b) => {
      const ga = groupsOfMonitor(a)[0];
      const gb = groupsOfMonitor(b)[0];
      if (!ga !== !gb) return ga ? -1 : 1;
      const rank =
        courseRank(ga?.schoolLevels[0]) - courseRank(gb?.schoolLevels[0]);
      if (rank) return rank;
      const g = ga && gb ? compareGroups(ga, gb) : 0;
      if (g) return g;
      return (person(a)?.lastName ?? '').localeCompare(
        person(b)?.lastName ?? '',
        'es',
      );
    });

  /**
   * Los monitores que ve quien llama: los de los grupos de su alcance (y, si
   * coordina toda la delegación, los sin grupo); acompañamiento, los de todos
   * los grupos de la delegación. Quien hace las dos cosas, la unión.
   */
  const teamIds = (): string[] => {
    const scope = ctx.coordScope();
    const ids = new Set<string>();
    if (scope) {
      for (const g of myGroups().filter((x) => scopeMatches(scope, x))) {
        g.monitorIds.forEach((id) => ids.add(id));
      }
      if (!isScoped(scope)) {
        d()
          .monitorMemberships.filter(
            (m) => m.delegationId === ctx.delegationId(),
          )
          .forEach((m) => ids.add(m.personId));
      }
    }
    if (isAcomp()) {
      myGroups().forEach((g) => g.monitorIds.forEach((id) => ids.add(id)));
    }
    return sortTeam([...ids]);
  };
  const team = () => teamIds().map(memberOf);

  /** Los grupos que «se cuentan»: los del alcance si está acotado. */
  const scopedGroups = () => {
    const scope = ctx.coordScope();
    return scope && isScoped(scope)
      ? myGroups().filter((g) => scopeMatches(scope, g))
      : myGroups();
  };

  // ── Tiras ─────────────────────────────────────────────────────────────────

  const headcountOf = (g: FakeGroup) => {
    const age = d().headcountAgeDays[g.id];
    if (age === null || age === undefined) return null;
    const at = new Date(ctx.now().getTime() - age * 24 * 3_600_000);
    // El recuento es de madrugada: las 03:00 de ese día.
    const day = madridInstant(madridDay(at), '03:00');
    return {
      participants: g.participantIds.length,
      monitors: g.monitorIds.length,
      countedAt: day,
    };
  };

  const strips = (groups: FakeGroup[], limit: number): StageStrip[] =>
    STAGE_EVENTS.flatMap((stage) => {
      const mine = groups.filter((g) => g.stage === stage).sort(compareGroups);
      const held = weeklyEventOf(stage).filter(started).slice(-limit);
      if (mine.length === 0 || held.length === 0) return [];
      return [
        {
          stage,
          sessions: held.map(sessionSummary),
          rows: mine.map((g) => ({
            group: { id: g.id, code: g.code, name: g.name },
            monitors: g.monitorIds.map((id) => ({ id, name: nameOf(id) })),
            headcount: headcountOf(g),
            cells: held.map((s) => {
              const r = d().rolls.find(
                (x) => x.sessionId === s.id && x.groupId === g.id,
              );
              return r ? r.status : null;
            }),
          })),
        },
      ];
    });

  // ── Lista de monitores ────────────────────────────────────────────────────

  /** Las etapas del alcance con evento semanal, MIC, COM, LC. */
  const rollStages = (): Stage[] => {
    const groups = scopedGroups();
    return STAGE_EVENTS.filter(
      (s) => groups.some((g) => g.stage === s) && weeklyEventOf(s).length > 0,
    );
  };
  const defaultStage = (stages: Stage[]) =>
    DEFAULT_STAGE_ORDER.find((s) => stages.includes(s)) ?? null;

  const meetingOf = (s: FakeSession): Meeting => {
    const r = monitorRollOf(s.id);
    const hours =
      (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) /
      3_600_000;
    return {
      session: sessionSummary(s),
      name: s.name ?? 'Reunión',
      durationHours: hours > 0 ? Math.round(hours * 10) / 10 : null,
      rollCall: r ? rollSummary(r) : null,
    };
  };

  const mySession = (sid: string) => {
    const s = d().sessions.find((x) => x.id === sid);
    if (!s || s.delegationId !== ctx.delegationId()) throw forbidden();
    return s;
  };

  /** ¿Puede abrir la ficha de este monitor? (coordinación en su alcance o acompañamiento). */
  const canSeeMonitor = (pid: string) => teamIds().includes(pid);

  const remember = <T>(clientId: string, result: T) => {
    ctx.seen.set(clientId, result);
    return result;
  };

  return {
    async getCoordination() {
      await ctx.gate('coordination');
      requireCoordOrAcomp();
      const stages = rollStages();
      const stage = defaultStage(stages);
      let weekly: CoordinationHome['weeklyMonitorsRoll'] = null;
      if (isCoord() && stage) {
        const last = weeklyEventOf(stage).filter(started).pop();
        if (last) {
          const r = monitorRollOf(last.id);
          weekly = {
            session: sessionSummary(last),
            rollCall: r ? rollSummary(r) : null,
          };
        }
      }
      return CoordinationHome.parse({
        generatedAt: ctx.nowIso(),
        weeklyMonitorsRoll: weekly,
        lastSession: strips(scopedGroups(), 1),
        team: team(),
      });
    },

    async getCoordinationSummary() {
      await ctx.gate('summary');
      if (!ctx.roles().some((r) => r !== 'member' && r !== 'guardian')) {
        throw forbidden();
      }
      const scope = ctx.coordScope();
      const scoped = !!scope && isScoped(scope);
      const mine = scopedGroups();
      const rest = scoped ? myGroups().filter((g) => !mine.includes(g)) : [];
      return CoordinationSummary.parse({
        generatedAt: ctx.nowIso(),
        season: d().season,
        scoped,
        stripLimit: STRIP_LIMIT,
        mine: strips(mine, STRIP_LIMIT),
        rest: strips(rest, STRIP_LIMIT),
        review: {
          participantsWithoutGroup: d()
            .memberships.filter((m) => m.delegationId === ctx.delegationId())
            .map((m) => {
              const p = person(m.personId)!;
              return { id: p.id, firstName: p.firstName, lastName: p.lastName };
            })
            .sort((a, b) => a.lastName.localeCompare(b.lastName, 'es')),
          groupsWithoutCode: myGroups()
            .filter((g) => !g.code?.trim())
            .map((g) => ({ id: g.id, name: g.name })),
        },
      });
    },

    async getMonitorsRoll(params) {
      await ctx.gate('monitorsRoll');
      requireCoord();
      const members = team();
      const now = ctx.now();
      if (params.kind === 'meeting') {
        const list = meetingSessions();
        let s = params.session ? mySession(params.session) : undefined;
        if (s && s.kind !== 'meeting') throw forbidden();
        if (!s) {
          // Sin `session`: la que falta pasar o, si no, la última celebrada.
          const pending = pendingMeeting(list.map(meetingOf), now);
          s = pending
            ? list.find((x) => x.id === pending.session.id)
            : list.filter(started).pop();
        }
        const roll = s ? monitorRollOf(s.id) : undefined;
        const held = list.filter(started);
        return MonitorsRoll.parse({
          generatedAt: ctx.nowIso(),
          kind: 'meeting',
          stages: [],
          stage: null,
          event:
            list.length > 0
              ? { id: MEETINGS_EVENT, name: d().eventNames[MEETINGS_EVENT] }
              : null,
          session: s
            ? { ...sessionSummary(s), ...(s.name ? { name: s.name } : {}) }
            : null,
          sessions: list.map(sessionSummary),
          rollCalls: list
            .map((x) => monitorRollOf(x.id))
            .filter((x): x is FakeMonitorRoll => !!x)
            .map(rollSummary),
          rollCall: roll ? rollSummary(roll) : null,
          rows: s
            ? members.map((m) => ({
                member: m,
                mark: roll?.marks[m.id] ?? null,
                reason: roll?.notes[m.id] ?? null,
                seasonMarks: held.map(
                  (x) => monitorRollOf(x.id)?.marks[m.id] ?? null,
                ),
              }))
            : [],
          borrowed: [],
        });
      }
      const stages = rollStages();
      const stage =
        params.stage && stages.includes(params.stage)
          ? params.stage
          : defaultStage(stages);
      if (!stage) {
        return MonitorsRoll.parse({
          generatedAt: ctx.nowIso(),
          kind: 'weekly',
          stages,
          stage: null,
          event: null,
          session: null,
          sessions: [],
          rollCalls: [],
          rollCall: null,
          rows: [],
          borrowed: [],
        });
      }
      const list = weeklyEventOf(stage);
      const eventId = `f-evt-v${stage}`;
      let s = params.session ? mySession(params.session) : undefined;
      if (s && (s.kind !== 'weekly' || s.stage !== stage)) throw forbidden();
      if (!s) {
        const p = proposeSession(list.map(sessionSummary), now);
        s = p ? list.find((x) => x.id === p.session.id) : undefined;
      }
      const roll = s ? monitorRollOf(s.id) : undefined;
      const held = list.filter(started);
      // Una lista por etapa, sobre su evento. Los sin grupo, en la primera
      // (la que abre por defecto), como en el plugin.
      const rowsOf = members.filter(
        (m) =>
          m.stage === stage ||
          (m.stage === null && stage === defaultStage(stages)),
      );
      return MonitorsRoll.parse({
        generatedAt: ctx.nowIso(),
        kind: 'weekly',
        stages,
        stage,
        event: { id: eventId, name: d().eventNames[eventId] ?? eventId },
        session: s ? sessionSummary(s) : null,
        sessions: list.map(sessionSummary),
        rollCalls: list
          .map((x) => monitorRollOf(x.id))
          .filter((x): x is FakeMonitorRoll => !!x)
          .map(rollSummary),
        rollCall: roll ? rollSummary(roll) : null,
        rows: rowsOf.map((m) => ({
          member: m,
          mark: roll?.marks[m.id] ?? null,
          reason: roll?.notes[m.id] ?? null,
          seasonMarks: held.map(
            (x) => monitorRollOf(x.id)?.marks[m.id] ?? null,
          ),
        })),
        borrowed: members.filter(
          (m) => m.stage !== stage && m.otherStages.includes(stage),
        ),
      });
    },

    async saveMonitorsRoll(sid, body) {
      await ctx.gate('saveMonitorsRoll', true);
      requireCoord();
      const parsed = MonitorsRollWrite.safeParse(body);
      if (!parsed.success) {
        throw validation('bad_body', 'La lista no tiene la forma esperada');
      }
      const w = parsed.data;
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) return MonitorsRollWriteResult.parse(repeated);
      const s = mySession(sid);
      const kindOk =
        (w.kind === 'weekly' && s.kind === 'weekly') ||
        (w.kind === 'meeting' && s.kind === 'meeting');
      if (!kindOk)
        throw validation('wrong_kind', 'Esa sesión no es de esta lista');
      if (s.date > ctx.today()) {
        throw validation('session_in_future', 'Esta sesión aún no ha llegado');
      }
      const allowed = new Set(teamIds());
      const regs = (d().monitorRegistrations[s.eventId] ??= []);
      let roll = monitorRollOf(sid);
      if (!roll) {
        roll = {
          sessionId: sid,
          status: 'taken',
          takenAt: ctx.nowIso(),
          marks: {},
          notes: {},
        };
        d().monitorRolls.push(roll);
        ctx.bumpWrites(); // la lista
      }
      roll.status = 'taken';
      for (const m of w.marks) {
        if (!allowed.has(m.personId)) continue;
        // Casi ningún monitor está inscrito: la inscripción se crea al guardar.
        if (!regs.includes(m.personId)) {
          regs.push(m.personId);
          d().registrationsCreated += 1;
          ctx.bumpWrites();
        }
        const reason = (m.reason ?? '').trim().slice(0, NOTE_MAX);
        const note = m.mark === 'yes' ? '' : reason;
        // «No se reescribe lo que no cambia».
        if (
          roll.marks[m.personId] === m.mark &&
          (roll.notes[m.personId] ?? '') === note
        ) {
          continue;
        }
        roll.marks[m.personId] = m.mark;
        if (note) roll.notes[m.personId] = note;
        else delete roll.notes[m.personId];
        ctx.bumpWrites();
      }
      return remember(
        w.clientId,
        MonitorsRollWriteResult.parse({
          clientId: w.clientId,
          status: 'applied',
          rollCall: rollSummary(roll),
        }),
      );
    },

    async getMeetings() {
      await ctx.gate('meetings');
      requireCoord();
      return MeetingsResponse.parse({
        generatedAt: ctx.nowIso(),
        season: d().season,
        meetings: meetingSessions().reverse().map(meetingOf),
      });
    },

    async createMeeting(body) {
      await ctx.gate('createMeeting', true);
      requireCoord();
      const parsed = MeetingWrite.safeParse(body);
      if (!parsed.success) {
        throw validation('bad_body', 'Revisa el nombre, el día y la hora');
      }
      const w = parsed.data;
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) return MeetingWriteResult.parse(repeated);
      const startsAt = madridInstant(w.date, w.startTime);
      const [h, mi] = w.startTime.split(':').map(Number);
      // Hasta medianoche como mucho: una reunión no cruza de día.
      const endMin = Math.min(23 * 60 + 59, h * 60 + mi + w.durationHours * 60);
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const session: FakeSession = {
        id: `f-ses-reunion-n${d().sessions.length + 1}`,
        eventId: MEETINGS_EVENT,
        date: w.date,
        startsAt,
        endsAt: madridInstant(w.date, endTime),
        kind: 'meeting',
        delegationId: ctx.delegationId(),
        stage: null,
        name: w.name.trim(),
      };
      d().sessions.push(session);
      ctx.bumpWrites();
      return remember(
        w.clientId,
        MeetingWriteResult.parse({
          clientId: w.clientId,
          status: 'applied',
          crmIds: [session.id],
          meeting: meetingOf(session),
        }),
      );
    },

    async getMonitor(pid) {
      await ctx.gate('monitor');
      requireCoordOrAcomp();
      if (!canSeeMonitor(pid)) throw forbidden();
      const m = memberOf(pid);
      const prof = d().monitorProfiles[pid];
      const gs = groupsOfMonitor(pid);
      const regs = d().monitorRegistrations;
      const squaresOf = (list: FakeSession[]) =>
        list.filter(started).map((s) => {
          const r = monitorRollOf(s.id);
          const mark = r?.marks[pid] ?? null;
          const reason = mark ? r?.notes[pid] : undefined;
          return {
            sessionId: s.id,
            date: s.date,
            ...(s.kind === 'meeting' && s.name ? { name: s.name } : {}),
            mark,
            ...(reason ? { reason } : {}),
          };
        });
      const phone = (raw?: string) => {
        const p = cleanPhone(raw);
        return p
          ? { display: p.display, tel: p.tel, whatsapp: p.wa }
          : undefined;
      };
      const mobile = phone(prof?.mobile);
      const other = phone(prof?.otherPhone);
      const COMPLIANCE: { label: string; required: boolean; note?: string }[] =
        [
          { label: 'Certificado de delitos sexuales', required: true },
          { label: 'Formación en protección del menor', required: true },
          { label: 'Código de conducta', required: true },
          { label: 'Acuerdo de confidencialidad', required: true },
          { label: 'Acuerdo de incorporación', required: true },
          { label: 'Compromiso firmado', required: true },
          { label: 'Protección de datos (LOPD)', required: false },
          { label: 'Cesión de imágenes', required: false },
        ];
      const missing = new Set(prof?.missing ?? []);
      const current = {
        season: d().season,
        current: true,
        groups: gs.map((g) => ({
          code: g.code,
          name: g.name,
          schoolLevels: g.schoolLevels,
          colleagues: g.monitorIds.filter((x) => x !== pid).map(nameOf),
        })),
      };
      const meetings = meetingSessions();
      return MonitorDetail.parse({
        generatedAt: ctx.nowIso(),
        monitor: {
          ...m,
          ...(prof ? { age: prof.age, monitorSinceYear: prof.sinceYear } : {}),
          ...(mobile ? { mobile } : {}),
          ...(other ? { otherPhone: other } : {}),
          ...(prof?.email ? { email: prof.email } : {}),
          doNotCall: !!prof?.doNotCall,
        },
        weekly: m.stage
          ? {
              registered: (regs[`f-evt-v${m.stage}`] ?? []).includes(pid),
              squares: squaresOf(weeklyEventOf(m.stage)),
            }
          : null,
        meetings:
          meetings.length > 0
            ? {
                registered: (regs[MEETINGS_EVENT] ?? []).includes(pid),
                squares: squaresOf(meetings),
              }
            : null,
        rollCalls: gs
          .filter((g) => g.stage && g.participantIds.length > 0)
          .map((g) => ({
            group: { id: g.id, code: g.code },
            squares: weeklyEventOf(g.stage!)
              .filter(started)
              .map((s) => {
                const r = d().rolls.find(
                  (x) => x.sessionId === s.id && x.groupId === g.id,
                );
                const taker = d().rollTakers[`${s.id}:${g.id}`];
                return {
                  sessionId: s.id,
                  date: s.date,
                  state: !r
                    ? ('missing' as const)
                    : r.status === 'skipped'
                      ? ('skipped' as const)
                      : taker === pid
                        ? ('mine' as const)
                        : ('other' as const),
                };
              }),
          })),
        groups: gs.map((g) => ({
          group: {
            id: g.id,
            code: g.code,
            name: g.name,
            schoolLevels: g.schoolLevels,
            inRollCall: true,
          },
          role: 'leads' as const,
          ...(prof?.groupsSince[g.id] ? { since: prof.groupsSince[g.id] } : {}),
          counts: {
            participants: g.participantIds.length,
            monitors: g.monitorIds.length,
          },
          colleagues: g.monitorIds
            .filter((x) => x !== pid)
            .map((id) => ({ id, name: nameOf(id) })),
        })),
        history: [
          ...(gs.length ? [current] : []),
          ...(prof?.history ?? []).map((h) => ({ ...h, current: false })),
        ],
        paperwork: {
          compliance: COMPLIANCE.map((c) => {
            const ok = !missing.has(c.label);
            const note =
              c.label === 'Certificado de delitos sexuales'
                ? ok
                  ? 'Autorizó a pedirlo cada año'
                  : 'Hay que reclamarlo'
                : undefined;
            return {
              label: c.label,
              ok,
              required: c.required,
              ...(note ? { note } : {}),
            };
          }),
          mcm: prof?.mcm ?? [],
          training: prof?.training ?? [],
          congresses: prof?.congresses ?? [],
          ...(prof?.academic ? { academic: prof.academic } : {}),
          personal: prof?.personal ?? [],
        },
      });
    },

    async getFollowUps(pid) {
      await ctx.gate('followUps');
      requireCoordOrAcomp();
      if (!canSeeMonitor(pid)) throw forbidden();
      const me = d().personas[ctx.persona()].personId;
      const perms = followUpPermissions(ctx.roles(), me, pid);
      // Dos cierres: solo se «pide» lo legible y se vuelve a filtrar.
      const raw = (d().followUps[pid] ?? []).filter((f) =>
        (perms.readable as string[]).includes(f.type),
      );
      return FollowUpsResponse.parse({
        generatedAt: ctx.nowIso(),
        readable: perms.readable,
        writable: perms.writable,
        items: visibleFollowUps(raw, perms.readable),
      });
    },

    async createFollowUp(pid, body) {
      await ctx.gate('createFollowUp', true);
      requireCoordOrAcomp();
      const parsed = FollowUpWrite.safeParse(body);
      if (!parsed.success) {
        throw validation('bad_body', 'Escribe qué pasó');
      }
      const w = parsed.data;
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) return FollowUpWriteResult.parse(repeated);
      if (!canSeeMonitor(pid)) throw forbidden();
      const me = d().personas[ctx.persona()].personId;
      const perms = followUpPermissions(ctx.roles(), me, pid);
      if (!perms.writable.includes(w.type)) throw forbidden();
      const item = {
        id: `f-seg-n${ctx.seen.size + 1}-${pid}`,
        type: w.type,
        date: w.date,
        text: w.text.trim(),
        author: person(me)?.firstName ?? '',
      };
      (d().followUps[pid] ??= []).push(item);
      ctx.bumpWrites();
      return remember(
        w.clientId,
        FollowUpWriteResult.parse({
          clientId: w.clientId,
          status: 'applied',
          crmIds: [item.id],
          item,
        }),
      );
    },

    async createSessionToday(eventId, body) {
      await ctx.gate('sessionToday', true);
      requireCoord();
      const parsed = SessionTodayWrite.safeParse(body);
      if (!parsed.success) throw validation('bad_body', 'Petición no válida');
      const w = parsed.data;
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) return SessionTodayResult.parse(repeated);
      const list = eventSessions(eventId);
      const isMeetings = eventId === MEETINGS_EVENT;
      const stage = (/^f-evt-v(mic|com|lc)$/.exec(eventId)?.[1] ??
        null) as Stage | null;
      if (!isMeetings && !stage) throw forbidden();
      const day = ctx.today();
      let s = list.find((x) => x.date === day);
      if (!s) {
        s = {
          id: `f-ses-hoy-${eventId}-${day}`,
          eventId,
          date: day,
          startsAt: madridInstant(day, WEEKLY_START),
          endsAt: madridInstant(day, WEEKLY_END),
          kind: isMeetings ? 'meeting' : 'weekly',
          delegationId: ctx.delegationId(),
          stage,
          ...(isMeetings ? { name: 'Reunión' } : {}),
        };
        d().sessions.push(s);
        ctx.bumpWrites();
      }
      return remember(
        w.clientId,
        SessionTodayResult.parse({
          clientId: w.clientId,
          status: 'applied',
          crmIds: [s.id],
          session: sessionSummary(s),
        }),
      );
    },
  };
}

/** La reunión sin pasar de la delegación (para `GET /v1/today`). */
export function pendingMeetingOf(
  data: FakeData,
  delegationId: string,
  now: Date,
) {
  const list = data.sessions
    .filter((s) => s.delegationId === delegationId && s.kind === 'meeting')
    .map((s) => ({
      session: s,
      rollCall: data.monitorRolls.some((r) => r.sessionId === s.id)
        ? ({} as RollCallSummary)
        : null,
    }));
  return pendingMeeting(list, now)?.session ?? null;
}
