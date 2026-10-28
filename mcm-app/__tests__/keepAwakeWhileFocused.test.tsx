/**
 * `useKeepAwakeWhileFocused`: la pantalla del cantoral no se apaga mientras se
 * toca, y se suelta al perder el foco. `useFocusEffect` va mockeado como un
 * efecto normal (foco = montado, blur = desmontado).
 */
import { renderHook } from '@testing-library/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useKeepAwakeWhileFocused } from '@/hooks/useKeepAwakeWhileFocused';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router/react-navigation', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const activate = activateKeepAwakeAsync as jest.Mock;
const deactivate = deactivateKeepAwake as jest.Mock;

/** Deja correr las promesas pendientes. */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
});

it('activa al tener el foco y suelta la MISMA tag al perderlo', async () => {
  const { unmount } = await renderHook(() =>
    useKeepAwakeWhileFocused('song-detail'),
  );
  expect(activate).toHaveBeenCalledTimes(1);
  const tag = activate.mock.calls[0][0];
  expect(tag).toMatch(/^song-detail-/);

  await unmount();
  await flush();
  expect(deactivate).toHaveBeenCalledWith(tag);
});

it('cada activación lleva su propia tag (salir y volver rápido no se pisa)', async () => {
  const a = await renderHook(() => useKeepAwakeWhileFocused('x'));
  const b = await renderHook(() => useKeepAwakeWhileFocused('x'));
  expect(activate.mock.calls[0][0]).not.toBe(activate.mock.calls[1][0]);
  await a.unmount();
  await b.unmount();
});

it('si el sistema no lo concede (web sin Wake Lock), no intenta soltarlo', async () => {
  activate.mockImplementationOnce(() => Promise.reject(new Error('no')));
  const { unmount } = await renderHook(() => useKeepAwakeWhileFocused('fs'));
  await unmount();
  await flush();
  expect(deactivate).not.toHaveBeenCalled();
});
