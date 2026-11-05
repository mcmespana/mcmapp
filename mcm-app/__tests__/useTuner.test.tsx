/**
 * `useTuner`: cuándo abre y suelta el micrófono, y que lo que entra por él
 * acaba en una lectura. El micrófono va mockeado (es un TurboModule) y
 * `useFocusEffect` es un efecto normal: foco = montado, blur = desmontado.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useTuner } from '@/hooks/useTuner';
import * as mic from '@/services/tuner/microphone';
import type { StartMicOptions } from '@/services/tuner/types';

jest.mock('expo-router/react-navigation', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

jest.mock('@/services/tuner/microphone', () => ({
  isMicrophoneSupported: jest.fn(() => true),
  getMicrophonePermission: jest.fn(),
  requestMicrophonePermission: jest.fn(),
  startMicrophone: jest.fn(),
}));

const getPerm = mic.getMicrophonePermission as jest.Mock;
const requestPerm = mic.requestMicrophonePermission as jest.Mock;
const startMic = mic.startMicrophone as jest.Mock;

const SR = 48000;
const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

function sine(hz: number, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = 0.3 * Math.sin((2 * Math.PI * hz * i) / SR);
  return out;
}

let onFrame: StartMicOptions['onFrame'] | null = null;
const stop = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  onFrame = null;
  startMic.mockImplementation(async (opts: StartMicOptions) => {
    onFrame = opts.onFrame;
    return { sampleRate: SR, stop };
  });
});

it('con permiso ya concedido, escucha nada más entrar y suelta al salir', async () => {
  getPerm.mockResolvedValue('granted');
  const { result, unmount } = await renderHook(() => useTuner());
  await flush();
  expect(startMic).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('listening');

  await unmount();
  expect(stop).toHaveBeenCalled();
});

it('sin permiso todavía, NO abre el diálogo hasta que se pulsa', async () => {
  getPerm.mockResolvedValue('undetermined');
  requestPerm.mockResolvedValue('granted');
  const { result } = await renderHook(() => useTuner());
  await flush();
  expect(result.current.status).toBe('needs-permission');
  expect(requestPerm).not.toHaveBeenCalled();

  await act(async () => result.current.start());
  await flush();
  expect(requestPerm).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('listening');
});

it('denegado: se queda en «denied» y no abre el micrófono', async () => {
  getPerm.mockResolvedValue('denied');
  const { result } = await renderHook(() => useTuner());
  await flush();
  expect(result.current.status).toBe('denied');
  expect(startMic).not.toHaveBeenCalled();
});

it('el audio que entra acaba en una lectura (un La al aire)', async () => {
  getPerm.mockResolvedValue('granted');
  const nowSpy = jest.spyOn(Date, 'now');
  let now = 1_000;
  nowSpy.mockImplementation(() => now);
  const { result } = await renderHook(() => useTuner());
  await flush();
  const signal = sine(110, 4096 * 20);
  await act(async () => {
    for (let k = 0; k < 30; k++) {
      now += 50;
      onFrame!(signal.subarray(k * 2048, k * 2048 + 2048), SR);
    }
  });
  nowSpy.mockRestore();
  expect(result.current.reading.status).toBe('pitch');
  expect(result.current.reading.stringIndex).toBe(1);
  expect(result.current.reading.inTune).toBe(true);
  // Y la cuerda queda marcada como afinada para el resto de la sesión.
  expect([...result.current.tuned]).toEqual([1]);
});
