/**
 * Resolución de destino de los accesos directos (Home, tarjetas de "Más",
 * deep-links de notificación).
 *
 * Es la pieza que decide si un atajo abre el tab directamente o entra por el
 * stack de "Más", y depende de tres cosas que cambian sin publicar versión: los
 * tabs del perfil, cuántos caben en la barra y la plataforma. Sin este test, un
 * cambio en la composición de la barra vuelve a dejar atajos que llevan a "Más"
 * a buscar una pantalla que ya no está ahí.
 */
import { Platform } from 'react-native';

// El router real de expo-router arrastra ESM que Jest no transforma, y aquí
// sólo se testea la DECISIÓN de destino, no la navegación en sí.
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
}));

import { resolveTabTarget, tabNameFromRoute } from '@/utils/tabNavigation';

const setPlatform = (os: 'ios' | 'android' | 'web') => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

const originalOS = Platform.OS;
afterAll(() => setPlatform(originalOS as 'ios' | 'android' | 'web'));

// Barra "normal": los 6 primeros de TABS_CONFIG (index, cancionero, contigo,
// comunica, visitapapa, calendario) + mas. Con 7 visibles, `calendario` es el
// que se cae de la barra.
const SEVEN_TABS = new Set([
  'index',
  'cancionero',
  'contigo',
  'comunica',
  'visitapapa',
  'calendario',
  'mas',
]);

// Caso del bug original: fotos y calendario SÍ están en la barra, así que el
// atajo de la Home no debe seguir entrando por "Más".
const TABS_WITH_FOTOS = new Set([
  'index',
  'cancionero',
  'contigo',
  'calendario',
  'fotos',
  'mas',
]);

describe('resolveTabTarget', () => {
  it('va directo al tab cuando está en la barra', () => {
    setPlatform('ios');
    expect(resolveTabTarget('fotos', TABS_WITH_FOTOS)).toEqual({
      kind: 'tab',
      tab: 'fotos',
    });
    expect(resolveTabTarget('calendario', TABS_WITH_FOTOS)).toEqual({
      kind: 'tab',
      tab: 'calendario',
    });
  });

  it('entra por "Más" cuando el tab no cabe en la barra', () => {
    setPlatform('ios');
    // Con 7 tabs visibles, calendario es el que se queda fuera.
    expect(resolveTabTarget('calendario', SEVEN_TABS)).toEqual({
      kind: 'mas',
      screen: 'Calendario',
    });
  });

  it('entra por "Más" cuando el tab no existe para el perfil', () => {
    setPlatform('ios');
    const sinComunica = new Set(['index', 'cancionero', 'mas']);
    expect(resolveTabTarget('comunica', sinComunica)).toEqual({
      kind: 'mas',
      screen: 'Comunica',
    });
  });

  it('un tab de evento cae al hub del evento dentro de "Más"', () => {
    setPlatform('ios');
    const sinEvento = new Set(['index', 'cancionero', 'mas']);
    expect(resolveTabTarget('visitapapa', sinEvento)).toEqual({
      kind: 'mas',
      screen: 'JubileoHome',
      params: { eventId: 'visitapapa26' },
    });
  });

  it('usa la pantalla pedida por el llamador como plan B si está en "Más"', () => {
    setPlatform('ios');
    const sinEvento = new Set(['index', 'mas']);
    expect(
      resolveTabTarget('visitapapa', sinEvento, {
        stackScreen: 'Evaluacion',
        stackParams: { eventId: 'visitapapa26' },
      }),
    ).toEqual({
      kind: 'mas',
      screen: 'Evaluacion',
      params: { eventId: 'visitapapa26' },
    });
  });

  it('en Android la ruta existe aunque el tab no esté en la barra', () => {
    setPlatform('android');
    // `cancionero` no tiene gemelo en "Más", pero su ruta de archivo existe.
    const sinCantoral = new Set(['index', 'contigo']);
    expect(resolveTabTarget('cancionero', sinCantoral)).toEqual({
      kind: 'tab',
      tab: 'cancionero',
    });
  });

  it('en iOS, sin trigger ni gemelo en "Más", el destino es inalcanzable', () => {
    setPlatform('ios');
    const sinCantoral = new Set(['index', 'contigo']);
    expect(resolveTabTarget('cancionero', sinCantoral)).toEqual({
      kind: 'unavailable',
    });
  });

  it('un tab desconocido no inventa ruta', () => {
    setPlatform('ios');
    expect(resolveTabTarget('inventado', SEVEN_TABS)).toEqual({
      kind: 'unavailable',
    });
  });

  it('en web todos los tabs visibles van directos', () => {
    setPlatform('web');
    expect(resolveTabTarget('calendario', SEVEN_TABS)).toEqual({
      kind: 'tab',
      tab: 'calendario',
    });
  });
});

describe('tabNameFromRoute', () => {
  it('saca el tab del grupo (tabs)', () => {
    expect(tabNameFromRoute('/(tabs)/fotos')).toBe('fotos');
    expect(tabNameFromRoute('/(tabs)/contigo/evangelio')).toBe('contigo');
  });

  it('acepta rutas sin grupo y con query', () => {
    expect(tabNameFromRoute('/calendario?date=2026-08-23')).toBe('calendario');
  });

  it('la raíz es la Home', () => {
    expect(tabNameFromRoute('/')).toBe('index');
  });

  it('devuelve null para rutas que no cuelgan de un tab', () => {
    expect(tabNameFromRoute('/wordle')).toBeNull();
    expect(tabNameFromRoute('/notifications')).toBeNull();
  });
});
