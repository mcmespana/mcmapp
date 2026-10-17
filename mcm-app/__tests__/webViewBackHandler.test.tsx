/**
 * `useWebViewBackHandler`: en Android, el atrás de una web embebida (MCM
 * Panel, Gestión de Comunica) navega primero por su historial y solo sale de
 * la pantalla cuando ya no hay a dónde volver.
 */
import { BackHandler, Platform } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { useWebViewBackHandler } from '@/hooks/useWebViewBackHandler';

jest.mock('expo-router/react-navigation', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const nav = (canGoBack: boolean) => ({ canGoBack }) as WebViewNavigation;

let handler: (() => boolean) | null = null;
const remove = jest.fn();

beforeEach(() => {
  handler = null;
  remove.mockClear();
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, cb) => {
      handler = cb as () => boolean;
      return { remove };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('en Android', () => {
  const realOS = Platform.OS;
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
  });
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: realOS });
  });

  it('sin historial deja que el atrás salga de la pantalla', async () => {
    await renderHook(() => useWebViewBackHandler());
    expect(handler).not.toBeNull();
    expect(handler!()).toBe(false);
  });

  it('con historial vuelve atrás DENTRO de la web', async () => {
    const { result } = await renderHook(() => useWebViewBackHandler());
    const goBack = jest.fn();
    (result.current.webViewRef as { current: unknown }).current = { goBack };
    result.current.onNavigationStateChange(nav(true));
    expect(handler!()).toBe(true);
    expect(goBack).toHaveBeenCalledTimes(1);

    result.current.onNavigationStateChange(nav(false));
    expect(handler!()).toBe(false);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('suelta el listener al perder el foco', async () => {
    const { unmount } = await renderHook(() => useWebViewBackHandler());
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});

it('fuera de Android no se engancha al botón atrás', async () => {
  await renderHook(() => useWebViewBackHandler());
  expect(handler).toBeNull();
});
