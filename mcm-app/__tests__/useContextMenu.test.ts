/**
 * Test de `hooks/useContextMenu.ts`.
 *
 * Traduce un mismo `handler` a long-press en nativo y a click-derecho en web.
 * Si la rama de plataforma se invierte, el menú contextual deja de abrirse en
 * una de las dos plataformas sin que salte ningún error visible.
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useContextMenu } from '@/hooks/useContextMenu';

afterEach(() => {
  Platform.OS = 'ios';
});

describe('useContextMenu', () => {
  it('sin handler, devuelve un objeto vacío', async () => {
    const { result } = await renderHook(() => useContextMenu(undefined));
    expect(result.current).toEqual({});
  });

  it('en nativo, devuelve onLongPress + delayLongPress', async () => {
    Platform.OS = 'android';
    const handler = jest.fn();
    const { result } = await renderHook(() => useContextMenu(handler));
    expect(result.current.onLongPress).toBe(handler);
    expect(result.current.delayLongPress).toBe(400);
    expect(result.current.onContextMenu).toBeUndefined();
  });

  it('en web, devuelve onContextMenu que llama al handler y previene el default', async () => {
    Platform.OS = 'web';
    const handler = jest.fn();
    const { result } = await renderHook(() => useContextMenu(handler));
    expect(result.current.onLongPress).toBeUndefined();

    const preventDefault = jest.fn();
    result.current.onContextMenu?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('en web, no revienta si el evento no trae preventDefault', async () => {
    Platform.OS = 'web';
    const handler = jest.fn();
    const { result } = await renderHook(() => useContextMenu(handler));
    expect(() => result.current.onContextMenu?.({})).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
