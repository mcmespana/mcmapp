/* eslint-disable max-lines -- el falso entero de un vistazo: docs/desarrollo/WARNINGS.md §3 */
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
  CodeRequest,
  GroupDetail,
  GroupsResponse,
  HealthNote,
  MembershipGroupWrite,
  NoticeWrite,
  NoticeWriteResult,
  type ParticipantRow,
  ParticipantProfile,
  PeopleIndex,
  PersonalData,
  ScarfWrite,
  TEAM_ROLES,
  WriteResult,
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
  ExchangeRequest,
  VerifyRequest,
  VerifyResponse,
  WebPass,
  WebPassRequest,
  type Tokens,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import {
  FAKE_CODE,
  FAKE_DNIS,
  FAKE_EMAILS,
  FAKE_LINK_TOKENS,
  FAKE_PLUGIN_LINKS,
  FAKE_RATE_LIMITED_EMAIL,
  generateFakeData,
  markOf,
  type FakeData,
  type FakeGroup,
  type FakePerson,
  type FakeRoll,
  type FakeSession,
  type PersonaId,
} from './fixtures';
import { madridDay, madridInstant } from '@/utils/comunica/madrid';
import { canMarkSession } from '@/utils/comunica/sessions';
import { unionScope, type CoordRelation } from '@/utils/comunica/scope';
import { createCoordinationRoutes, pendingMeetingOf } from './coordination';
import { createEventRoutes } from './events';
import type { FakeEventData } from './fixturesEvents';
import * as fakeDevices from './devices';
import { monitorRoutes, type MineKeys, type UploadsLog } from './myMonitor';
import { schoolLevelFromText } from '@/utils/comunica/schoolLevels';

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
  /**
   * El curso anterior se ha cerrado y el nuevo no está abierto: ningún
   * participante tiene la relación vigente (Grupos y fichas, plan 05).
   */
  seasonClosed: boolean;
  /**
   * Pasar lista en un evento: se escribe, pero la relectura no lo confirma
   * (`crm_unavailable`); la cola reintenta sin duplicar (plan 07).
   */
  eventRereadFails: boolean;
}

export const DEFAULT_CONTROLS: FakeControls = {
  latencyMs: 300,
  offline: false,
  crmDown: false,
  failRoute: null,
  persona: 'monitor',
  clock: null,
  cannotRegister: false,
  seasonClosed: false,
  eventRereadFails: false,
};

const PERSONA_ROLES: Record<PersonaId, { roles: Role[]; scope: Me['scope'] }> =
  {
    monitor: { roles: ['monitor'], scope: 'delegation' },
    coordination: { roles: ['monitor', 'coordination'], scope: 'delegation' },
    accompaniment: { roles: ['accompaniment'], scope: { segments: ['com_1'] } },
    other: { roles: ['monitor'], scope: 'delegation' },
    // Coordinación (plan 06).
    coordinationCom2: {
      roles: ['monitor', 'coordination'],
      scope: { stages: ['com'], segments: ['com_2'] },
    },
    both: {
      roles: ['monitor', 'coordination', 'accompaniment'],
      scope: 'delegation',
    },
  };

/**
 * Las relaciones VIGENTES de coordinación y de acompañamiento de cada persona
 * de prueba (etapa y segmento de su grupo). Lo que ve es LA SUMA
 * (`unionScope`, ✅ `alcance-coord`), igual para los dos papeles; casa con
 * su `Me.scope` de arriba.
 */
const TEAM_RELATIONS: Record<PersonaId, CoordRelation[]> = {
  monitor: [],
  coordination: [{}],
  accompaniment: [{ stage: 'com', segment: 'com_1' }],
  other: [],
  coordinationCom2: [{ stage: 'com', segment: 'com_2' }],
  both: [{}, {}],
};

export interface FakeServerOptions {
  /**
   * El token de acceso de la sesión de la app. Con él, el falso exige sesión
   * como el de verdad (401 sin ella). Sin él (los tests de siempre), «entra»
   * como `controls.persona`.
   */
  getAccessToken?: () => string | null | Promise<string | null>;
}

/** Lo que dura el token de acceso del falso (como el de verdad, ~15 min). */
export const FAKE_ACCESS_TTL_S = 15 * 60;
/** Lo que dura un código pedido. */
const CODE_TTL_MS = 40 * 60_000;
/** Códigos fallidos que bloquean esa vía una hora. */
const MAX_BAD_CODES = 10;

export interface FakeServer
  extends ComunicaApi, fakeDevices.DevicesFake, UploadsLog {
  controls: FakeControls;
  setControls(patch: Partial<FakeControls>): void;
  subscribe(listener: () => void): () => void;
  /** Escrituras que habrían llegado al CRM (para comprobar «no reescribir»). */
  readonly writeCount: number;
  /** Vuelve a los datos de partida y a los mandos por defecto. */
  reset(): void;
  /** Los datos en bruto, para los tests. */
  readonly data: FakeData;
  /** Los eventos para pasar lista (plan 07), en bruto. */
  readonly eventData: FakeEventData;
  /** Entra directamente como una persona de prueba (Laboratorio Alpha). */
  issueSession(persona: PersonaId): Tokens & { me: Me };
  /** Revoca todas las sesiones: el siguiente refresco falla. */
  revokeAll(): void;
}

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

export function createFakeServer(
  initial: Partial<FakeControls> = {},
  options: FakeServerOptions = {},
): FakeServer {
  let data = generateFakeData();
  let controls: FakeControls = { ...DEFAULT_CONTROLS, ...initial };
  let writeCount = 0;
  const seenClientIds = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  // Sesiones: token de acceso → persona y caducidad; de refresco → persona,
  // si ya se usó (rota en cada uso) y su familia (para revocar en bloque).
  const access = new Map<string, { persona: PersonaId; exp: number }>();
  const refreshTokens = new Map<
    string,
    { persona: PersonaId; used: boolean; family: number }
  >();
  const revokedFamilies = new Set<number>();
  const codes = new Map<string, number>();
  const badCodes = new Map<string, number>();
  let tokenSeq = 0;
  /** La persona de la petición en curso (la pone `gate`). */
  let current: PersonaId = controls.persona;

  const now = () => (controls.clock ? new Date(controls.clock) : new Date());
  const nowIso = () =>
    now()
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
  const today = () => madridDay(now());

  async function gate(route: RouteName, write = false, auth = true) {
    if (controls.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, controls.latencyMs));
    }
    if (controls.offline) {
      throw new ComunicaApiError('network', 'Sin conexión con el servidor');
    }
    if (auth) {
      if (options.getAccessToken) {
        const token = await options.getAccessToken();
        const s = token ? access.get(token) : undefined;
        if (!s || s.exp <= Date.now()) {
          throw new ComunicaApiError('unauthenticated', 'Sesión caducada', 401);
        }
        current = s.persona;
      } else {
        current = controls.persona;
      }
    }
    if (controls.failRoute === route || (write && controls.crmDown)) {
      throw new ComunicaApiError('crm_unavailable', 'El CRM no responde', 503);
    }
  }

  const personaOf = (personId: string): PersonaId | undefined =>
    (Object.keys(data.personas) as PersonaId[]).find(
      (k) => data.personas[k].personId === personId,
    );

  function meOf(persona: PersonaId): Me {
    const p = data.people.find(
      (x) => x.id === data.personas[persona].personId,
    )!;
    const { roles, scope } = PERSONA_ROLES[persona];
    return {
      personId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      delegation: data.delegations.find((d) => d.id === p.delegationId)!,
      roles,
      scope,
      canSeeHealth: true,
    };
  }

  function issue(persona: PersonaId, family = ++tokenSeq): Tokens {
    tokenSeq += 1;
    const accessToken = `fa-${tokenSeq}-${persona}`;
    const refreshToken = `fr-${tokenSeq}-${persona}`;
    access.set(accessToken, {
      persona,
      exp: Date.now() + FAKE_ACCESS_TTL_S * 1000,
    });
    refreshTokens.set(refreshToken, { persona, used: false, family });
    return { accessToken, refreshToken, expiresIn: FAKE_ACCESS_TTL_S };
  }

  /**
   * Un token de refresco de antes de reiniciar la app: el falso vive en
   * memoria y no lo conoce, pero si tiene SU forma (`fr-<n>-<persona>`) se
   * acepta, para que un probador no tenga que entrar cada vez que abre la app
   * (revisión A, hallazgo 5). Entra como uno nuevo, sin usar, de una familia
   * nueva; la numeración sigue por encima para no repetir tokens.
   */
  function adopt(refreshToken: string) {
    const m = /^fr-(\d{1,9})-([a-z]+)$/.exec(refreshToken);
    if (!m || !Object.prototype.hasOwnProperty.call(data.personas, m[2]))
      return undefined;
    tokenSeq = Math.max(tokenSeq, Number(m[1]));
    const t = { persona: m[2] as PersonaId, used: false, family: ++tokenSeq };
    refreshTokens.set(refreshToken, t);
    return t;
  }

  /** «m•••@ejemplo.org». */
  const mask = (email: string) => {
    const [user, domain] = email.split('@');
    return `${user.charAt(0)}•••@${domain}`;
  };

  const personasFor = (
    body: { email: string } | { dni: string },
  ): PersonaId[] =>
    'email' in body
      ? (FAKE_EMAILS[body.email.trim().toLowerCase()] ?? [])
      : FAKE_DNIS[body.dni.trim().toUpperCase()]
        ? [FAKE_DNIS[body.dni.trim().toUpperCase()]]
        : [];

  const identity = (body: { email: string } | { dni: string }) =>
    'email' in body
      ? `e:${body.email.trim().toLowerCase()}`
      : `d:${body.dni.trim().toUpperCase()}`;

  const persona = () => data.personas[current];
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

  // ── Grupos y fichas (plan 05) ─────────────────────────────────────────────

  const roles = () => PERSONA_ROLES[current].roles;
  const requireTeam = () => {
    if (!roles().some((r) => TEAM_ROLES.includes(r))) throw forbidden();
  };
  const myGroups = () =>
    data.groups.filter((g) => g.delegationId === delegationId());
  const groupOfPerson = (pid: string): FakeGroup | undefined =>
    myGroups().find((g) => g.participantIds.includes(pid));
  const looseOf = (pid: string) =>
    data.memberships.find(
      (m) => m.personId === pid && m.delegationId === delegationId(),
    );
  /**
   * Un participante con relación vigente con MI delegación, con grupo o sin
   * él; si no, `forbidden` (exista o no, y también si es un monitor).
   */
  const myParticipant = (pid: string): FakePerson => {
    const p = person(pid);
    if (
      !p ||
      controls.seasonClosed ||
      !data.profiles[pid] ||
      (!groupOfPerson(pid) && !looseOf(pid))
    ) {
      throw forbidden();
    }
    return p;
  };
  const photoUrlOf = (pid: string) => {
    const v = data.profiles[pid]?.photo;
    return v
      ? `https://fotos.ejemplo.org/v1/people/${pid}/photo?v=${v}`
      : undefined;
  };
  const groupSummaryOf = (g: FakeGroup) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    stage: g.stage,
    segment: g.segment,
    schoolLevels: g.schoolLevels,
    counts: {
      participants: controls.seasonClosed ? null : g.participantIds.length,
      monitors: g.monitorIds.length,
    },
  });
  /** El curso de la relación y, si no, el del grupo. */
  const levelOf = (p: FakePerson, g?: FakeGroup) =>
    schoolLevelFromText(p.schoolLevel ?? g?.schoolLevels[0]) ?? undefined;
  const rowOf = (p: FakePerson): ParticipantRow => {
    const g = groupOfPerson(p.id);
    const loose = g ? undefined : looseOf(p.id);
    const level = levelOf(p, g);
    const age = data.profiles[p.id]?.age;
    const photoUrl = photoUrlOf(p.id);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      ...(photoUrl ? { photoUrl } : {}),
      badges: { ...p.badges },
      ...(level ? { schoolLevel: level } : {}),
      ...(age !== undefined ? { age } : {}),
      groupId: g?.id ?? null,
      ...(loose ? { unassignedMembershipId: loose.id } : {}),
    };
  };
  const byLastName = (a: FakePerson, b: FakePerson) =>
    a.lastName.localeCompare(b.lastName, 'es') ||
    a.firstName.localeCompare(b.firstName, 'es');
  const eventById = (id: string) => data.events.find((e) => e.id === id);

  /** Una imagen abstracta (nunca una cara), estable por URL. */
  const abstractImage = (url: string) => {
    let h = 0;
    for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const hue2 = (hue + 140) % 360;
    const x = 20 + (h % 60);
    const y = 20 + ((h >> 8) % 60);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
      `<rect width="100" height="100" fill="hsl(${hue},55%,62%)"/>` +
      `<circle cx="${x}" cy="${y}" r="34" fill="hsl(${hue2},60%,45%)" fill-opacity="0.75"/>` +
      `<rect x="${100 - y}" y="${x}" width="46" height="46" rx="10" fill="hsl(${(hue + 60) % 360},70%,85%)" fill-opacity="0.6"/>` +
      `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const notify = () => listeners.forEach((l) => l());

  // Coordinación (plan 06): sus rutas viven en `coordination.ts`.
  const routesCtx = {
    data: () => data,
    gate: (route: RouteName, write?: boolean) => gate(route, write),
    persona: () => current,
    roles: () => PERSONA_ROLES[current].roles,
    teamScope: () => unionScope(TEAM_RELATIONS[current]),
    delegationId,
    now,
    nowIso,
    today,
    seen: seenClientIds,
    bumpWrites: (n = 1) => {
      writeCount += n;
    },
  };
  const coordination = createCoordinationRoutes(routesCtx);
  const mine = monitorRoutes(routesCtx); // Mis datos de monitor (plan 09).

  // Avisos en el móvil (plan 08): los móviles registrados, en `devices.ts`.
  const devices = fakeDevices.routes(gate, () => current, seenClientIds);
  // Pasar lista en un evento (plan 07): sus rutas viven en `events.ts`.
  const events = createEventRoutes({
    data: () => data,
    gate: (route, write) => gate(route, write),
    roles: () => PERSONA_ROLES[current].roles,
    delegationId,
    today,
    nowIso,
    rereadFails: () => controls.eventRereadFails,
    photoUrlOf,
    seen: seenClientIds,
    bumpWrites: (n = 1) => {
      writeCount += n;
    },
  });

  // Sin `...coordination` dentro del literal: Babel evaluaría los getters de
  // abajo (`writeCount` se quedaría en 0). Se juntan al final.
  const server: Omit<
    fakeDevices.Core<typeof coordination>,
    'getEvents' | 'getEventRoll' | 'saveEventRoll' | 'eventData' | MineKeys
  > = {
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
      codes.clear();
      badCodes.clear();
      devices.deviceRegistry.clear();
      notify();
    },
    issueSession(p) {
      return { ...issue(p), me: meOf(p) };
    },
    revokeAll() {
      access.clear();
      refreshTokens.forEach((t) => revokedFamilies.add(t.family));
    },

    async requestCode(body) {
      await gate('code', false, false);
      const parsed = CodeRequest.safeParse(body);
      if (!parsed.success) {
        throw validation('bad_body', 'Escribe un correo o un DNI válido');
      }
      const b = parsed.data;
      if ('email' in b && b.email.toLowerCase() === FAKE_RATE_LIMITED_EMAIL) {
        throw new ComunicaApiError(
          'rate_limited',
          'Demasiados intentos',
          429,
          undefined,
          20 * 60,
        );
      }
      codes.set(identity(b), now().getTime());
      // La MISMA respuesta exista o no.
      if ('email' in b) return { sentTo: mask(b.email.trim().toLowerCase()) };
      const found = personasFor(b)[0];
      return {
        sentTo: found
          ? mask(
              Object.keys(FAKE_EMAILS).find((e) =>
                FAKE_EMAILS[e].includes(found),
              )!,
            )
          : 'el correo de tu ficha',
      };
    },

    async verify(body) {
      await gate('verify', false, false);
      const parsed = VerifyRequest.safeParse(body);
      if (!parsed.success) throw validation('bad_code', 'Código incorrecto');
      const b = parsed.data;
      let candidates: PersonaId[];
      if ('linkToken' in b) {
        if (!(b.linkToken in FAKE_LINK_TOKENS)) {
          throw validation('link_expired', 'El enlace no vale');
        }
        const p = FAKE_LINK_TOKENS[b.linkToken];
        if (!p) throw validation('link_expired', 'El enlace ha caducado');
        candidates = [p];
      } else {
        const id = identity(b);
        if ((badCodes.get(id) ?? 0) >= MAX_BAD_CODES) {
          throw new ComunicaApiError(
            'rate_limited',
            'Bloqueado',
            429,
            'blocked',
            3600,
          );
        }
        const issuedAt = codes.get(id);
        if (!issuedAt || now().getTime() - issuedAt > CODE_TTL_MS) {
          throw validation('code_expired', 'El código ha caducado');
        }
        candidates = personasFor(b);
        if (b.code !== FAKE_CODE || candidates.length === 0) {
          badCodes.set(id, (badCodes.get(id) ?? 0) + 1);
          throw validation('bad_code', 'Código incorrecto');
        }
      }
      if (b.personId) {
        const chosen = personaOf(b.personId);
        if (!chosen || !candidates.includes(chosen)) {
          throw validation('bad_code', 'Esa ficha no es de este correo');
        }
        candidates = [chosen];
      }
      if (candidates.length > 1) {
        return VerifyResponse.parse({
          choose: candidates.map((c) => {
            const m = meOf(c);
            return {
              personId: m.personId,
              name: m.name,
              delegation: m.delegation.name,
            };
          }),
        });
      }
      if (!('linkToken' in b)) codes.delete(identity(b));
      return VerifyResponse.parse({
        ...issue(candidates[0]),
        me: meOf(candidates[0]),
      });
    },

    async refresh(refreshToken) {
      await gate('refresh', false, false);
      const t = refreshTokens.get(refreshToken) ?? adopt(refreshToken);
      if (!t || revokedFamilies.has(t.family)) {
        throw new ComunicaApiError('unauthenticated', 'Sesión revocada', 401);
      }
      if (t.used) {
        // Uno reutilizado revoca la sesión entera.
        revokedFamilies.add(t.family);
        throw new ComunicaApiError('unauthenticated', 'Sesión revocada', 401);
      }
      t.used = true;
      return issue(t.persona, t.family);
    },

    async logout(refreshToken) {
      await gate('refresh', false, false);
      const t = refreshTokens.get(refreshToken);
      if (t) revokedFamilies.add(t.family);
    },

    async exchange(body) {
      await gate('exchange', false, false);
      const parsed = ExchangeRequest.safeParse(body);
      const key = parsed.success
        ? 'magic' in parsed.data
          ? parsed.data.magic
          : parsed.data.token
        : '';
      const p = FAKE_PLUGIN_LINKS[key];
      if (!p) throw validation('link_expired', 'El enlace ha caducado');
      return VerifyResponse.parse({ ...issue(p), me: meOf(p) });
    },

    async webPass(body) {
      await gate('webPass');
      const parsed = WebPassRequest.safeParse(body);
      if (!parsed.success)
        throw validation('bad_destination', 'Destino no válido');
      const d = parsed.data;
      // Sin red de verdad: la página real del plugin, SIN pase (enseña su
      // pantalla de entrada). Con el servidor de verdad llevaría un
      // `acceso_magico` de 2 minutos.
      const q = (['internalpage', 'action', 'id', 'from'] as const)
        .filter((k) => d[k])
        .map((k) => `${k}=${encodeURIComponent(d[k] as string)}`)
        .join('&');
      return WebPass.parse({
        url: `https://comunica.movimientoconsolacion.com/ap/?app=1&${q}`,
        expiresAt: new Date(now().getTime() + 2 * 60_000)
          .toISOString()
          .replace(/\.\d{3}Z$/, 'Z'),
      });
    },

    async getMe() {
      await gate('me');
      return MeResponse.parse({ generatedAt: nowIso(), me: meOf(current) });
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
          ...groupSummaryOf(g),
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
        hiddenGroups: data.hiddenGroups[did] ?? 0,
        participantsWithoutGroup: controls.seasonClosed
          ? 0
          : data.memberships.filter((m) => m.delegationId === did).length,
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
      const meeting = pendingMeetingOf(data, did, now());
      const isCoordination =
        PERSONA_ROLES[current].roles.includes('coordination');
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
          isCoordination && meeting
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
      // Del futuro, solo la próxima si aún no ha llegado ninguna (`futuras`).
      const ofEvent = data.sessions.filter((x) => x.eventId === s.eventId);
      if (!canMarkSession(s, ofEvent, now())) {
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
        // Quitar marcas (`null`) solo vale sobre una lista que ya existe:
        // dejarla a cero sí se puede (`desmarcar`); crearla vacía, no.
        const marked = Object.values(write.marks).some((m) => m !== null);
        if (
          !marked &&
          !(existing?.status === 'taken' && Object.keys(write.marks).length > 0)
        ) {
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
        data.rollTakers[`${sid}:${gid}`] = persona().personId;
        for (const [pid, mark] of Object.entries(write.marks)) {
          if (mark === null) {
            // Quitar la marca borra la asistencia (y su motivo). Sin marca
            // guardada no hay nada que borrar: no se escribe.
            if (!(pid in roll.marks)) continue;
            delete roll.marks[pid];
            delete roll.notes[pid];
            writeCount += 1;
            continue;
          }
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
      requireTeam();
      if (!meOf(current).canSeeHealth) throw forbidden();
      myParticipant(personId);
      // Con «datos de salud» a «No», la ficha enseña IGUAL el texto (`salud-no`
      // = «sí, en la ficha», 21/10): lo que se apaga es la marca de las listas
      // (`badges.healthNote`, ver fixtures).
      return HealthNote.parse({
        generatedAt: nowIso(),
        personId,
        items: (data.health[personId] ?? []).filter((i) => i.text.trim()),
      });
    },

    async getPeople() {
      await gate('people');
      requireTeam();
      const did = delegationId();
      const ids = controls.seasonClosed
        ? []
        : [
            ...myGroups().flatMap((g) => g.participantIds),
            ...data.memberships
              .filter((m) => m.delegationId === did)
              .map((m) => m.personId),
          ];
      return PeopleIndex.parse({
        generatedAt: nowIso(),
        season: data.season,
        seasonClosed: controls.seasonClosed,
        people: ids
          .map((id) => person(id)!)
          .sort(byLastName)
          .map(rowOf),
      });
    },

    async getGroupDetail(gid) {
      await gate('group');
      requireTeam();
      const g = myGroup(gid);
      return GroupDetail.parse({
        generatedAt: nowIso(),
        group: groupSummaryOf(g),
        monitors: g.monitorIds
          .map((id) => person(id)!)
          .sort(byLastName)
          .map((m) => ({
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
          })),
        participants: controls.seasonClosed
          ? []
          : g.participantIds
              .map((id) => person(id)!)
              .sort(byLastName)
              .map(rowOf),
      });
    },

    async getPerson(pid) {
      await gate('person');
      requireTeam();
      const p = myParticipant(pid);
      const prof = data.profiles[pid];
      const g = groupOfPerson(pid);
      const level = levelOf(p, g);
      const photoUrl = photoUrlOf(pid);
      // La asistencia: las sesiones del evento semanal de su etapa.
      let attendance = null;
      if (g?.stage) {
        const sessions = data.sessions.filter(
          (x) =>
            x.delegationId === g.delegationId &&
            x.kind === 'weekly' &&
            x.stage === g.stage,
        );
        const marks: Record<string, Mark> = {};
        const reasons: Record<string, string> = {};
        for (const x of sessions) {
          const r = rollOf(x.id, g.id);
          marks[x.id] = r?.status === 'taken' ? markOf(r, pid) : null;
          if (r?.notes[pid]) reasons[x.id] = r.notes[pid];
        }
        attendance = {
          sessions: sessions.map(sessionSummary),
          marks,
          reasons,
        };
      }
      const today0 = today();
      return ParticipantProfile.parse({
        generatedAt: nowIso(),
        person: {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          fullName: `${p.firstName} ${p.lastName}`,
          ...(photoUrl ? { photoUrl } : {}),
          ...(prof.age !== undefined ? { age: prof.age } : {}),
          ...(level ? { schoolLevel: level } : {}),
        },
        group: g ? groupSummaryOf(g) : null,
        phones: {
          ...(prof.ownPhone ? { own: prof.ownPhone } : {}),
          ...(prof.emergency ? { emergency: prof.emergency } : {}),
        },
        guardians: prof.guardians.map((x) => ({
          id: x.id,
          fullName: `${x.firstName} ${x.lastName}`,
          firstName: x.firstName,
          relationship: x.relationship,
          ...(x.phone ? { phone: x.phone } : {}),
          ...(x.email ? { email: x.email } : {}),
        })),
        consents: prof.consents,
        badges: { ...p.badges },
        scarf: prof.scarf,
        events: (data.personEvents[pid] ?? []).flatMap((pe) => {
          const e = eventById(pe.eventId);
          if (!e) return [];
          return [
            {
              eventId: e.id,
              name: e.name,
              startsAt: madridInstant(e.startDay, '10:00'),
              endsAt: madridInstant(e.endDay, '18:00'),
              status: pe.status,
              ...(pe.reason ? { reason: pe.reason } : {}),
            },
          ];
        }),
        notices: (data.notices[pid] ?? []).filter((n) => n.date <= today0),
        noticeLimit: 3,
        attendance,
      });
    },

    async getPersonal(pid) {
      await gate('personal');
      requireTeam();
      myParticipant(pid);
      const prof = data.profiles[pid];
      const address = [
        prof.street,
        [prof.postcode, prof.city].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ');
      return PersonalData.parse({
        generatedAt: nowIso(),
        personId: pid,
        ...(prof.birthDate ? { birthDate: prof.birthDate } : {}),
        ...(prof.document ? { document: prof.document } : {}),
        ...(prof.street ? { address } : {}),
        ...(prof.city ? { city: prof.city } : {}),
        ...(prof.school ? { school: prof.school } : {}),
        ...(prof.email ? { email: prof.email } : {}),
        ...(prof.size ? { size: prof.size } : {}),
        ...(prof.stageLabel ? { stageLabel: prof.stageLabel } : {}),
        ...(prof.comLevelLabel ? { comLevelLabel: prof.comLevelLabel } : {}),
        ...(prof.personNumber ? { personNumber: prof.personNumber } : {}),
      });
    },

    async createNotice(pid, body) {
      await gate('createNotice', true);
      requireTeam();
      const parsed = NoticeWrite.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'El aviso no tiene la forma esperada');
      const w = parsed.data;
      const repeated = seenClientIds.get(w.clientId);
      if (repeated) return NoticeWriteResult.parse(repeated);
      myParticipant(pid);
      if (!w.reason.trim()) {
        throw validation('empty_reason', 'Escribe qué ha pasado');
      }
      const day = today();
      const notice = {
        id: `f-avi-n${writeCount + 1}-${pid}`,
        // Una fecha futura se recorta a hoy (hora de Madrid).
        date: w.date > day ? day : w.date,
        reason: w.reason.trim(),
        placedBy: me().firstName,
        familyNotified: w.familyNotified,
      };
      data.notices[pid] = [...(data.notices[pid] ?? []), notice];
      writeCount += 1;
      const result = NoticeWriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
        crmIds: [notice.id],
        notice,
      });
      seenClientIds.set(w.clientId, result);
      return result;
    },

    async setScarf(pid, body) {
      await gate('setScarf', true);
      requireTeam();
      const parsed = ScarfWrite.safeParse(body);
      if (!parsed.success) throw validation('bad_body', 'Pañuelo no válido');
      const w = parsed.data;
      const repeated = seenClientIds.get(w.clientId);
      if (repeated) return WriteResult.parse(repeated);
      myParticipant(pid);
      if (data.profiles[pid].scarf !== w.scarf) {
        data.profiles[pid].scarf = w.scarf;
        writeCount += 1;
      }
      const result = WriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
      });
      seenClientIds.set(w.clientId, result);
      return result;
    },

    async assignGroup(mid, body) {
      await gate('assignGroup', true);
      const parsed = MembershipGroupWrite.safeParse(body);
      if (!parsed.success) throw validation('bad_body', 'Grupo no válido');
      const w = parsed.data;
      const repeated = seenClientIds.get(w.clientId);
      if (repeated) return WriteResult.parse(repeated);
      // Solo coordinación (acompañamiento no), grupo y relación de su delegación.
      if (!roles().includes('coordination')) throw forbidden();
      const m = data.memberships.find(
        (x) => x.id === mid && x.delegationId === delegationId(),
      );
      // La de un MONITOR sin grupo (plan 06): misma ruta, otra relación.
      const mm = data.monitorMemberships.find(
        (x) => x.id === mid && x.delegationId === delegationId(),
      );
      if (!m && !mm) throw forbidden();
      const g = myGroup(w.groupId);
      if (controls.seasonClosed) {
        throw validation('season_closed', 'El curso está cerrado');
      }
      if (m) {
        g.participantIds.push(m.personId);
        data.memberships = data.memberships.filter((x) => x.id !== mid);
      } else if (mm) {
        g.monitorIds.push(mm.personId);
        data.monitorMemberships = data.monitorMemberships.filter(
          (x) => x.id !== mid,
        );
        const prof = data.monitorProfiles[mm.personId];
        if (prof) prof.groupsSince[g.id] = today();
      }
      writeCount += 1;
      const result = WriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
        crmIds: [mid],
      });
      seenClientIds.set(w.clientId, result);
      return result;
    },

    photoSource(url) {
      return { uri: abstractImage(url), cacheKey: url };
    },
  };
  Object.defineProperty(server, 'eventData', {
    get: () => events.eventData,
  });
  return Object.assign(
    server as typeof server & { eventData: FakeEventData },
    coordination,
    devices,
    mine,
    {
      getEvents: events.getEvents,
      getEventRoll: events.getEventRoll,
      saveEventRoll: events.saveEventRoll,
    },
  );
}
