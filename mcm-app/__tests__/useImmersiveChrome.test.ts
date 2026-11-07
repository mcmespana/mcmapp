/**
 * Pantalla completa: los controles se apagan solos y vuelven con un toque.
 * Si el temporizador no se reinicia, se esconden mientras se usan; si nunca
 * salta, tapan la letra (en web pasó: react-native-web dice siempre que hay
 * lector de pantalla).
 */
import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import {
  IMMERSIVE_HIDE_MS,
  useImmersiveChrome,
} from '@/hooks/useImmersiveChrome';

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: number) => ({ get: () => v, set: () => {} }),
  useAnimatedStyle: () => ({}),
  withTiming: (v: number) => v,
}));
jest.mock('@/constants/animations', () => ({
  durations: { quick: 150, base: 250, slow: 300 },
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('se ven al entrar y se esconden solos', async () => {
  const { result } = await renderHook(() => useImmersiveChrome());
  expect(result.current.shown).toBe(true);
  await act(async () => {
    jest.advanceTimersByTime(IMMERSIVE_HIDE_MS + 10);
  });
  expect(result.current.shown).toBe(false);
});

it('un toque los enseña y vuelve a contar desde cero', async () => {
  const { result } = await renderHook(() => useImmersiveChrome());
  await act(async () => {
    jest.advanceTimersByTime(IMMERSIVE_HIDE_MS - 500);
  });
  await act(async () => {
    result.current.poke();
  });
  await act(async () => {
    jest.advanceTimersByTime(IMMERSIVE_HIDE_MS - 500);
  });
  expect(result.current.shown).toBe(true);
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
  expect(result.current.shown).toBe(false);
  await act(async () => {
    result.current.poke();
  });
  expect(result.current.shown).toBe(true);
});

it('con lector de pantalla no se esconden nunca', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(true);
  const { result } = await renderHook(() => useImmersiveChrome());
  await act(async () => {
    jest.advanceTimersByTime(IMMERSIVE_HIDE_MS * 3);
  });
  expect(result.current.shown).toBe(true);
});
