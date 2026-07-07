import {
  notificationMatchesUser,
  normalizeAudience,
  eventTopic,
  NotificationAudienceUser,
} from '@/utils/notificationAudience';

// Usuario base: monitor de Madrid, suscrito al evento visitapapa26.
const monitorMadrid: NotificationAudienceUser = {
  profileType: 'monitor',
  delegationId: 'madrid',
  topics: ['general', eventTopic('visitapapa26')],
};

const familiaSevilla: NotificationAudienceUser = {
  profileType: 'familia',
  delegationId: 'sevilla',
  topics: ['general'],
};

const sinPerfil: NotificationAudienceUser = {
  profileType: null,
  delegationId: null,
  topics: ['general'],
};

describe('notificationMatchesUser', () => {
  it('sin audiencia → visible para todos (retrocompatible)', () => {
    expect(notificationMatchesUser(undefined, monitorMadrid)).toBe(true);
    expect(notificationMatchesUser(null, familiaSevilla)).toBe(true);
  });

  it('audiencia sin ejes activos → visible para todos', () => {
    const empty = {
      match: 'all' as const,
      todos: false,
      perfiles: [],
      delegaciones: [],
      eventId: null,
    };
    expect(notificationMatchesUser(empty, familiaSevilla)).toBe(true);
  });

  it('eje "todos" → visible solo si el usuario tiene el topic general', () => {
    const audiencia = {
      match: 'all' as const,
      todos: true,
      perfiles: [],
      delegaciones: [],
      eventId: null,
    };
    expect(notificationMatchesUser(audiencia, monitorMadrid)).toBe(true);
    expect(
      notificationMatchesUser(audiencia, { ...monitorMadrid, topics: [] }),
    ).toBe(false);
  });

  it('eje perfil → coincide por profileType', () => {
    const soloMonitores = {
      match: 'all' as const,
      todos: false,
      perfiles: ['monitor' as const],
      delegaciones: [],
      eventId: null,
    };
    expect(notificationMatchesUser(soloMonitores, monitorMadrid)).toBe(true);
    expect(notificationMatchesUser(soloMonitores, familiaSevilla)).toBe(false);
    expect(notificationMatchesUser(soloMonitores, sinPerfil)).toBe(false);
  });

  it('eje delegación → coincide por delegationId', () => {
    const soloMadrid = {
      match: 'all' as const,
      todos: false,
      perfiles: [],
      delegaciones: ['madrid'],
      eventId: null,
    };
    expect(notificationMatchesUser(soloMadrid, monitorMadrid)).toBe(true);
    expect(notificationMatchesUser(soloMadrid, familiaSevilla)).toBe(false);
  });

  it('eje evento → coincide por topic event-<id>', () => {
    const soloEvento = {
      match: 'all' as const,
      todos: false,
      perfiles: [],
      delegaciones: [],
      eventId: 'visitapapa26',
    };
    expect(notificationMatchesUser(soloEvento, monitorMadrid)).toBe(true);
    expect(notificationMatchesUser(soloEvento, familiaSevilla)).toBe(false);
  });

  it('varios ejes con match "all" (AND) → deben cumplirse todos', () => {
    const monitoresDeMadrid = {
      match: 'all' as const,
      todos: false,
      perfiles: ['monitor' as const],
      delegaciones: ['madrid'],
      eventId: null,
    };
    expect(notificationMatchesUser(monitoresDeMadrid, monitorMadrid)).toBe(
      true,
    );
    // Monitor pero de otra delegación → no cumple el AND.
    expect(
      notificationMatchesUser(monitoresDeMadrid, {
        ...monitorMadrid,
        delegationId: 'sevilla',
      }),
    ).toBe(false);
  });

  it('varios ejes con match "any" (OR) → basta con uno', () => {
    const monitoresOSevilla = {
      match: 'any' as const,
      todos: false,
      perfiles: ['monitor' as const],
      delegaciones: ['sevilla'],
      eventId: null,
    };
    // Familia de Sevilla: falla perfil pero cumple delegación → visible.
    expect(notificationMatchesUser(monitoresOSevilla, familiaSevilla)).toBe(
      true,
    );
    // Familia de otra delegación → no cumple ninguno.
    expect(
      notificationMatchesUser(monitoresOSevilla, {
        ...familiaSevilla,
        delegationId: 'valencia',
      }),
    ).toBe(false);
  });

  it('tolera audiencia malformada sin romperse', () => {
    expect(notificationMatchesUser({} as never, monitorMadrid)).toBe(true);
    expect(
      notificationMatchesUser(
        { perfiles: null, delegaciones: undefined } as never,
        monitorMadrid,
      ),
    ).toBe(true);
  });
});

describe('normalizeAudience', () => {
  it('devuelve null cuando no hay ejes activos', () => {
    expect(normalizeAudience(null)).toBeNull();
    expect(
      normalizeAudience({
        match: 'all',
        todos: false,
        perfiles: [],
        delegaciones: [],
        eventId: null,
      }),
    ).toBeNull();
  });

  it('normaliza match desconocido a "all"', () => {
    const a = normalizeAudience({ todos: true, match: 'bogus' as never });
    expect(a?.match).toBe('all');
  });

  it('recorta eventId en blanco a null', () => {
    const a = normalizeAudience({ perfiles: ['monitor'], eventId: '   ' });
    expect(a?.eventId).toBeNull();
  });
});
