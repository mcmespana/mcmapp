/**
 * Test de `hooks/useRegisterServiceWorker.ts`.
 *
 * Registra el Service Worker de la PWA en web. Si esto lanza en vez de
 * capturar el error, o registra en nativo, rompe el arranque de la app.
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { useRegisterServiceWorker } from '@/hooks/useRegisterServiceWorker';

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const originalWindow = (global as { window?: unknown }).window;
const originalDocument = (global as { document?: unknown }).document;
const originalNavigator = (global as { navigator?: unknown }).navigator;

function makeFakeWindow() {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    addEventListener: (type: string, fn: () => void) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    fire: (type: string) => (listeners[type] || []).forEach((fn) => fn()),
  };
}

function install(readyState: string, register?: jest.Mock) {
  const fakeWindow = makeFakeWindow();
  (global as { window?: unknown }).window = fakeWindow;
  (global as { document?: unknown }).document = { readyState };
  (global as { navigator?: unknown }).navigator = register
    ? { serviceWorker: { register } }
    : {};
  return fakeWindow;
}

afterEach(() => {
  (global as { window?: unknown }).window = originalWindow;
  (global as { document?: unknown }).document = originalDocument;
  (global as { navigator?: unknown }).navigator = originalNavigator;
  jest.clearAllMocks();
});

describe('useRegisterServiceWorker', () => {
  it('no hace nada fuera de web', async () => {
    Platform.OS = 'ios';
    const register = jest.fn();
    install('complete', register);
    await renderHook(() => useRegisterServiceWorker());
    expect(register).not.toHaveBeenCalled();
  });

  it('no hace nada si el navegador no soporta serviceWorker', async () => {
    Platform.OS = 'web';
    install('complete');
    await expect(
      renderHook(() => useRegisterServiceWorker()),
    ).resolves.toBeDefined();
  });

  it('registra de inmediato si el documento ya cargó', async () => {
    Platform.OS = 'web';
    const register = jest.fn().mockResolvedValue({});
    install('complete', register);
    await renderHook(() => useRegisterServiceWorker());
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('espera al evento load si el documento aún no ha cargado', async () => {
    Platform.OS = 'web';
    const register = jest.fn().mockResolvedValue({});
    const fakeWindow = install('loading', register);
    await renderHook(() => useRegisterServiceWorker());
    expect(register).not.toHaveBeenCalled();
    fakeWindow.fire('load');
    expect(register).toHaveBeenCalled();
  });

  it('registra el warning si falla el registro, sin lanzar', async () => {
    Platform.OS = 'web';
    const register = jest.fn().mockRejectedValue(new Error('boom'));
    install('complete', register);
    await renderHook(() => useRegisterServiceWorker());
    await new Promise((r) => setTimeout(r, 0));
    expect(logger.warn).toHaveBeenCalled();
  });
});
