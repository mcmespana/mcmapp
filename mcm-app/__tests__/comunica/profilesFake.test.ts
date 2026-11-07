/**
 * «A quién se ve» (plan 11, tarea 1 y 2): el contrato y el servidor falso.
 *
 *   · `GET /v1/me/profiles`: quien ha entrado y sus hijos; uno sin nombre sale igual (nombres `null`).
 *   · Si el CRM no contesta a los hijos, 503: NUNCA `children: []`.
 *   · Sin `fresh` se sabe lo de antes; con `fresh=1` aparece el hijo recién vinculado.
 *   · `allowedProfile`: la barrera de las rutas de familias (403 con un `pid` ajeno, nunca 404).
 *   · `Me` lleva `guardian` y `member` (familiar con hijos; monitora con una hija; miembro sin hijos).
 */
import { createFakeServer } from '@/services/comunica/fake';
import {
  allowedProfile,
  FAKE_NEW_CHILD,
  type ProfilesCtx,
} from '@/services/comunica/fake/profiles';
import { ComunicaApiError } from '@/services/comunica/client';
import { MyProfiles, ProfileRef, ROUTES } from '@/services/comunica/contract';
import type { PersonaId } from '@/services/comunica/fake/fixtures';

const server = (persona: PersonaId, patch = {}) =>
  createFakeServer({ latencyMs: 0, persona, ...patch });
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => `${e.code}:${e.status}`,
  );

describe('contrato', () => {
  it('la ruta está en el catálogo, con persist (son nombres de sus propios hijos y nada sensible)', () => {
    expect(ROUTES.myProfiles).toMatchObject({
      method: 'GET',
      path: '/v1/me/profiles',
      persist: true,
    });
  });
  it('ProfileRef admite nombres y género null, y rechaza lo demás', () => {
    expect(
      ProfileRef.safeParse({
        id: 'a',
        firstName: null,
        lastName: null,
        gender: null,
      }).success,
    ).toBe(true);
    expect(
      ProfileRef.safeParse({
        id: 'a',
        firstName: 'x',
        lastName: 'y',
        gender: 'otro',
      }).success,
    ).toBe(false);
    expect(
      ProfileRef.safeParse({
        id: '',
        firstName: 'x',
        lastName: 'y',
        gender: null,
      }).success,
    ).toBe(false);
    expect(
      MyProfiles.safeParse({
        generatedAt: '2026-10-31T10:00:00Z',
        self: { id: 'a', firstName: 'x', lastName: 'y', gender: null },
        children: [],
      }).success,
    ).toBe(true);
  });
});

describe('GET /v1/me/profiles en el falso', () => {
  it('un familiar con dos hijos: uno con nombre y uno sin él', async () => {
    const p = await server('family').getMyProfiles();
    expect(p.self).toMatchObject({
      firstName: 'Marta',
      lastName: 'Villarroya Pons',
      gender: 'female',
    });
    expect(p.children).toHaveLength(2);
    expect(p.children[0]).toMatchObject({
      firstName: 'Lucía',
      gender: 'female',
    });
    expect(p.children[1]).toMatchObject({
      firstName: null,
      lastName: null,
      gender: null,
    });
  });
  it('con uno, con ninguno, la monitora con una hija y el miembro sin hijos', async () => {
    expect(
      (await server('familyOne').getMyProfiles()).children.map(
        (c) => c.firstName,
      ),
    ).toEqual(['Nicolás']);
    expect((await server('familyNone').getMyProfiles()).children).toEqual([]);
    expect((await server('memberNoKids').getMyProfiles()).children).toEqual([]);
    expect((await server('monitor').getMyProfiles()).children).toEqual([]);
    expect(
      (await server('monitorMom').getMyProfiles()).children.map(
        (c) => c.firstName,
      ),
    ).toEqual(['Inés']);
  });
  it('el 503 de los hijos NUNCA es una lista vacía', async () => {
    const s = server('family', { profilesDown: true });
    expect(await code(s.getMyProfiles())).toBe('crm_unavailable:503');
    s.setControls({ profilesDown: false });
    expect((await s.getMyProfiles()).children).toHaveLength(2);
  });
  it('«un hijo nuevo»: sin `fresh` no aparece; con `fresh=1`, sí, y se queda', async () => {
    const s = server('family', { newChildNext: true });
    expect((await s.getMyProfiles()).children).toHaveLength(2);
    expect((await s.getMyProfiles()).children).toHaveLength(2);
    const fresh = await s.getMyProfiles({ fresh: true });
    expect(fresh.children.map((c) => c.id)).toContain(FAKE_NEW_CHILD.id);
    expect((await s.getMyProfiles()).children).toHaveLength(3);
    s.reset(); // vuelve a los datos de partida y a los mandos por defecto (también la persona)
    s.setControls({ persona: 'family', latencyMs: 0 });
    expect((await s.getMyProfiles()).children).toHaveLength(2);
  });
});

describe('Me lleva guardian y member', () => {
  it('familiar con hijos: guardian; familiar sin hijos: nada; monitora con una hija: monitor, member y guardian; miembro: member', async () => {
    expect((await server('family').getMe()).me.roles).toEqual(['guardian']);
    expect((await server('familyNone').getMe()).me.roles).toEqual([]);
    expect((await server('monitorMom').getMe()).me.roles).toEqual([
      'monitor',
      'member',
      'guardian',
    ]);
    expect((await server('memberNoKids').getMe()).me.roles).toEqual(['member']);
  });
});

describe('allowedProfile: la barrera de las rutas /profiles/:pid', () => {
  const ctxOf = (persona: PersonaId): ProfilesCtx => {
    const s = server(persona);
    return {
      data: () => s.data,
      gate: async () => {},
      persona: () => persona,
      nowIso: () => '2026-10-31T10:00:00Z',
      controls: () => ({ profilesDown: false, newChildNext: false }),
    };
  };
  it('uno mismo y un hijo, sí; cualquier otro, forbidden (403), nunca 404', () => {
    const ctx = ctxOf('family');
    const self = ctx.data().personas.family.personId;
    expect(allowedProfile(ctx, self)).toEqual({ id: self, self: true });
    expect(allowedProfile(ctx, 'f-hijo-lucia')).toEqual({
      id: 'f-hijo-lucia',
      self: false,
    });
    for (const pid of [
      'f-hijo-nico',
      'f-hija-ines',
      'no-existe',
      '',
      "x' OR '1'='1",
    ]) {
      let err: unknown;
      try {
        allowedProfile(ctx, pid);
      } catch (e) {
        err = e;
      }
      expect(err).toMatchObject({ code: 'forbidden', status: 403 });
    }
  });
  it('quien no tiene hijos solo puede verse a sí mismo', () => {
    const ctx = ctxOf('familyNone');
    expect(() => allowedProfile(ctx, 'f-hijo-lucia')).toThrow();
    expect(
      allowedProfile(ctx, ctx.data().personas.familyNone.personId).self,
    ).toBe(true);
  });
});
