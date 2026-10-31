// services/comunica/fake/profiles.ts
//
// Familias en el servidor falso (plan 11 «Datos»): `GET /v1/me/profiles`, la
// convención `/v1/profiles/:pid/…` con su comprobación y el calendario que el
// 11 adelanta del 16. Va aparte de `index.ts`, como Coordinación o los
// móviles, y comparte con él el estado a través de `ctx`. Se porta como el
// plugin (`inc/stic-family.php`):
//
//   · Vigencia, UNA regla (`sticpa_relacion_vigente`): empezada (o sin inicio)
//     y fin vacío, `0000-00-00` o de hoy en adelante. El plugin la incumplía
//     al decidir si eras familiar (`check_user_adult`); aquí no.
//   · `pid` permitido (`sticpa_allowed_profile`): quien ha entrado o un hijo
//     vigente, comprobado en CADA petición. Si no, 403 (nunca 404), exista o no.
//   · Con el mando «el CRM no contesta a los hijos», `crm_unavailable`: nunca
//     `children: []`. Un hijo sin nombre sale igual, con nombres `null`.
//   · Lo que no es `fresh` sale de la «caché del servidor» (la sesión del
//     plugin): el mando «un hijo nuevo» llega con el siguiente `fresh=1`.

import {
  CalendarData,
  type CalendarEvent,
  type CalendarSession,
  type Mark,
  MyProfiles,
  type ProfileRef,
  type RouteName,
} from '../contract';
import {
  ComunicaApiError,
  type ComunicaApi,
  type ReadOptions,
} from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { NEW_CHILD, type FakeFamilyLink } from './fixturesFamilies';
import { addDays, madridInstant } from '@/utils/comunica/madrid';

export interface ProfilesCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  /** La persona de prueba de la petición en curso. */
  persona: () => PersonaId;
  /** Los mandos de familias. */
  controls: () => { childrenDown: boolean; newChild: boolean };
  today: () => string;
  nowIso: () => string;
}

/** Las rutas de este fichero. */
export type ProfileKeys = 'getMyProfiles' | 'getProfileCalendar';
type ProfilesApi = Pick<ComunicaApi, ProfileKeys>;

/** Lo que el falso añade para los tests y para `webPass`. */
export interface ProfilesFake {
  /** ¿Puede quien llama ver a `pid`? (`sticpa_allowed_profile`). */
  allowedProfile(pid: string): boolean;
  /** Olvida lo que «recordaba» de cada persona (`reset()` del falso). */
  resetProfiles(): void;
}

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const crmDown = () =>
  new ComunicaApiError('crm_unavailable', 'El CRM no responde', 503);

const EMPTY_END = /^(|0000-00-00.*)$/;

/**
 * `sticpa_relacion_vigente`: empezada (o sin inicio) y sin terminar (fin vacío,
 * `0000-00-00` o de hoy en adelante). Fechas `YYYY-MM-DD`, en Madrid.
 */
export function isRelationActive(
  link: Pick<FakeFamilyLink, 'startDate' | 'endDate'>,
  today: string,
): boolean {
  const start = link.startDate?.trim() || null;
  if (start && !start.startsWith('0000') && start.slice(0, 10) > today) {
    return false;
  }
  const end = link.endDate?.trim() ?? '';
  if (!EMPTY_END.test(end) && end.slice(0, 10) < today) return false;
  return true;
}

/** Los hijos vigentes de una persona (y el «nuevo» del mando). */
export function activeChildIds(
  data: FakeData,
  personId: string,
  today: string,
  withNew = false,
): string[] {
  const ids = (data.families[personId] ?? [])
    .filter((l) => isRelationActive(l, today))
    .map((l) => l.childId);
  return withNew ? [...ids, NEW_CHILD.id] : ids;
}

export function profilesRoutes(ctx: ProfilesCtx): ProfilesApi & ProfilesFake {
  /** Lo que «recuerda» el servidor de cada persona (la sesión del plugin). */
  const cache = new Map<string, string[]>();

  const meId = () => ctx.data().personas[ctx.persona()].personId;
  const childrenNow = (personId: string) =>
    activeChildIds(ctx.data(), personId, ctx.today(), ctx.controls().newChild);

  const ref = (id: string): ProfileRef => {
    const p = ctx.data().people.find((x) => x.id === id);
    return {
      id,
      firstName: p?.firstName.trim() || null,
      lastName: p?.lastName.trim() || null,
      gender: ctx.data().genders[id] ?? null,
    };
  };

  /** Por nombre (los sin nombre, al final), como la barra del plugin. */
  const byName = (a: ProfileRef, b: ProfileRef) =>
    !a.firstName !== !b.firstName
      ? a.firstName
        ? -1
        : 1
      : `${a.firstName ?? ''} ${a.lastName ?? ''}`.localeCompare(
          `${b.firstName ?? ''} ${b.lastName ?? ''}`,
          'es',
        );

  function allowedProfile(pid: string): boolean {
    const me = meId();
    if (pid === me) return true;
    if (ctx.controls().childrenDown) throw crmDown();
    return childrenNow(me).includes(pid);
  }

  /** `pid` permitido o 403 (exista o no). */
  const requireProfile = (pid: string) => {
    if (!allowedProfile(pid)) throw forbidden();
  };

  return {
    allowedProfile,
    resetProfiles: () => cache.clear(),

    async getMyProfiles(opts?: ReadOptions) {
      await ctx.gate('myProfiles');
      if (ctx.controls().childrenDown) throw crmDown();
      const me = meId();
      if (opts?.fresh || !cache.has(me)) cache.set(me, childrenNow(me));
      return MyProfiles.parse({
        generatedAt: ctx.nowIso(),
        self: ref(me),
        children: cache.get(me)!.map(ref).sort(byName),
      });
    },

    async getProfileCalendar(pid: string) {
      await ctx.gate('profileCalendar');
      requireProfile(pid);
      return CalendarData.parse({
        generatedAt: ctx.nowIso(),
        ...calendarFor(ctx.data(), pid, ctx.today()),
      });
    },
  };
}

// ── El calendario de cada perfil (relativo a hoy, para que no caduque) ─────

type Calendar = Omit<CalendarData, 'generatedAt'>;

const EMPTY: Calendar = { sessions: [], registeredEvents: [], openEvents: [] };

/** Un evento con id de forma «de CRM» (hexadecimal): vale como destino. */
const ev = (
  n: number,
  name: string,
  today: string,
  from: number,
  to: number | null = null,
): CalendarEvent => ({
  id: `f-ca1e-${String(n).padStart(4, '0')}`,
  name,
  startDate: addDays(today, from),
  endDate: to === null ? null : addDays(today, to),
});

/** Los sábados de un curso semanal: pasados con marca, futuros sin ella. */
function weekly(
  event: CalendarEvent,
  today: string,
  marks: Mark[],
  upcoming: number,
): CalendarSession[] {
  // El sábado anterior o igual a hoy (`addDays` acepta negativos).
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const lastSat = addDays(today, -((dow + 1) % 7));
  const out: CalendarSession[] = [];
  const total = marks.length + upcoming;
  for (let i = 0; i < total; i++) {
    // Las marcadas acaban en ese sábado; las de después, una por semana.
    const day = addDays(lastSat, (i - (marks.length - 1)) * 7);
    const n = i + 1;
    out.push({
      id: `${event.id}-s${n}`,
      name: `Sesión ${n}`,
      eventId: event.id,
      eventName: event.name,
      startsAt: madridInstant(day, '17:30'),
      endsAt: madridInstant(day, '19:00'),
      attendance: i < marks.length ? marks[i] : null,
    });
  }
  return out;
}

function calendarFor(data: FakeData, pid: string, today: string): Calendar {
  const ids = data.personas;
  const course = ev(1, 'Catequesis COM · Curso 2026-2027', today, -60, 220);
  switch (pid) {
    // Lucía (hija de la familia de dos): abiertos, con plaza y sesiones.
    case 'f-fam-lucia': {
      const trip = ev(7, 'Ruta por la sierra', today, -1, -1);
      return {
        sessions: [
          ...weekly(
            course,
            today,
            ['yes', 'yes', 'no_unjustified', 'partial', 'yes', null],
            3,
          ),
          // Un día de excursión sin hora (00:00): «Todo el día».
          {
            id: `${trip.id}-s1`,
            name: 'Salida',
            eventId: trip.id,
            eventName: trip.name,
            startsAt: madridInstant(trip.startDate, '00:00'),
            endsAt: null,
            attendance: 'yes',
          },
        ],
        registeredEvents: [course, trip],
        openEvents: [
          ev(2, 'Convivencia de otoño COM', today, 9, 10),
          ev(3, 'Excursión al Moncayo', today, 23),
          ev(4, 'Campamento de Navidad', today, 55, 58),
          ev(5, 'Concierto solidario', today, 2),
          ev(6, 'Torneo de juegos de mesa', today, 12),
          ev(8, 'Fiesta de fin de curso', today, 230),
          // Ya empezado: no sale en «Próximas actividades».
          ev(9, 'Cuaresma en familia', today, -3, 30),
        ],
      };
    }
    case 'f-fam-pablo':
      return { ...EMPTY, openEvents: [ev(10, 'Gymkana MIC', today, 6)] };
    case ids.monitorParent?.personId:
      return {
        ...EMPTY,
        openEvents: [
          ev(11, 'Encuentro de monitores', today, 12, 13),
          ev(12, 'Formación MAT · fin de semana', today, 30, 31),
        ],
      };
    case 'f-fam-ines':
      return {
        ...EMPTY,
        openEvents: [ev(13, 'Fiesta de las familias MIC', today, 5)],
      };
    case ids.member?.personId:
      return {
        ...EMPTY,
        openEvents: [
          ev(14, 'Retiro de Adviento', today, 35, 36),
          ev(15, 'Pascua joven', today, 150, 153),
        ],
      };
    case ids.monitor?.personId:
    case ids.coordination?.personId:
      return {
        ...EMPTY,
        openEvents: [ev(11, 'Encuentro de monitores', today, 12, 13)],
      };
    // El hijo sin nombre, quien no tiene nada: vacío (la agenda no se pinta).
    default:
      return EMPTY;
  }
}
