/**
 * Las reglas puras de los perfiles de familia y de la portada (plan 11,
 * tarea 3): audiencia, a quién se ve al entrar, «hay que elegir», a dónde se
 * va al cambiar, secciones y etiquetas, nombres y la agenda.
 */
import type { ProfileRef } from '@/services/comunica/contract';
import {
  audienceFor,
  firstNameOf,
  initialOf,
  initialProfile,
  isMemberRoles,
  mustChooseFirst,
  selfLabel,
  shortName,
  switchDestination,
  type ProfilesData,
} from '@/utils/comunica/profiles';
import {
  greetingLead,
  greetingTitle,
  homeSections,
  isGreetingHidden,
} from '@/utils/comunica/home';
import { upcomingAgendaItems } from '@/utils/comunica/calendar';

const ref = (
  id: string,
  firstName: string | null = null,
  lastName: string | null = null,
  gender: ProfileRef['gender'] = null,
): ProfileRef => ({ id, firstName, lastName, gender });

const SELF = ref('me', 'Rosa', 'Martín Pozo', 'female');
const LUCIA = ref('lucia', 'Lucía', 'Messeguer Villarroya', 'female');
const NONAME = ref('x');
const profiles = (children: ProfileRef[]): ProfilesData => ({
  self: SELF,
  children,
});

describe('audienceFor', () => {
  it('viendo a un hijo, child', () => {
    expect(audienceFor({ member: false, hasChildren: true }, false)).toBe(
      'child',
    );
    expect(audienceFor({ member: true, hasChildren: true }, false)).toBe(
      'child',
    );
  });
  it('familiar a secas viéndose, guardian', () => {
    expect(audienceFor({ member: false, hasChildren: true }, true)).toBe(
      'guardian',
    );
  });
  it('familiar y miembro viéndose, member; sin hijos, member', () => {
    expect(audienceFor({ member: true, hasChildren: true }, true)).toBe(
      'member',
    );
    expect(audienceFor({ member: false, hasChildren: false }, true)).toBe(
      'member',
    );
  });
  it('ser del equipo es ser miembro', () => {
    expect(isMemberRoles(['monitor'])).toBe(true);
    expect(isMemberRoles(['member'])).toBe(true);
    expect(isMemberRoles(['guardian'])).toBe(false);
    expect(isMemberRoles([])).toBe(false);
  });
});

describe('initialProfile: a quién se ve al entrar', () => {
  it('no es familiar → él mismo', () => {
    expect(
      initialProfile({ member: true, profiles: profiles([]), saved: null }),
    ).toEqual({ activeId: 'me', chosen: false, mustChoose: false });
  });
  it('familiar y miembro → él mismo', () => {
    expect(
      initialProfile({
        member: true,
        profiles: profiles([LUCIA, NONAME]),
        saved: null,
      }),
    ).toEqual({ activeId: 'me', chosen: false, mustChoose: false });
  });
  it('solo familiar con un hijo → ese hijo, elegido solo', () => {
    expect(
      initialProfile({
        member: false,
        profiles: profiles([LUCIA]),
        saved: null,
      }),
    ).toEqual({ activeId: 'lucia', chosen: true, mustChoose: false });
  });
  it('solo familiar con varios → hay que elegir', () => {
    expect(
      initialProfile({
        member: false,
        profiles: profiles([LUCIA, NONAME]),
        saved: null,
      }),
    ).toEqual({ activeId: 'me', chosen: false, mustChoose: true });
  });
  it('solo familiar sin hijos → él mismo', () => {
    expect(
      initialProfile({ member: false, profiles: profiles([]), saved: null }),
    ).toEqual({ activeId: 'me', chosen: false, mustChoose: false });
  });
  it('lo elegido antes manda, también elegirse a sí mismo', () => {
    expect(
      initialProfile({
        member: false,
        profiles: profiles([LUCIA, NONAME]),
        saved: { activeId: 'x', chosen: true },
      }),
    ).toEqual({ activeId: 'x', chosen: true, mustChoose: false });
    expect(
      initialProfile({
        member: false,
        profiles: profiles([LUCIA]),
        saved: { activeId: 'me', chosen: true },
      }),
    ).toEqual({ activeId: 'me', chosen: true, mustChoose: false });
  });
  it('un hijo recordado que ya no viene: se vuelve a aplicar la tabla', () => {
    expect(
      initialProfile({
        member: false,
        profiles: profiles([LUCIA, NONAME]),
        saved: { activeId: 'antiguo', chosen: true },
      }),
    ).toEqual({ activeId: 'me', chosen: false, mustChoose: true });
  });
});

describe('mustChooseFirst: enlaces con varios hijos (FAM-a1)', () => {
  const base = {
    page: 'single_stic_events',
    member: false,
    childrenCount: 2,
    chosen: false,
    audience: 'guardian' as const,
  };
  it('solo familiar, dos hijos, sin elegir: sí', () => {
    expect(mustChooseFirst(base)).toBe(true);
  });
  it('no con la elección hecha', () => {
    expect(mustChooseFirst({ ...base, chosen: true, audience: 'child' })).toBe(
      false,
    );
  });
  it('no con un hijo (se elige solo)', () => {
    expect(
      mustChooseFirst({
        ...base,
        childrenCount: 1,
        chosen: true,
        audience: 'child',
      }),
    ).toBe(false);
  });
  it('no siendo miembro', () => {
    expect(mustChooseFirst({ ...base, member: true, audience: 'member' })).toBe(
      false,
    );
  });
  it('no en la propia «¿A quién ves?» ni en una página que no es de familia', () => {
    expect(
      mustChooseFirst({ ...base, page: 'single_stic_profile_selection' }),
    ).toBe(false);
    expect(mustChooseFirst({ ...base, page: 'single_stic_pasar_lista' })).toBe(
      false,
    );
  });
  it('sí con guardian viéndose y un destino de evento (aunque haya elegido)', () => {
    expect(mustChooseFirst({ ...base, chosen: true })).toBe(true);
    expect(mustChooseFirst({ ...base, chosen: true, childrenCount: 1 })).toBe(
      true,
    );
    // Sus pagos sí son suyos: pasa.
    expect(
      mustChooseFirst({ ...base, chosen: true, page: 'list_stic_payments' }),
    ).toBe(false);
  });
});

describe('switchDestination (FAM-a8)', () => {
  it('compartida: se queda', () => {
    expect(switchDestination('shared', 'events', 'child')).toBe('stay');
    expect(switchDestination('shared', 'calendar', 'member')).toBe('stay');
  });
  it('personal: a la portada', () => {
    expect(switchDestination('personal', 'registrations', 'child')).toBe(
      'home',
    );
  });
  it('sección que la nueva audiencia no tiene: a la portada', () => {
    expect(switchDestination('shared', 'events', 'guardian')).toBe('home');
    expect(switchDestination('shared', 'calendar', 'guardian')).toBe('home');
  });
});

describe('homeSections y etiquetas', () => {
  const titles = (b: ReturnType<typeof homeSections>) =>
    b.map((x) => [x.title, x.rows.map((r) => r.title)]);
  it('miembro: Actividades enteras y Mis datos', () => {
    expect(titles(homeSections({ audience: 'member' }))).toEqual([
      [
        'Actividades',
        ['Eventos', 'Mis inscripciones', 'Calendario', 'Pagos', 'Documentos'],
      ],
      ['Tu perfil', ['Mis datos']],
    ]);
  });
  it('guardian: «Tus pagos»', () => {
    expect(titles(homeSections({ audience: 'guardian' }))).toEqual([
      ['Tus pagos', ['Pagos']],
      ['Tu perfil', ['Mis datos']],
    ]);
  });
  it('hijo: «Inscripciones» y «Datos de Lucía», sin lo de monitor', () => {
    const b = homeSections({
      audience: 'child',
      childFirstName: 'Lucía',
      isMonitor: true,
    });
    expect(b[0].rows.map((r) => r.title)).toContain('Inscripciones');
    expect(b[1].rows.map((r) => r.title)).toEqual(['Datos de Lucía']);
    expect(
      homeSections({ audience: 'child' })[1].rows.map((r) => r.title),
    ).toEqual(['Sus datos']);
  });
  it('monitor viéndose: «Mis datos de monitor»', () => {
    const b = homeSections({ audience: 'member', isMonitor: true });
    expect(b[1].rows.map((r) => r.title)).toEqual([
      'Mis datos',
      'Mis datos de monitor',
    ]);
    expect(b[1].rows[1].destination).toEqual({
      internalpage: 'single_stic_comunica_monitor',
    });
  });
  it('cada fila con la descripción del plugin y su página', () => {
    const [act] = homeSections({ audience: 'member' });
    expect(act.rows[0]).toEqual({
      key: 'events',
      title: 'Eventos',
      description: 'Las actividades a las que te puedes apuntar.',
      destination: { internalpage: 'list_stic_events' },
    });
  });
});

describe('saludo', () => {
  it('título con el nombre de pila o la bienvenida', () => {
    expect(greetingTitle('Marta')).toBe('Hola, Marta 👋');
    expect(greetingTitle('')).toBe('¡Te damos la bienvenida! 👋');
  });
  it('entradilla por audiencia, con el nombre del hijo en negrita', () => {
    expect(greetingLead('child', 'Lucía')).toEqual([
      { text: 'Aquí ves los datos de ' },
      { text: 'Lucía', strong: true },
      { text: ' y le inscribes a las actividades.' },
    ]);
    expect(greetingLead('guardian', '')[0].text).toMatch(/^Aquí están tus/);
    expect(greetingLead('member', '')[0].text).toBe(
      'Tu espacio personal. Elige una sección para empezar.',
    );
  });
  it('cerrado, vuelve al mes', () => {
    const now = new Date('2026-10-28T10:00:00Z');
    expect(isGreetingHidden(null, now)).toBe(false);
    expect(isGreetingHidden('2026-10-01T10:00:00Z', now)).toBe(true);
    expect(isGreetingHidden('2026-09-27T09:00:00Z', now)).toBe(false);
    expect(isGreetingHidden('basura', now)).toBe(false);
  });
});

describe('nombres', () => {
  it('nombre corto: nombre y primer apellido', () => {
    expect(
      shortName({ firstName: 'Lucía', lastName: 'Messeguer Villarroya' }),
    ).toBe('Lucía Messeguer');
    expect(shortName({ firstName: 'Ana', lastName: 'de la Fuente Gil' })).toBe(
      'Ana de la Fuente',
    );
    expect(shortName({ firstName: null, lastName: null })).toBe('Participante');
  });
  it('nombre de pila e inicial', () => {
    expect(firstNameOf('María José')).toBe('María');
    expect(firstNameOf(null)).toBe('');
    expect(initialOf({ firstName: 'ánxela', lastName: null })).toBe('Á');
    expect(initialOf({ firstName: null, lastName: null })).toBe('·');
  });
  it('«Yo mismo/a»: el género primero, si no el nombre', () => {
    expect(selfLabel({ firstName: 'Andrea', gender: 'male' })).toBe('Yo mismo');
    expect(selfLabel({ firstName: 'Luis', gender: 'female' })).toBe('Yo misma');
    expect(selfLabel({ firstName: 'Carmen', gender: null })).toBe('Yo misma');
    expect(selfLabel({ firstName: 'Lucía Ana', gender: null })).toBe(
      'Yo misma',
    );
    expect(selfLabel({ firstName: 'Javier', gender: null })).toBe('Yo mismo');
    expect(selfLabel({ firstName: '', gender: null })).toBe('Yo mismo/a');
  });
});

describe('upcomingAgendaItems (la agenda de la portada)', () => {
  const ev = (id: string, name: string, startDate: string) => ({
    id,
    name,
    startDate,
    endDate: null,
  });
  it('abiertos de hoy en adelante, por fecha, cinco como mucho', () => {
    const items = upcomingAgendaItems(
      {
        openEvents: [
          ev('a', 'Ayer', '2026-10-27'),
          ev('b', 'Hoy', '2026-10-28'),
          ev('c', 'Lejos', '2027-05-01'),
          ev('d', 'Pronto', '2026-11-02'),
          ev('e', 'Uno', '2026-11-10'),
          ev('f', 'Dos', '2026-11-11'),
          ev('g', 'Tres', '2026-11-12'),
        ],
      },
      '2026-10-28',
    );
    expect(items.map((i) => i.title)).toEqual([
      'Hoy',
      'Pronto',
      'Uno',
      'Dos',
      'Tres',
    ]);
    expect(items[0]).toEqual({
      kind: 'open',
      eventId: 'b',
      title: 'Hoy',
      day: '2026-10-28',
    });
  });
  it('sin nada que enseñar, vacía', () => {
    expect(upcomingAgendaItems({ openEvents: [] }, '2026-10-28')).toEqual([]);
  });
});
