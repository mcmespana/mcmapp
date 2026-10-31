import {
  audienceFor,
  dataTitle,
  firstNameOf,
  greeting,
  greetingIntro,
  homeSections,
  initialOf,
  initialProfile,
  isGuardianOnly,
  isMember,
  mustChooseFirst,
  pickerTexts,
  sectionOfDestination,
  sectionVisible,
  selfLabel,
  shortName,
  switchDestination,
} from '@/utils/comunica/profiles';
import type { ProfileRef, Role } from '@/services/comunica/contract';

// «A quién se ve» (plan 11): audiencia, a quién se ve al entrar, «hay que elegir», a dónde se va al cambiar, bloques de la portada y nombres.
const me = (roles: Role[], personId = 'mom') => ({ personId, roles });
const kid = (
  id: string,
  firstName: string | null = 'Lucía',
  lastName: string | null = 'Messeguer Villarroya',
): ProfileRef => ({ id, firstName, lastName, gender: null });
const TWO = [kid('k1'), kid('k2', null, null)];

describe('papeles de familia', () => {
  it('miembro = papel member o de equipo; familiar a secas = guardian sin ser miembro', () => {
    expect(isMember(me(['member']))).toBe(true);
    expect(isMember(me(['monitor']))).toBe(true);
    expect(isMember(me(['guardian']))).toBe(false);
    expect(isMember(me([]))).toBe(false);
    expect(isGuardianOnly(me(['guardian']))).toBe(true);
    expect(isGuardianOnly(me(['guardian', 'member']))).toBe(false);
    expect(isGuardianOnly(me(['monitor', 'guardian']))).toBe(false);
  });
});

describe('audienceFor', () => {
  it('viendo a un hijo, child; viéndose, guardian si es familiar y no miembro; si no, member', () => {
    expect(audienceFor(me(['guardian']), 'k1')).toBe('child');
    expect(audienceFor(me(['guardian', 'member']), 'k1')).toBe('child');
    expect(audienceFor(me(['guardian']), 'mom')).toBe('guardian');
    expect(audienceFor(me(['guardian', 'member']), 'mom')).toBe('member'); // familiar y miembro
    expect(audienceFor(me(['monitor', 'member', 'guardian']), 'mom')).toBe(
      'member',
    );
    expect(audienceFor(me([]), 'mom')).toBe('member');
  });
});

describe('initialProfile: a quién se ve al abrir (las cinco filas)', () => {
  it('no es familiar → él mismo; familiar y miembro → él mismo; sin hijos → él mismo', () => {
    expect(initialProfile(me(['monitor']), [])).toEqual({
      activeId: 'mom',
      chosen: false,
      mustPick: false,
    });
    expect(initialProfile(me(['guardian', 'member']), TWO)).toEqual({
      activeId: 'mom',
      chosen: false,
      mustPick: false,
    });
    expect(initialProfile(me(['guardian']), [])).toEqual({
      activeId: 'mom',
      chosen: false,
      mustPick: false,
    });
  });
  it('solo familiar con un hijo → ese hijo, elegido solo; con varios → hay que elegir', () => {
    expect(initialProfile(me(['guardian']), [kid('k1')])).toEqual({
      activeId: 'k1',
      chosen: true,
      mustPick: false,
    });
    expect(initialProfile(me(['guardian']), TWO)).toEqual({
      activeId: 'mom',
      chosen: false,
      mustPick: true,
    });
  });
  it('la elección recordada vale mientras siga siendo válida; si el hijo ya no viene (relación terminada), se vuelve a aplicar la tabla', () => {
    expect(
      initialProfile(me(['guardian']), TWO, { activeId: 'k2', chosen: true }),
    ).toEqual({ activeId: 'k2', chosen: true, mustPick: false });
    expect(
      initialProfile(me(['guardian']), TWO, { activeId: 'mom', chosen: true }),
    ).toEqual({ activeId: 'mom', chosen: true, mustPick: false });
    expect(
      initialProfile(me(['guardian']), [kid('k1')], {
        activeId: 'k2',
        chosen: true,
      }),
    ).toEqual({ activeId: 'k1', chosen: true, mustPick: false });
    expect(
      initialProfile(me(['guardian']), TWO, {
        activeId: 'ajeno',
        chosen: true,
      }),
    ).toEqual({ activeId: 'mom', chosen: false, mustPick: true });
  });
});

describe('mustChooseFirst: «hay que elegir» (FAM-a1)', () => {
  const unchosen = { activeId: 'mom', chosen: false };
  const chosenSelf = { activeId: 'mom', chosen: true };
  it('solo familiar, dos o más hijos y sin haber elegido nunca: primero a perfiles; con un evento o una inscripción, «apuntar»', () => {
    expect(
      mustChooseFirst(me(['guardian']), TWO, unchosen, 'single_stic_events'),
    ).toEqual({ why: 'first', purpose: 'signup' });
    expect(
      mustChooseFirst(
        me(['guardian']),
        TWO,
        unchosen,
        'single_stic_registrations',
      ),
    ).toEqual({ why: 'first', purpose: 'signup' });
    expect(
      mustChooseFirst(me(['guardian']), TWO, unchosen, 'list_stic_payments'),
    ).toEqual({ why: 'first', purpose: 'view' });
  });
  it('no pregunta con la elección hecha a un hijo, con un solo hijo, siendo miembro, ni con un destino que no es de familia', () => {
    expect(
      mustChooseFirst(
        me(['guardian']),
        TWO,
        { activeId: 'k1', chosen: true },
        'single_stic_events',
      ),
    ).toBeNull();
    // Con un solo hijo, `initialProfile` ya lo deja elegido: no se pregunta.
    expect(
      mustChooseFirst(
        me(['guardian']),
        [kid('k1')],
        { activeId: 'k1', chosen: true },
        'single_stic_events',
      ),
    ).toBeNull();
    expect(
      mustChooseFirst(
        me(['guardian', 'member']),
        TWO,
        unchosen,
        'single_stic_events',
      ),
    ).toBeNull();
    expect(
      mustChooseFirst(me(['guardian']), TWO, unchosen, 'single_stic_home'),
    ).toBeNull();
    expect(
      mustChooseFirst(me(['guardian']), TWO, unchosen, undefined),
    ).toBeNull();
  });
  it('aun habiendo elegido, un evento viéndose a sí misma (que no tiene Eventos) vuelve a perfiles con el destino', () => {
    expect(
      mustChooseFirst(me(['guardian']), TWO, chosenSelf, 'single_stic_events'),
    ).toEqual({ why: 'section', purpose: 'signup' });
    // Pero Pagos sí es suyo.
    expect(
      mustChooseFirst(me(['guardian']), TWO, chosenSelf, 'list_stic_payments'),
    ).toBeNull();
  });
  it('los textos: apuntar o ver', () => {
    expect(pickerTexts('signup')).toEqual({
      title: '¿A quién quieres apuntar?',
      body: 'Elige a quién y te llevamos directo a la actividad.',
    });
    expect(pickerTexts('view').title).toBe('¿A quién quieres ver?');
    expect(sectionOfDestination('single_stic_payment_form')).toBe('payments');
    expect(sectionOfDestination('otra_cosa')).toBeNull();
  });
});

describe('switchDestination (FAM-a8)', () => {
  it('compartida: se queda si la nueva audiencia tiene esa sección; personal, a la portada', () => {
    expect(switchDestination('shared', 'events', 'child')).toBe('stay');
    expect(switchDestination('shared', 'calendar', 'member')).toBe('stay');
    expect(switchDestination('personal', 'registrations', 'child')).toBe(
      'home',
    );
    expect(switchDestination('personal', 'payments', 'member')).toBe('home');
  });
  it('un familiar a secas que se elige a sí mismo desde Eventos o Calendario no los tiene: a la portada', () => {
    expect(switchDestination('shared', 'events', 'guardian')).toBe('home');
    expect(switchDestination('shared', 'calendar', 'guardian')).toBe('home');
    expect(switchDestination('shared', null, 'member')).toBe('home');
  });
  it('lo que ve cada audiencia: guardian solo datos y pagos', () => {
    for (const s of ['profile', 'payments'] as const)
      expect(sectionVisible('guardian', s)).toBe(true);
    for (const s of [
      'events',
      'registrations',
      'calendar',
      'documents',
    ] as const)
      expect(sectionVisible('guardian', s)).toBe(false);
    for (const s of [
      'events',
      'registrations',
      'calendar',
      'payments',
      'documents',
      'profile',
    ] as const) {
      expect(sectionVisible('member', s)).toBe(true);
      expect(sectionVisible('child', s)).toBe(true);
    }
  });
});

describe('la portada', () => {
  it('guardian: solo «Tus pagos»; hijo: «Inscripciones»; miembro: «Mis inscripciones»', () => {
    expect(homeSections('guardian')).toEqual({
      title: 'Tus pagos',
      rows: [expect.objectContaining({ section: 'payments', title: 'Pagos' })],
    });
    expect(homeSections('child').rows.map((r) => r.title)).toEqual([
      'Eventos',
      'Inscripciones',
      'Calendario',
      'Pagos',
      'Documentos',
    ]);
    expect(homeSections('member').rows.map((r) => r.title)).toEqual([
      'Eventos',
      'Mis inscripciones',
      'Calendario',
      'Pagos',
      'Documentos',
    ]);
    expect(homeSections('member').title).toBe('Actividades');
    expect(homeSections('member').rows[1]!.description).toBe(
      'A qué estás apuntado y en qué estado está.',
    );
  });
  it('el saludo es de quien ha entrado, y la entradilla de a quién se ve', () => {
    expect(greeting({ name: 'Marta Villarroya Pons' })).toBe('Hola, Marta 👋');
    expect(greeting({ name: '  ' })).toBe('¡Te damos la bienvenida! 👋');
    expect(greetingIntro('child', 'Lucía')).toBe(
      'Aquí ves los datos de Lucía y le inscribes a las actividades.',
    );
    expect(greetingIntro('guardian', '')).toMatch(
      /lo que se cobra de tu cuenta/,
    );
    expect(greetingIntro('member', '')).toBe(
      'Tu espacio personal. Elige una sección para empezar.',
    );
  });
});

describe('nombres', () => {
  it('el nombre de pila es la primera palabra; el corto, nombre y primer apellido; «Participante» sin nada', () => {
    expect(firstNameOf({ firstName: 'María José' })).toBe('María');
    expect(firstNameOf({ firstName: null })).toBe('');
    expect(
      shortName({ firstName: 'Lucía', lastName: 'Messeguer Villarroya' }),
    ).toBe('Lucía Messeguer');
    expect(shortName({ firstName: 'Lucía', lastName: null })).toBe('Lucía');
    expect(shortName({ firstName: null, lastName: null })).toBe('Participante');
  });
  it('la inicial: la del nombre, la del apellido si falta, y «·» sin nada', () => {
    expect(initialOf({ firstName: 'ángela', lastName: 'x' })).toBe('Á');
    expect(initialOf({ firstName: null, lastName: 'Pons' })).toBe('P');
    expect(initialOf({ firstName: null, lastName: null })).toBe('·');
  });
  it('«Yo mismo/a»: el género primero; si no, la heurística (Carmen → misma, acabar en «a» → misma); sin nombre, «Yo mismo/a»', () => {
    expect(selfLabel({ firstName: 'Carmen', gender: 'male' })).toBe('Yo mismo');
    expect(selfLabel({ firstName: 'Jaime', gender: 'female' })).toBe(
      'Yo misma',
    );
    expect(selfLabel({ firstName: 'Carmen', gender: null })).toBe('Yo misma');
    expect(selfLabel({ firstName: 'Marta', gender: null })).toBe('Yo misma');
    expect(selfLabel({ firstName: 'Laura', gender: null })).toBe('Yo misma');
    expect(selfLabel({ firstName: 'Jaime', gender: null })).toBe('Yo mismo');
    expect(selfLabel({ firstName: null, gender: null })).toBe('Yo mismo/a');
  });
  it('el título de los datos: «Mis datos», «Datos de María» o «Datos del participante»', () => {
    expect(dataTitle({ firstName: 'María José' }, true)).toBe('Mis datos');
    expect(dataTitle({ firstName: 'María José' }, false)).toBe(
      'Datos de María',
    );
    expect(dataTitle({ firstName: null }, false)).toBe(
      'Datos del participante',
    );
  });
});
