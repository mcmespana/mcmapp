/**
 * Los dos "buzones" de navegación pendiente: `masNavigation` y
 * `eventNavigation`. Son singletons de módulo, así que su contrato importa —
 * un destino que no se limpia reaparece en la siguiente pantalla que enfoque.
 */
import {
  setPendingMasScreen,
  takePendingMasScreen,
} from '@/utils/masNavigation';
import {
  setPendingEventScreen,
  takePendingEventScreen,
} from '@/utils/eventNavigation';

const STORES = [
  {
    nombre: 'masNavigation',
    set: setPendingMasScreen as (s: string, p?: object) => void,
    take: takePendingMasScreen as () => unknown,
  },
  {
    nombre: 'eventNavigation',
    set: setPendingEventScreen as (s: string, p?: object) => void,
    take: takePendingEventScreen as () => unknown,
  },
];

beforeEach(() => {
  STORES.forEach((s) => s.take());
});

describe.each(STORES)('$nombre', ({ set, take }) => {
  it('vacío devuelve null', () => {
    expect(take()).toBeNull();
  });

  it('es de UN SOLO USO: el segundo take ya no lo ve', () => {
    set('Calendario');
    expect(take()).toEqual({ screen: 'Calendario', params: undefined });
    expect(take()).toBeNull();
  });

  it('guarda los params tal cual', () => {
    set('Calendario', { date: '2026-08-08' });
    expect(take()).toEqual({
      screen: 'Calendario',
      params: { date: '2026-08-08' },
    });
  });

  it('un set nuevo PISA al anterior (no se encolan destinos viejos)', () => {
    set('Fotos');
    set('Comunica', { x: 1 });
    expect(take()).toEqual({ screen: 'Comunica', params: { x: 1 } });
    expect(take()).toBeNull();
  });
});

describe('los dos buzones son independientes', () => {
  it('escribir en uno no contamina el otro', () => {
    setPendingMasScreen('Calendario' as never);
    expect(takePendingEventScreen()).toBeNull();
    expect(takePendingMasScreen()).toEqual({
      screen: 'Calendario',
      params: undefined,
    });

    setPendingEventScreen('Evaluacion');
    expect(takePendingMasScreen()).toBeNull();
    expect(takePendingEventScreen()).toEqual({
      screen: 'Evaluacion',
      params: undefined,
    });
  });
});
