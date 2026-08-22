/**
 * Tests de `hooks/useKeyboardShortcut.ts`.
 *
 * Atajos de teclado en web (⌘K, flechas...). Si el matching de modificadores
 * o la detección de "el foco está en un input" fallan, el atajo se dispara
 * mientras el usuario escribe, o deja de funcionar del todo.
 *
 * No hay DOM real en el entorno de test (jest-environment-node): se simula
 * `window` con un `addEventListener`/`removeEventListener` mínimo que guarda
 * el handler para poder invocarlo a mano.
 */
import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

function makeFakeWindow() {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  return {
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    removeEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    fire: (type: string, event: unknown) => {
      (listeners[type] || []).forEach((fn) => fn(event));
    },
  };
}

let fakeWindow: ReturnType<typeof makeFakeWindow>;
const originalWindow = (global as { window?: unknown }).window;

beforeEach(() => {
  Platform.OS = 'web';
  fakeWindow = makeFakeWindow();
  (global as { window?: unknown }).window = fakeWindow;
});

afterEach(() => {
  (global as { window?: unknown }).window = originalWindow;
});

describe('useKeyboardShortcut', () => {
  it('no hace nada fuera de web', async () => {
    Platform.OS = 'ios';
    const handler = jest.fn();
    await renderHook(() => useKeyboardShortcut('k', handler));
    fakeWindow.fire('keydown', { key: 'k' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispara el handler al pulsar la tecla (case-insensitive)', async () => {
    const handler = jest.fn();
    const preventDefault = jest.fn();
    await renderHook(() => useKeyboardShortcut('K', handler));
    await act(async () => fakeWindow.fire('keydown', { key: 'k', preventDefault }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('acepta un array de teclas', async () => {
    const handler = jest.fn();
    await renderHook(() => useKeyboardShortcut(['+', '='], handler));
    await act(async () => fakeWindow.fire('keydown', { key: '=' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignora teclas que no coinciden', async () => {
    const handler = jest.fn();
    await renderHook(() => useKeyboardShortcut('k', handler));
    await act(async () => fakeWindow.fire('keydown', { key: 'j' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('exige el modificador meta/ctrl cuando se pide', async () => {
    const handler = jest.fn();
    await renderHook(() =>
      useKeyboardShortcut('k', handler, { meta: true }),
    );
    await act(async () => fakeWindow.fire('keydown', { key: 'k' }));
    expect(handler).not.toHaveBeenCalled();

    await act(async () =>
      fakeWindow.fire('keydown', { key: 'k', ctrlKey: true }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('exige shift/alt cuando se piden', async () => {
    const handler = jest.fn();
    await renderHook(() =>
      useKeyboardShortcut('k', handler, { shift: true, alt: true }),
    );
    await act(async () =>
      fakeWindow.fire('keydown', { key: 'k', shiftKey: true }),
    );
    expect(handler).not.toHaveBeenCalled();

    await act(async () =>
      fakeWindow.fire('keydown', { key: 'k', shiftKey: true, altKey: true }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('no dispara mientras se escribe en un input, salvo con meta', async () => {
    const handler = jest.fn();
    await renderHook(() => useKeyboardShortcut('k', handler));
    await act(async () =>
      fakeWindow.fire('keydown', {
        key: 'k',
        target: { tagName: 'INPUT' },
      }),
    );
    expect(handler).not.toHaveBeenCalled();

    const handlerMeta = jest.fn();
    await renderHook(() =>
      useKeyboardShortcut('k', handlerMeta, { meta: true }),
    );
    await act(async () =>
      fakeWindow.fire('keydown', {
        key: 'k',
        ctrlKey: true,
        target: { tagName: 'INPUT' },
      }),
    );
    expect(handlerMeta).toHaveBeenCalledTimes(1);
  });

  it('respeta contentEditable como "escribiendo"', async () => {
    const handler = jest.fn();
    await renderHook(() => useKeyboardShortcut('k', handler));
    await act(async () =>
      fakeWindow.fire('keydown', {
        key: 'k',
        target: { isContentEditable: true },
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('disabled desactiva el listener', async () => {
    const handler = jest.fn();
    await renderHook(() =>
      useKeyboardShortcut('k', handler, { disabled: true }),
    );
    await act(async () => fakeWindow.fire('keydown', { key: 'k' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('preventDefault: false no llama a e.preventDefault', async () => {
    const handler = jest.fn();
    const preventDefault = jest.fn();
    await renderHook(() =>
      useKeyboardShortcut('k', handler, { preventDefault: false }),
    );
    await act(async () =>
      fakeWindow.fire('keydown', { key: 'k', preventDefault }),
    );
    expect(preventDefault).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('siempre usa la última versión del handler (ref)', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(
      ({ h }: { h: () => void }) => useKeyboardShortcut('k', h),
      { initialProps: { h: first } },
    );
    await act(async () => rerender({ h: second }));
    await act(async () => fakeWindow.fire('keydown', { key: 'k' }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
