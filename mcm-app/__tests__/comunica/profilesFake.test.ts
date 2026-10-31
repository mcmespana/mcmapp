/**
 * Familias en el contrato y en el servidor falso (plan 11, tareas 1 y 2):
 * `GET /v1/me/profiles`, la convención `/v1/profiles/:pid/…` y el calendario
 * que el 11 adelanta del 16.
 */
import {
  CalendarData,
  MyProfiles,
  PROFILE_PATH_PREFIX,
  ProfileRef,
  ROUTES,
} from '@/services/comunica/contract';
import { ComunicaApiError } from '@/services/comunica/client';
import { createFakeServer, type FakeServer } from '@/services/comunica/fake';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import {
  activeChildIds,
  isRelationActive,
} from '@/services/comunica/fake/profiles';
import { isTeamPath } from '@/services/comunica/delegation';

const server = (persona: PersonaId, patch = {}) =>
  createFakeServer({ latencyMs: 0, persona, ...patch });

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => e.code,
  );

/** Cada ruta `/v1/profiles/:pid/…` llamada con un `pid`. */
const PROFILE_CALLS: Record<string, (s: FakeServer, pid: string) => unknown> = {
  profileCalendar: (s, pid) => s.getProfileCalendar(pid),
};

describe('contrato de familias', () => {
  it('admite un perfil sin nombre (el CRM no lo dio)', () => {
    expect(
      ProfileRef.safeParse({
        id: 'x',
        firstName: null,
        lastName: null,
        gender: null,
      }).success,
    ).toBe(true);
    expect(
      ProfileRef.safeParse({ id: 'x', firstName: 'A', lastName: 'B' }).success,
    ).toBe(false);
  });

  it('las rutas de familias son personales (sin la cabecera de delegación)', () => {
    expect(isTeamPath('/v1/me/profiles')).toBe(false);
    expect(isTeamPath('/v1/profiles/abc/calendar')).toBe(false);
    expect(isTeamPath('/v1/me')).toBe(true);
  });

  it('los perfiles y el calendario se guardan; están en el catálogo', () => {
    expect(ROUTES.myProfiles.persist).toBe(true);
    expect(ROUTES.profileCalendar.persist).toBe(true);
    expect(ROUTES.profileCalendar.path.startsWith(PROFILE_PATH_PREFIX)).toBe(
      true,
    );
  });
});

describe('vigencia de la relación (una sola regla)', () => {
  const today = '2026-10-28';
  it.each([
    [null, null, true],
    ['', '', true],
    ['2020-01-01', '0000-00-00', true],
    ['2020-01-01', '2026-10-28', true],
    ['2020-01-01', '2026-10-27', false],
    ['2026-10-29', null, false],
    ['2026-10-28', null, true],
    [null, '2030-01-01 00:00:00', true],
  ])('inicio %p y fin %p → %p', (startDate, endDate, ok) => {
    expect(isRelationActive({ startDate, endDate }, today)).toBe(ok);
  });
});

describe('GET /v1/me/profiles en el falso', () => {
  it('familia con dos hijos: los vigentes, por nombre; el sin nombre, al final', async () => {
    const s = server('guardianTwo');
    const r = MyProfiles.parse(await s.getMyProfiles());
    expect(r.self.firstName).toBe('Rosa');
    expect(r.self.gender).toBe('female');
    expect(r.children.map((c) => c.firstName)).toEqual(['Lucía', null]);
    // La relación terminada (Hugo) no cuenta.
    expect(r.children.some((c) => c.id === 'f-fam-antiguo')).toBe(false);
  });

  it('con uno, con ninguno, monitora con hija y miembro', async () => {
    expect((await server('guardianOne').getMyProfiles()).children).toHaveLength(
      1,
    );
    expect(
      (await server('guardianNone').getMyProfiles()).children,
    ).toHaveLength(0);
    expect(
      (await server('monitorParent').getMyProfiles()).children[0].firstName,
    ).toBe('Inés');
    expect((await server('member').getMyProfiles()).children).toEqual([]);
    expect((await server('monitor').getMyProfiles()).children).toEqual([]);
  });

  it('los papeles de la persona: member y guardian', async () => {
    const roles = async (p: PersonaId) => (await server(p).getMe()).me.roles;
    expect(await roles('guardianTwo')).toEqual(['guardian']);
    expect(await roles('guardianNone')).toEqual([]);
    expect(await roles('monitorParent')).toEqual([
      'monitor',
      'member',
      'guardian',
    ]);
    expect(await roles('member')).toEqual(['member']);
    // Ser del equipo es ser miembro.
    expect(await roles('monitor')).toEqual(['monitor', 'member']);
  });

  it('el CRM no contesta a los hijos: 503, nunca una lista vacía', async () => {
    const s = server('guardianTwo', { childrenDown: true });
    expect(await code(s.getMyProfiles())).toBe('crm_unavailable');
    // Y un hijo tampoco se puede comprobar: no se da por bueno.
    expect(await code(s.getProfileCalendar('f-fam-lucia'))).toBe(
      'crm_unavailable',
    );
    // Lo propio sí.
    expect(await code(s.getProfileCalendar('f-fam-rosa'))).toBe('ok');
  });

  it('un hijo nuevo llega con el siguiente fresh=1, no antes', async () => {
    const s = server('guardianOne');
    expect((await s.getMyProfiles()).children).toHaveLength(1);
    s.setControls({ newChild: true });
    expect((await s.getMyProfiles()).children).toHaveLength(1);
    const fresh = await s.getMyProfiles({ fresh: true });
    expect(fresh.children.map((c) => c.firstName)).toContain('Martín');
    // Y ya cuenta como suyo para las rutas de `pid`.
    expect(await code(s.getProfileCalendar('f-fam-nuevo'))).toBe('ok');
  });
});

describe('convención /v1/profiles/:pid', () => {
  it('cada ruta de familias está en esta tabla (y así se prueba su 403)', () => {
    const profileRoutes = Object.entries(ROUTES)
      .filter(([, r]) => r.path.startsWith(PROFILE_PATH_PREFIX))
      .map(([name]) => name)
      .sort();
    expect(profileRoutes).toEqual(Object.keys(PROFILE_CALLS).sort());
  });

  it.each(Object.entries(PROFILE_CALLS))(
    '%s: un pid ajeno da 403 (exista o no) y uno propio, datos',
    async (_name, call) => {
      const s = server('guardianTwo');
      expect(await code(Promise.resolve(call(s, 'f-fam-rosa')))).toBe('ok');
      expect(await code(Promise.resolve(call(s, 'f-fam-lucia')))).toBe('ok');
      // El hijo de otra familia, un hijo que ya no lo es y uno que no existe.
      for (const pid of ['f-fam-pablo', 'f-fam-antiguo', 'f-no-existe']) {
        expect(await code(Promise.resolve(call(s, pid)))).toBe('forbidden');
      }
    },
  );

  it('el pase a la web viendo a un hijo: solo con un perfil permitido', async () => {
    const s = server('guardianTwo');
    expect(
      await code(
        s.webPass({
          internalpage: 'list_stic_events',
          profileId: 'f-fam-lucia',
        }),
      ),
    ).toBe('ok');
    expect(
      await code(
        s.webPass({
          internalpage: 'list_stic_events',
          profileId: 'f-fam-pablo',
        }),
      ),
    ).toBe('forbidden');
  });
});

describe('calendario (plan 16) en el falso', () => {
  it('un hijo con abiertos y sesiones con y sin hora; otro sin nada', async () => {
    const s = server('guardianTwo');
    const lucia = CalendarData.parse(await s.getProfileCalendar('f-fam-lucia'));
    expect(lucia.openEvents.length).toBeGreaterThan(3);
    expect(lucia.sessions.some((x) => x.endsAt === null)).toBe(true);
    expect(lucia.sessions.some((x) => x.attendance === null)).toBe(true);
    const unnamed = await s.getProfileCalendar('f-fam-sin-nombre');
    expect(unnamed.openEvents).toEqual([]);
    expect(unnamed.sessions).toEqual([]);
  });

  it('los ids de evento valen como destino del plugin', async () => {
    const s = server('guardianTwo');
    const { openEvents } = await s.getProfileCalendar('f-fam-lucia');
    for (const e of openEvents) expect(e.id).toMatch(/^[a-f0-9-]{10,64}$/);
  });
});

describe('datos de familias', () => {
  it('los hijos vigentes salen de las fechas', () => {
    const s = server('guardianTwo');
    expect(activeChildIds(s.data, 'f-fam-rosa', '2026-10-28')).toEqual([
      'f-fam-lucia',
      'f-fam-sin-nombre',
    ]);
  });
});
