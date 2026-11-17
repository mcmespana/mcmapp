import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HINT_LEARNED,
  HINT_MAX_SHOWS,
  __resetGestureHintSession,
  isHintDue,
  useGestureHint,
} from '@/hooks/useGestureHint';

beforeEach(async () => {
  __resetGestureHintSession();
  await AsyncStorage.clear();
});

describe('isHintDue', () => {
  it('sale las primeras veces y deja de salir al llegar al máximo', () => {
    expect(isHintDue(null)).toBe(true);
    expect(isHintDue(String(HINT_MAX_SHOWS - 1))).toBe(true);
    expect(isHintDue(String(HINT_MAX_SHOWS))).toBe(false);
    expect(isHintDue(String(HINT_LEARNED))).toBe(false);
  });
});

describe('useGestureHint', () => {
  it('cuenta cada vez que se enseña y no repite en la misma sesión', async () => {
    const { result, unmount } = await renderHook(() =>
      useGestureHint('t.count'),
    );
    await waitFor(() => expect(result.current.due).toBe(true));
    await act(async () => result.current.consume());
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('gestureHint:t.count')).toBe('1'),
    );
    await unmount();
    // Misma sesión: aunque queden usos, no vuelve a salir.
    const again = await renderHook(() => useGestureHint('t.count'));
    await act(async () => {});
    expect(again.result.current.due).toBe(false);
    await again.unmount();
  });

  it('una vez usado el gesto no vuelve a salir nunca', async () => {
    const { result } = await renderHook(() => useGestureHint('t.learned'));
    await waitFor(() => expect(result.current.due).toBe(true));
    await act(async () => result.current.markLearned());
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('gestureHint:t.learned')).toBe(
        String(HINT_LEARNED),
      ),
    );
    __resetGestureHintSession();
    const next = await renderHook(() => useGestureHint('t.learned'));
    await act(async () => {});
    expect(next.result.current.due).toBe(false);
    await next.unmount();
  });
});
