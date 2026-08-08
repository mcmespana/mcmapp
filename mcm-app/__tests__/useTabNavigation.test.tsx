/**
 * `useTabNavigation` de punta a punta: qué `router.push` sale y qué destino
 * pendiente se deja apuntado.
 *
 * El resolver ya está cubierto aparte; esto ata el CABLEADO, que es donde
 * estaba el bug original: el camino se decidía bien pero se ejecutaba a mano en
 * cada botón, y cada uno lo hacía distinto.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

// Los nombres tienen que empezar por `mock` para que jest los deje entrar en
// las factories de `jest.mock` (se evalúan antes que el resto del módulo).
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

let mockVisibleTabs = new Set<string>();
jest.mock('@/hooks/useVisibleTabs', () => ({
  useVisibleTabs: () => mockVisibleTabs,
}));

let mockActiveEvent: { id: string; tabId?: string } = {
  id: 'visitapapa',
  tabId: 'visitapapa',
};
jest.mock('@/contexts/ActiveEventContext', () => ({
  useActiveMeta: () => ({ activeEvent: mockActiveEvent }),
}));

let mockPlatform = 'ios';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
}));

import { useTabNavigation } from '@/hooks/useTabNavigation';
import { takePendingMasScreen } from '@/utils/masNavigation';
import { takePendingEventScreen } from '@/utils/eventNavigation';

const ALL = [
  'index',
  'cancionero',
  'contigo',
  'comunica',
  'visitapapa',
  'calendario',
  'fotos',
  'mas',
];
const SIN_EVENTO = ALL.filter((t) => t !== 'visitapapa' && t !== 'comunica');

function render() {
  let api!: ReturnType<typeof useTabNavigation>;
  function Probe() {
    api = useTabNavigation();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return api;
}

beforeEach(() => {
  mockPush.mockClear();
  takePendingMasScreen();
  takePendingEventScreen();
  mockPlatform = 'ios';
  mockVisibleTabs = new Set(ALL);
  mockActiveEvent = { id: 'visitapapa', tabId: 'visitapapa' };
});

describe('goToTab — iOS con evento (el calendario está en overflow)', () => {
  it('deja el calendario apuntado en "Más" y navega a "Más"', () => {
    render().goToTab('calendario');

    expect(mockPush).toHaveBeenCalledWith('/mas');
    expect(takePendingMasScreen()).toEqual({
      screen: 'Calendario',
      params: undefined,
    });
  });

  it('arrastra la fecha hasta el destino pendiente', () => {
    render().goToTab('calendario', { date: '2026-08-08' });

    expect(mockPush).toHaveBeenCalledWith('/mas');
    expect(takePendingMasScreen()).toEqual({
      screen: 'Calendario',
      params: { date: '2026-08-08' },
    });
  });

  it('el tab del evento sí cabe en la barra: push directo y sin pendiente', () => {
    render().goToTab('visitapapa');

    expect(mockPush).toHaveBeenCalledWith('/visitapapa');
    expect(takePendingMasScreen()).toBeNull();
  });
});

describe('goToTab — iOS sin evento (el calendario cabe en la barra)', () => {
  beforeEach(() => {
    mockVisibleTabs = new Set(SIN_EVENTO);
  });

  it('va DIRECTO al calendario, sin pasar por "Más"', () => {
    // El bug original: aquí se hacía push('/mas') y se aterrizaba en otro tab.
    render().goToTab('calendario');

    expect(mockPush).toHaveBeenCalledWith('/calendario');
    expect(takePendingMasScreen()).toBeNull();
  });

  it('con fecha, la manda como params de la ruta', () => {
    render().goToTab('calendario', { date: '2026-12-25' });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/calendario',
      params: { date: '2026-12-25' },
    });
    expect(takePendingMasScreen()).toBeNull();
  });
});

describe('goToTab — Android y web', () => {
  it.each(['android', 'web'])('%s va directo aunque haya overflow', (os) => {
    mockPlatform = os;
    render().goToTab('calendario', { date: '2026-01-01' });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/calendario',
      params: { date: '2026-01-01' },
    });
    expect(takePendingMasScreen()).toBeNull();
  });
});

describe('goToTab — casos límite', () => {
  it('un tab que el perfil no trae entra por su espejo de "Más"', () => {
    mockVisibleTabs = new Set(['index', 'cancionero', 'mas']);
    render().goToTab('calendario');

    expect(mockPush).toHaveBeenCalledWith('/mas');
    expect(takePendingMasScreen()).toEqual({
      screen: 'Calendario',
      params: undefined,
    });
  });

  it('sin espejo posible aterriza en "Más" SIN destino pendiente', () => {
    mockVisibleTabs = new Set(['index', 'mas']);
    render().goToTab('cancionero');

    expect(mockPush).toHaveBeenCalledWith('/mas');
    expect(takePendingMasScreen()).toBeNull();
  });

  it('sin "Más" en el perfil no manda a "Más": intenta el directo', () => {
    mockVisibleTabs = new Set(['index', 'cancionero']);
    render().goToTab('calendario');

    expect(mockPush).toHaveBeenCalledWith('/calendario');
    expect(takePendingMasScreen()).toBeNull();
  });

  it('no deja pendientes cruzados: un goToTab directo no ensucia el store', () => {
    const api = render();
    api.goToTab('calendario'); // deja pendiente
    takePendingMasScreen(); // alguien lo consume
    api.goToTab('cancionero'); // directo

    expect(mockPush).toHaveBeenLastCalledWith('/cancionero');
    expect(takePendingMasScreen()).toBeNull();
  });
});

describe('goToEventScreen', () => {
  it('entra por el tab del evento cuando ese tab tiene ruta', () => {
    render().goToEventScreen('Evaluacion', { eventId: 'visitapapa' });

    expect(mockPush).toHaveBeenCalledWith('/visitapapa');
    expect(takePendingEventScreen()).toEqual({
      screen: 'Evaluacion',
      params: { eventId: 'visitapapa' },
    });
    expect(takePendingMasScreen()).toBeNull();
  });

  it('con el evento archivado (tab fuera) entra por "Más"', () => {
    mockVisibleTabs = new Set(SIN_EVENTO);
    render().goToEventScreen('Evaluacion', { eventId: 'visitapapa' });

    expect(mockPush).toHaveBeenCalledWith('/mas');
    expect(takePendingMasScreen()).toEqual({
      screen: 'Evaluacion',
      params: { eventId: 'visitapapa' },
    });
    expect(takePendingEventScreen()).toBeNull();
  });

  it('sin evento activo no navega a ninguna parte', () => {
    mockActiveEvent = { id: '', tabId: undefined };
    render().goToEventScreen('Evaluacion');

    expect(mockPush).not.toHaveBeenCalled();
    expect(takePendingMasScreen()).toBeNull();
    expect(takePendingEventScreen()).toBeNull();
  });
});
