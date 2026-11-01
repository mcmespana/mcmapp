// services/comunica/fake/profiles.ts
//
// «A quién se ve» en el servidor falso (plan 11, familias). Va aparte de `index.ts` y comparte con él el estado a través de `ctx`. Se porta como el
// servidor de verdad (`comunicaMiddleware:src/app/profiles.ts`):
//
//   · `GET /v1/me/profiles`: quien ha entrado y sus hijos. Un hijo sin nombre sale igual, con nombres `null`. Si el CRM no contesta a los hijos
//     (mando `profilesDown`), `crm_unavailable`: NUNCA `children: []`.
//   · Sin `fresh`, lo que ya se sabía; con `fresh=1` se vuelve a mirar «quiénes son los míos» y aparece el hijo recién vinculado (mando `newChildNext`).
//   · `allowedProfile(ctx, pid)` es LA barrera de todas las rutas `/profiles/:pid/…` (planes 12-16): `pid` es quien ha entrado o uno de sus hijos; si no,
//     `forbidden` (403, nunca 404). Cada ruta nueva del falso la llama la primera.
//
// El estado vive POR datos (`WeakMap`): `reset()` del falso lo deja como al principio.

import { MyProfiles, type ProfileRef, type RouteName } from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';

export interface ProfilesCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  nowIso: () => string;
  controls: () => { profilesDown: boolean; newChildNext: boolean };
}

export type ProfileKeys = 'getMyProfiles';
type ProfilesApi = Pick<ComunicaApi, ProfileKeys>;

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);

/** Los hijos de cada persona de prueba. Uno sin nombre (para ver «Participante»), uno con apellidos largos (el nombre corto). */
export const FAKE_CHILDREN: Partial<Record<PersonaId, ProfileRef[]>> = {
  family: [
    {
      id: 'f-hijo-lucia',
      firstName: 'Lucía',
      lastName: 'Messeguer Villarroya',
      gender: 'female',
    },
    { id: 'f-hijo-sin-nombre', firstName: null, lastName: null, gender: null },
  ],
  familyOne: [
    {
      id: 'f-hijo-nico',
      firstName: 'Nicolás',
      lastName: 'Soler Gil',
      gender: 'male',
    },
  ],
  monitorMom: [
    {
      id: 'f-hija-ines',
      firstName: 'Inés',
      lastName: 'Gil Mas',
      gender: 'female',
    },
  ],
};

/** El hijo que «aparece» con el mando `newChildNext` en la siguiente lectura con `fresh=1`. */
export const FAKE_NEW_CHILD: ProfileRef = {
  id: 'f-hijo-nuevo',
  firstName: 'Mateo',
  lastName: 'Villarroya Pons',
  gender: 'male',
};

const SELF_GENDER: Partial<Record<PersonaId, ProfileRef['gender']>> = {
  family: 'female',
  familyOne: 'male',
  familyNone: 'female',
  monitorMom: 'female',
  memberNoKids: 'male',
};

interface State {
  /** Lo que el falso «sabe» de cada persona hasta la próxima lectura con `fresh`. */
  known: Map<PersonaId, ProfileRef[]>;
}
const states = new WeakMap<FakeData, State>();

function stateOf(ctx: ProfilesCtx): State {
  const d = ctx.data();
  let s = states.get(d);
  if (!s) {
    s = { known: new Map() };
    states.set(d, s);
  }
  return s;
}

/** Quien ha entrado, como lo ve el servidor (`self`). */
export function selfRef(ctx: ProfilesCtx): ProfileRef {
  const persona = ctx.persona();
  const person = ctx
    .data()
    .people.find((p) => p.id === ctx.data().personas[persona].personId)!;
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    gender: SELF_GENDER[persona] ?? null,
  };
}

/** Los hijos de quien ha entrado; `fresh` vuelve a mirar (y con el mando, trae al recién vinculado). */
export function childrenOf(ctx: ProfilesCtx, fresh = false): ProfileRef[] {
  const s = stateOf(ctx);
  const persona = ctx.persona();
  const have = s.known.get(persona);
  if (have && !fresh) return have;
  const base = FAKE_CHILDREN[persona] ?? [];
  const now =
    ctx.controls().newChildNext && fresh && persona === 'family'
      ? [...base, FAKE_NEW_CHILD]
      : (have ?? base);
  s.known.set(persona, now.length ? now : base);
  return s.known.get(persona)!;
}

/**
 * LA BARRERA de las rutas de familias: `pid` es quien ha entrado o uno de sus hijos. Se mira siempre sobre lo que el falso sabe AHORA (sin `fresh`).
 * Si no, `forbidden` (403, nunca 404). Devuelve a quién se ve y si es él mismo.
 */
export function allowedProfile(
  ctx: ProfilesCtx,
  pid: string,
): { id: string; self: boolean } {
  const me = selfRef(ctx);
  if (pid === me.id) return { id: pid, self: true };
  if (childrenOf(ctx).some((c) => c.id === pid))
    return { id: pid, self: false };
  throw forbidden();
}

export function profilesRoutes(ctx: ProfilesCtx): ProfilesApi {
  return {
    async getMyProfiles(opts) {
      await ctx.gate('myProfiles');
      // El CRM no contesta a los hijos: error, nunca una lista vacía que no se ha podido resolver.
      if (ctx.controls().profilesDown)
        throw new ComunicaApiError(
          'crm_unavailable',
          'El CRM no responde',
          503,
        );
      return MyProfiles.parse({
        generatedAt: ctx.nowIso(),
        self: selfRef(ctx),
        children: childrenOf(ctx, opts?.fresh === true),
      });
    },
  };
}
