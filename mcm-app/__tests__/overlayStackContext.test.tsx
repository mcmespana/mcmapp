/**
 * Tests de `OverlayStackContext`: pila LIFO de overlays abiertos, para que
 * un único handler global de Esc (web) cierre siempre el que está encima
 * — no el primero que se abrió. `useKeyboardShortcut` (web-only) va
 * mockeado para capturar el callback y dispararlo a mano.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import {
  OverlayStackProvider,
  useOverlayStack,
} from '@/contexts/OverlayStackContext';

jest.mock('@/hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: jest.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OverlayStackProvider>{children}</OverlayStackProvider>
);

async function mount() {
  return renderHook(() => useOverlayStack(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('push / pop / closeTop', () => {
  it('closeTop en una pila vacía devuelve false y no revienta', async () => {
    const { result } = await mount();
    expect(result.current.closeTop()).toBe(false);
  });

  it('cierra el que está ENCIMA (el último empujado), no el primero', async () => {
    const { result } = await mount();
    const closeA = jest.fn();
    const closeB = jest.fn();
    await act(async () => {
      result.current.push({ id: 'a', onClose: closeA });
      result.current.push({ id: 'b', onClose: closeB });
    });
    const handled = result.current.closeTop();
    expect(handled).toBe(true);
    expect(closeB).toHaveBeenCalled();
    expect(closeA).not.toHaveBeenCalled();
  });

  it('tras cerrar el de arriba, el siguiente closeTop llega al que quedaba debajo (si nadie hizo pop)', async () => {
    const { result } = await mount();
    const closeA = jest.fn();
    const closeB = jest.fn();
    await act(async () => {
      result.current.push({ id: 'a', onClose: closeA });
      result.current.push({ id: 'b', onClose: closeB });
    });
    result.current.closeTop();
    // El propio overlay B es quien debe hacer `pop('b')` al cerrarse de
    // verdad; si no lo hace, closeTop lo volvería a intentar con el mismo.
    await act(async () => result.current.pop('b'));
    result.current.closeTop();
    expect(closeA).toHaveBeenCalled();
  });

  it('pop quita solo el overlay indicado, no toda la pila', async () => {
    const { result } = await mount();
    const closeA = jest.fn();
    const closeB = jest.fn();
    await act(async () => {
      result.current.push({ id: 'a', onClose: closeA });
      result.current.push({ id: 'b', onClose: closeB });
      result.current.pop('a');
    });
    result.current.closeTop();
    expect(closeB).toHaveBeenCalled();
    expect(closeA).not.toHaveBeenCalled();
  });

  it('push con un id repetido lo mueve arriba en vez de duplicarlo', async () => {
    const { result } = await mount();
    const closeA = jest.fn();
    const closeB = jest.fn();
    await act(async () => {
      result.current.push({ id: 'a', onClose: closeA });
      result.current.push({ id: 'b', onClose: closeB });
      // Re-empujar 'a' (p. ej. se reabre) debe ponerlo de nuevo arriba.
      result.current.push({ id: 'a', onClose: closeA });
    });
    result.current.closeTop();
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).not.toHaveBeenCalled();
  });
});

describe('handler global de Esc', () => {
  it('se engancha a useKeyboardShortcut("Escape", ...)', async () => {
    await mount();
    expect(useKeyboardShortcut).toHaveBeenCalledWith(
      'Escape',
      expect.any(Function),
      expect.objectContaining({ preventDefault: false }),
    );
  });

  it('al disparar Esc, cierra el overlay de arriba', async () => {
    const { result } = await mount();
    const close = jest.fn();
    await act(async () => result.current.push({ id: 'a', onClose: close }));
    const escHandler = (useKeyboardShortcut as jest.Mock).mock.calls[0][1];
    await act(async () => escHandler());
    expect(close).toHaveBeenCalled();
  });
});

describe('fuera del provider', () => {
  it('devuelve un stack no-op seguro', async () => {
    const { result } = await renderHook(() => useOverlayStack());
    expect(result.current.closeTop()).toBe(false);
    expect(() => result.current.push({ id: 'a', onClose: jest.fn() })).not.toThrow();
    expect(() => result.current.pop('a')).not.toThrow();
  });
});
