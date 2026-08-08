/**
 * Cómo se llega a un tab desde la Home.
 *
 * El bug que cubre: en iOS solo los tabs de la BARRA tienen ruta registrada
 * (`IOSTabsLayout` crea un `NativeTabs.Trigger` por tab de la barra y nada más),
 * y qué tabs caben depende del perfil y de si hay evento en curso. La Home lo
 * decidía a ojo —`Platform.OS === 'ios'` y `href` fijos— así que sus botones
 * llevaban al sitio equivocado, o a ninguno.
 */
import {
  MAS_EVENT_HUB_SCREEN,
  resolveEventScreenRoute,
  resolveTabRoute,
} from '@/utils/tabNavigation';

const EVENT = { tabName: 'visitapapa', eventId: 'visitapapa' };

/** 8 tabs = hay overflow: caben 5 + "Más" (MAX_TAB_BAR_ITEMS = 6). */
const ALL_TABS = new Set([
  'index',
  'cancionero',
  'contigo',
  'comunica',
  'visitapapa',
  'calendario',
  'fotos',
  'mas',
]);

/** 6 tabs sin evento: todos caben en la barra, no hay overflow. */
const NO_EVENT_TABS = new Set([
  'index',
  'cancionero',
  'contigo',
  'calendario',
  'fotos',
  'mas',
]);

describe('resolveTabRoute — Android y web', () => {
  it('van directos a cualquier tab visible, esté o no en la barra', () => {
    for (const platform of ['android', 'web']) {
      expect(resolveTabRoute('calendario', ALL_TABS, { platform })).toEqual({
        via: 'tab',
        path: '/calendario',
      });
    }
  });

  it('conservan los params del destino', () => {
    expect(
      resolveTabRoute('calendario', ALL_TABS, {
        platform: 'android',
        params: { date: '2026-08-08' },
      }),
    ).toEqual({
      via: 'tab',
      path: '/calendario',
      params: { date: '2026-08-08' },
    });
  });
});

describe('resolveTabRoute — iOS', () => {
  const platform = 'ios';

  it('con evento en curso, el calendario cae en overflow → entra por "Más"', () => {
    expect(
      resolveTabRoute('calendario', ALL_TABS, {
        platform,
        params: { date: '2026-08-08' },
      }),
    ).toEqual({
      via: 'masScreen',
      screen: 'Calendario',
      params: { date: '2026-08-08' },
    });
  });

  it('SIN evento el calendario está en la barra → va directo', () => {
    // Este es el caso que fallaba: la Home entraba por "Más" siempre en iOS, y
    // aquí aterrizaba en el tab equivocado.
    expect(resolveTabRoute('calendario', NO_EVENT_TABS, { platform })).toEqual({
      via: 'tab',
      path: '/calendario',
    });
  });

  it('el tab del evento va directo cuando cabe en la barra', () => {
    expect(
      resolveTabRoute('visitapapa', ALL_TABS, { platform, eventTab: EVENT }),
    ).toEqual({ via: 'tab', path: '/visitapapa' });
  });

  it('el tab del evento fuera de los visibles entra por el hub de "Más"', () => {
    // Pasa cuando el evento se ARCHIVA: `useVisibleTabs` quita su tab, pero
    // seguimos queriendo llegar a sus pantallas (p. ej. la evaluación). Con el
    // orden actual de TABS_CONFIG el tab del evento nunca cae en overflow
    // —va en la posición 5 de 8, y a la barra entran las 5 primeras— así que
    // este es el camino por el que se alcanza el hub.
    const tabs = new Set([
      'index',
      'cancionero',
      'contigo',
      'comunica',
      'calendario',
      'fotos',
      'mas',
    ]);
    expect(
      resolveTabRoute('visitapapa', tabs, { platform, eventTab: EVENT }),
    ).toEqual({
      via: 'masScreen',
      screen: MAS_EVENT_HUB_SCREEN,
      params: { eventId: 'visitapapa' },
    });
  });

  it('un tab que el perfil no muestra usa su espejo de "Más"', () => {
    // La tarjeta de calendario de la Home sale de los calendarios suscritos, no
    // de los tabs: puede haberla sin tab de calendario.
    const tabs = new Set(['index', 'cancionero', 'mas']);
    expect(resolveTabRoute('calendario', tabs, { platform })).toEqual({
      via: 'masScreen',
      screen: 'Calendario',
    });
  });

  it('sin espejo posible se aterriza en la raíz de "Más", no en la nada', () => {
    const tabs = new Set(['index', 'mas']);
    expect(resolveTabRoute('cancionero', tabs, { platform })).toEqual({
      via: 'masRoot',
    });
  });
});

describe('resolveEventScreenRoute', () => {
  it('entra por el tab del evento cuando ese tab tiene ruta propia', () => {
    expect(
      resolveEventScreenRoute('Evaluacion', EVENT, ALL_TABS, 'ios'),
    ).toEqual({ via: 'eventTab', path: '/visitapapa' });
  });

  it('entra por "Más" cuando el tab del evento ya no está visible (archivado)', () => {
    const tabs = new Set([
      'index',
      'cancionero',
      'contigo',
      'comunica',
      'calendario',
      'fotos',
      'mas',
    ]);
    expect(resolveEventScreenRoute('Evaluacion', EVENT, tabs, 'ios')).toEqual({
      via: 'masScreen',
      screen: 'Evaluacion',
    });
  });
});
