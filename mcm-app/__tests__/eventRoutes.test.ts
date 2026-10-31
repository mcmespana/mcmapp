import {
  EVENT_SLUGS,
  MAS_BASE,
  VISITAPAPA_BASE,
  eventHref,
  lastSegment,
  masHref,
  toRouteParams,
} from '@/utils/eventRoutes';

describe('toRouteParams', () => {
  it('convierte a texto y descarta lo que no viaja por URL', () => {
    expect(
      toRouteParams({
        eventId: 'jubileo25',
        initialDayIndex: 2,
        flag: false,
        nada: undefined,
        tampoco: null,
        objeto: { a: 1 },
      }),
    ).toEqual({ eventId: 'jubileo25', initialDayIndex: '2', flag: 'false' });
  });

  it('sin params útiles devuelve undefined', () => {
    expect(toRouteParams()).toBeUndefined();
    expect(toRouteParams({ x: undefined, y: { z: 1 } })).toBeUndefined();
  });
});

describe('masHref', () => {
  it('la portada es la raíz y las demás cuelgan de /mas', () => {
    expect(masHref('MasHome')).toEqual({ pathname: '/mas' });
    expect(masHref('Fotos')).toEqual({ pathname: '/mas/fotos' });
    expect(masHref('ComunicaGestion')).toEqual({
      pathname: '/mas/comunica-gestion',
    });
  });

  it('el hub de evento es /mas/evento y lleva su eventId', () => {
    expect(masHref('JubileoHome', { eventId: 'jubileo25' })).toEqual({
      pathname: '/mas/evento',
      params: { eventId: 'jubileo25' },
    });
  });

  it('las pantallas de evento también cuelgan de /mas', () => {
    expect(masHref('Materiales', { initialDayIndex: 1 })).toEqual({
      pathname: '/mas/materiales',
      params: { initialDayIndex: '1' },
    });
  });
});

describe('eventHref', () => {
  it('en la pestaña del evento el hub es la raíz', () => {
    expect(eventHref(VISITAPAPA_BASE, 'JubileoHome')).toEqual({
      pathname: '/visitapapa',
    });
  });

  it('en Más el hub es /mas/evento', () => {
    expect(eventHref(MAS_BASE, 'JubileoHome')).toEqual({
      pathname: '/mas/evento',
    });
  });

  it('el mismo nombre da la misma subruta en los dos stacks', () => {
    for (const name of Object.keys(
      EVENT_SLUGS,
    ) as (keyof typeof EVENT_SLUGS)[]) {
      const slug = EVENT_SLUGS[name];
      expect(eventHref(VISITAPAPA_BASE, name).pathname).toBe(
        `/visitapapa/${slug}`,
      );
      expect(eventHref(MAS_BASE, name).pathname).toBe(`/mas/${slug}`);
    }
  });
});

describe('lastSegment', () => {
  it('saca el último trozo, sin query ni barra final', () => {
    expect(lastSegment('/mas/horario')).toBe('horario');
    expect(lastSegment('/visitapapa/reflexiones?x=1')).toBe('reflexiones');
    expect(lastSegment('/mas/')).toBe('mas');
  });
});
