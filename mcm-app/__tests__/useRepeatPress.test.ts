/**
 * `useRepeatPress`: toque corto = un paso; pulsación mantenida = repite hasta
 * soltar o hasta el tope, y en el tope deja de repetir.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useRepeatPress } from '@/hooks/useRepeatPress';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useRepeatPress', () => {
  it('un toque corto da un solo paso', async () => {
    const step = jest.fn(() => true);
    const { result } = await renderHook(() => useRepeatPress(step));
    await act(async () => result.current.onPress());
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('al mantener da un paso al instante y luego repite cada intervalo', async () => {
    const step = jest.fn(() => true);
    const { result } = await renderHook(() =>
      useRepeatPress(step, { intervalMs: 100 }),
    );
    await act(async () => result.current.onLongPress());
    expect(step).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(step).toHaveBeenCalledTimes(4);
  });

  it('al soltar deja de repetir', async () => {
    const step = jest.fn(() => true);
    const { result } = await renderHook(() =>
      useRepeatPress(step, { intervalMs: 100 }),
    );
    await act(async () => result.current.onLongPress());
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    await act(async () => result.current.onPressOut());
    const calls = step.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(step).toHaveBeenCalledTimes(calls);
  });

  it('en el tope deja de repetir', async () => {
    let n = 0;
    const step = jest.fn(() => ++n < 3);
    const { result } = await renderHook(() =>
      useRepeatPress(step, { intervalMs: 100 }),
    );
    await act(async () => result.current.onLongPress());
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(step).toHaveBeenCalledTimes(3);
  });

  it('si ya está en el tope al empezar, no arranca el intervalo', async () => {
    const step = jest.fn(() => false);
    const { result } = await renderHook(() => useRepeatPress(step));
    await act(async () => result.current.onLongPress());
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('usa siempre la última versión de `step`', async () => {
    const first = jest.fn(() => true);
    const second = jest.fn(() => true);
    const { result, rerender } = await renderHook(
      ({ s }: { s: () => boolean }) => useRepeatPress(s, { intervalMs: 100 }),
      { initialProps: { s: first } },
    );
    await act(async () => result.current.onLongPress());
    await rerender({ s: second });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('se para al desmontar', async () => {
    const step = jest.fn(() => true);
    const { result, unmount } = await renderHook(() =>
      useRepeatPress(step, { intervalMs: 100 }),
    );
    await act(async () => result.current.onLongPress());
    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(step).toHaveBeenCalledTimes(1);
  });
});
