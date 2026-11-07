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
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  },
  AndroidHaptics: {
    Confirm: 'confirm',
    Reject: 'reject',
    Gesture_End: 'gesture-end',
    Clock_Tick: 'clock-tick',
    Context_Click: 'context-click',
    Long_Press: 'long-press',
    Virtual_Key: 'virtual-key',
    Segment_Tick: 'segment-tick',
  },
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
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
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
  // Háptica del sistema (performHapticFeedback), nunca el Vibrator: en Android
  // `impactAsync`/`notificationAsync` son un zumbido de motor.
  it('mapea cada acción a una háptica del sistema y no toca el Vibrator', () => {
    const { h, Haptics } = loadHaptics('android');
    const perform = Haptics.performAndroidHapticsAsync;
    h.tap();
    expect(perform).toHaveBeenLastCalledWith('context-click');
    h.navigate();
    expect(perform).toHaveBeenLastCalledWith('context-click');
    h.menuClose();
    expect(perform).toHaveBeenLastCalledWith('context-click');
    h.select();
    expect(perform).toHaveBeenLastCalledWith('segment-tick');
    h.add();
    expect(perform).toHaveBeenLastCalledWith('virtual-key');
    h.menuOpen();
    expect(perform).toHaveBeenLastCalledWith('virtual-key');
    h.remove();
    expect(perform).toHaveBeenLastCalledWith('gesture-end');
    h.toggle();
    expect(perform).toHaveBeenLastCalledWith('clock-tick');
    h.success();
    expect(perform).toHaveBeenLastCalledWith('confirm');
    h.error();
    expect(perform).toHaveBeenLastCalledWith('reject');
    h.limit();
    expect(perform).toHaveBeenLastCalledWith('reject');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('formSuccess es UN solo golpe de confirmación, sin la cadena de iOS', () => {
    jest.useFakeTimers();
    try {
      const { h, Haptics } = loadHaptics('android');
      h.formSuccess();
      jest.advanceTimersByTime(500);
      expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
      expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(
        'confirm',
      );
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('si el tipo no existe en ese Android, cae a uno que sí existe', async () => {
    const { h, Haptics } = loadHaptics('android');
    const perform = Haptics.performAndroidHapticsAsync as jest.Mock;
    // Segment_Tick es de Android 14: en uno más viejo la promesa se rechaza.
    perform.mockImplementationOnce(() => Promise.reject(new Error('n/a')));
    await h.select();
    expect(perform).toHaveBeenNthCalledWith(1, 'segment-tick');
    expect(perform).toHaveBeenNthCalledWith(2, 'clock-tick');

    perform.mockClear();
    perform.mockImplementationOnce(() => Promise.reject(new Error('n/a')));
    await h.success();
    expect(perform).toHaveBeenNthCalledWith(2, 'long-press');
  });

  it('un fallo de la háptica nunca sale como promesa rechazada', async () => {
    const { h, Haptics } = loadHaptics('android');
    (Haptics.performAndroidHapticsAsync as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('sin motor')),
    );
    await expect(h.tap()).resolves.toBeUndefined();
    await expect(h.error()).resolves.toBeUndefined();
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
