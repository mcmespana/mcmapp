/**
 * El metrónomo al cerrar la hoja (`MetronomeContext`): sonando pregunta si
 * dejarlo sonando; «Sí» lo deja, «No» lo para, y «No volver a preguntar»
 * guarda la respuesta (también en `@metronome`).
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MetronomeProvider, useMetronome } from '@/contexts/MetronomeContext';

const mockStop = jest.fn();
jest.mock('@/services/metronome/engine', () => ({
  startMetronome: jest.fn(async () => ({ stop: mockStop })),
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MetronomeProvider>{children}</MetronomeProvider>
);

async function playing() {
  const hook = await renderHook(() => useMetronome(), { wrapper });
  await act(async () => {
    hook.result.current.toggle();
  });
  await waitFor(() => expect(hook.result.current.playing).toBe(true));
  return hook;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it('parado, cerrar la hoja no pregunta nada', async () => {
  const { result } = await renderHook(() => useMetronome(), { wrapper });
  await act(async () => result.current.sheetClosed());
  expect(result.current.asking).toBe(false);
});

it('sonando pregunta; «Sí» lo deja sonando', async () => {
  const { result } = await playing();
  await act(async () => result.current.sheetClosed());
  expect(result.current.asking).toBe(true);
  await act(async () => result.current.answer(true, false));
  expect(result.current.asking).toBe(false);
  expect(result.current.playing).toBe(true);
  expect(result.current.keepOnClose).toBe('ask');
});

it('«No» lo para', async () => {
  const { result } = await playing();
  await act(async () => result.current.sheetClosed());
  await act(async () => result.current.answer(false, false));
  expect(result.current.playing).toBe(false);
  expect(mockStop).toHaveBeenCalled();
});

it('«Sí» con «No volver a preguntar»: la próxima vez sigue sin preguntar', async () => {
  const { result } = await playing();
  await act(async () => result.current.sheetClosed());
  await act(async () => result.current.answer(true, true));
  expect(result.current.keepOnClose).toBe('keep');
  await waitFor(async () =>
    expect(JSON.parse((await AsyncStorage.getItem('@metronome'))!)).toEqual(
      expect.objectContaining({ keep: 'keep' }),
    ),
  );
  await act(async () => result.current.sheetClosed());
  expect(result.current.asking).toBe(false);
  expect(result.current.playing).toBe(true);
});

it('«No» con «No volver a preguntar»: la próxima vez se para sola', async () => {
  const { result } = await playing();
  await act(async () => result.current.sheetClosed());
  await act(async () => result.current.answer(false, true));
  expect(result.current.keepOnClose).toBe('stop');
  await act(async () => result.current.toggle());
  await waitFor(() => expect(result.current.playing).toBe(true));
  await act(async () => result.current.sheetClosed());
  expect(result.current.asking).toBe(false);
  expect(result.current.playing).toBe(false);
});
