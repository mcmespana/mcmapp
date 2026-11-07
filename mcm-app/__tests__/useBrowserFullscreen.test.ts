/**
 * Pantalla completa del navegador en el modo presentación (web): F la pone y
 * la quita sin cerrar nada; si se sale por fuera (Esc, que el navegador no
 * pasa a la página), se cierra la presentación con un solo Esc.
 */
import { act, renderHook } from '@testing-library/react-native';
import {
  useBrowserFullscreen,
  type FullscreenDocument,
} from '@/hooks/useBrowserFullscreen';

function fakeDocument(enabled = true) {
  const listeners = new Set<() => void>();
  const doc: FullscreenDocument & { fire: (on: boolean) => void } = {
    fullscreenEnabled: enabled,
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: jest.fn(async () => {
        doc.fire(true);
      }),
    },
    exitFullscreen: jest.fn(async () => {
      doc.fire(false);
    }),
    addEventListener: (_t, cb) => listeners.add(cb),
    removeEventListener: (_t, cb) => listeners.delete(cb),
    fire: (on) => {
      doc.fullscreenElement = on ? {} : null;
      listeners.forEach((cb) => cb());
    },
  };
  return doc;
}

describe('useBrowserFullscreen', () => {
  it('toggle la pone y la quita sin cerrar la presentación', async () => {
    const doc = fakeDocument();
    const onExit = jest.fn();
    const { result } = await renderHook(() =>
      useBrowserFullscreen(onExit, doc),
    );
    expect(result.current.supported).toBe(true);
    await act(async () => result.current.toggle());
    expect(result.current.active).toBe(true);
    await act(async () => result.current.toggle());
    expect(result.current.active).toBe(false);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('salir por fuera (Esc del navegador) cierra la presentación', async () => {
    const doc = fakeDocument();
    const onExit = jest.fn();
    const { result } = await renderHook(() =>
      useBrowserFullscreen(onExit, doc),
    );
    await act(async () => result.current.toggle());
    await act(async () => doc.fire(false));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('al desmontar con ella puesta, se sale (sin volver a cerrar)', async () => {
    const doc = fakeDocument();
    const onExit = jest.fn();
    const { result, unmount } = await renderHook(() =>
      useBrowserFullscreen(onExit, doc),
    );
    await act(async () => result.current.toggle());
    await act(async () => unmount());
    expect(doc.exitFullscreen).toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('sin la API (nativo, Safari de iPhone) no hace nada', async () => {
    const off = await renderHook(() => useBrowserFullscreen(jest.fn(), null));
    expect(off.result.current.supported).toBe(false);
    const doc = fakeDocument(false);
    const { result } = await renderHook(() =>
      useBrowserFullscreen(jest.fn(), doc),
    );
    expect(result.current.supported).toBe(false);
    result.current.toggle();
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
  });
});
