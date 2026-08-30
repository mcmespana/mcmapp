/**
 * Tests de `h` (utils/haptics.ts) — el punto único de feedback háptico.
 *
 * Dos invariantes que se rompen sin enterarse:
 *  1. En web NO se puede llamar a expo-haptics (peta o avisa por consola).
 *  2. Las secuencias (`formSuccess`, `carismoOn`, `carismoOff`) programan sus
 *     golpes con `setTimeout`; si alguien cambia los retardos, aquí se ve.
 */
import { Platform } from 'react-native';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

function loadHaptics(os: 'ios' | 'android' | 'web') {
  jest.resetModules();
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
  // `isNative` se calcula al importar el módulo, de ahí el require tardío.
  return {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    h: require('@/utils/haptics').h,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Haptics: require('expo-haptics'),
  };
}

const REAL_OS = Platform.OS;

afterEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', {
    get: () => REAL_OS,
    configurable: true,
  });
});

describe('en web no se llama a expo-haptics', () => {
  it('ninguna función dispara feedback', () => {
    const { h, Haptics } = loadHaptics('web');
    h.tap();
    h.select();
    h.add();
    h.remove();
    h.success();
    h.error();
    h.toggle();
    h.menuOpen();
    h.menuClose();
    h.navigate();
    h.shake();
    h.formSuccess();
    h.carismoOn();
    h.carismoOff();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });
});

describe('en iOS', () => {
  it('mapea cada acción a su intensidad', () => {
    const { h, Haptics } = loadHaptics('ios');
    h.tap();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('light');
    h.add();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('medium');
    h.remove();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('rigid');
    h.shake();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('heavy');
    h.menuOpen();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('medium');
    h.menuClose();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('light');
    h.navigate();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('light');
    h.toggle();
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('rigid');
    h.success();
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('success');
    h.error();
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('error');
  });

  it('select usa selectionAsync (solo iOS lo tiene)', () => {
    const { h, Haptics } = loadHaptics('ios');
    h.select();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

describe('en Android', () => {
  it('select cae a un impacto ligero', () => {
    const { h, Haptics } = loadHaptics('android');
    h.select();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });
});

describe('secuencias con retardo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('formSuccess: ligero → medio (100 ms) → success (250 ms)', () => {
    const { h, Haptics } = loadHaptics('ios');
    h.formSuccess();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('medium');

    jest.advanceTimersByTime(150);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('carismoOn: medio → fuerte (90 ms) → success (220 ms)', () => {
    const { h, Haptics } = loadHaptics('ios');
    h.carismoOn();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    jest.advanceTimersByTime(90);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('heavy');
    jest.advanceTimersByTime(130);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('carismoOff: rígido → ligero (110 ms)', () => {
    const { h, Haptics } = loadHaptics('ios');
    h.carismoOff();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('rigid');
    jest.advanceTimersByTime(110);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('light');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
