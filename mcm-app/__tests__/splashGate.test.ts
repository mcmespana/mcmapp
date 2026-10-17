/**
 * Tests de `utils/splashGate.ts`: quién quita el splash nativo.
 *
 * Lo que no se puede romper sin enterarse:
 *  1. El splash se suelta UNA vez, la primera que alguien lo pide.
 *  2. Si nadie lo suelta (algo ha fallado en el arranque), el tope de
 *     seguridad lo suelta igual: la app no se queda colgada en el logo.
 */
import * as SplashScreen from 'expo-splash-screen';
import {
  __resetSplashGateForTests,
  holdSplash,
  releaseSplash,
  SPLASH_SAFETY_MS,
} from '@/utils/splashGate';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const prevent = SplashScreen.preventAutoHideAsync as jest.Mock;
const hide = SplashScreen.hideAsync as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  __resetSplashGateForTests();
  prevent.mockClear();
  hide.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('splashGate', () => {
  it('retiene el splash y lo suelta cuando el layout lo pide', () => {
    holdSplash();
    expect(prevent).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();

    releaseSplash();
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('soltarlo varias veces solo llama a hideAsync una', () => {
    holdSplash();
    releaseSplash();
    releaseSplash();
    jest.advanceTimersByTime(SPLASH_SAFETY_MS * 2);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('el tope de seguridad lo suelta si nadie lo hace', () => {
    holdSplash();
    jest.advanceTimersByTime(SPLASH_SAFETY_MS - 1);
    expect(hide).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('el tope de seguridad es corto: unos segundos, no más', () => {
    expect(SPLASH_SAFETY_MS).toBeGreaterThanOrEqual(1000);
    expect(SPLASH_SAFETY_MS).toBeLessThanOrEqual(5000);
  });

  it('retener dos veces no arma dos temporizadores', () => {
    holdSplash();
    holdSplash();
    expect(prevent).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(SPLASH_SAFETY_MS);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('un hideAsync que falla no revienta', async () => {
    hide.mockImplementationOnce(() => Promise.reject(new Error('no splash')));
    holdSplash();
    expect(() => releaseSplash()).not.toThrow();
    await Promise.resolve();
  });
});
