/**
 * `useSundaySongs`: lo que se cambia queda POR FECHA en el dispositivo, se poda
 * lo viejo al abrir y todo funciona sin red (AsyncStorage + el cantoral ya
 * cacheado).
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSundaySongs } from '@/hooks/useSundaySongs';
import { SUNDAY_PICKS_KEY } from '@/utils/sundaySongs';
import type { SongsData } from '@/utils/filterSongsData';

const mockSongs: SongsData = {
  entrada: {
    categoryTitle: 'D. Entrada',
    songs: ['e1', 'e2', 'e3'].map((f) => ({ title: f, filename: f })),
  },
  salida: {
    categoryTitle: 'G. Salida',
    songs: ['s1', 's2'].map((f) => ({ title: f, filename: f })),
  },
};

jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: (path: string) => ({
    data: path === 'songs' ? mockSongs : null,
    loading: false,
    offline: true,
    refresh: jest.fn(),
  }),
}));
jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { hideHiddenTagSongs: false } }),
}));

const FECHA = '2026-11-22';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(new Date('2026-11-17T10:00:00'));
});
afterEach(() => jest.useRealTimers());

const entrada = (r: { current: ReturnType<typeof useSundaySongs> }) =>
  r.current.mass.find((m) => m.moment === 'entrada')!;

describe('useSundaySongs', () => {
  it('da el día litúrgico y la misa propuesta, sin red', async () => {
    const { result } = await renderHook(() => useSundaySongs(FECHA));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.day.feastId).toBe('cristo_rey');
    expect(result.current.hasSongs).toBe(true);
    expect(entrada(result).chosenIndex).toBe(0);
    expect(result.current.customized).toBe(false);
  });

  it('«Cambiar» pasa a la siguiente y se guarda por fecha', async () => {
    const { result } = await renderHook(() => useSundaySongs(FECHA));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const first = entrada(result).candidates[0].filename;
    await act(async () => result.current.change('entrada'));
    expect(
      entrada(result).candidates[entrada(result).chosenIndex].filename,
    ).not.toBe(first);
    expect(result.current.customized).toBe(true);
    await waitFor(async () => {
      const raw = JSON.parse(
        (await AsyncStorage.getItem(SUNDAY_PICKS_KEY)) ?? '{}',
      );
      expect(Object.keys(raw[FECHA])).toEqual(['entrada']);
    });
  });

  it('al volver (otro montaje) enseña lo que se dejó', async () => {
    const a = await renderHook(() => useSundaySongs(FECHA));
    await waitFor(() => expect(a.result.current.ready).toBe(true));
    await act(async () => a.result.current.remove('salida'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(SUNDAY_PICKS_KEY)).toContain('quitado'),
    );
    await a.unmount();

    const b = await renderHook(() => useSundaySongs(FECHA));
    await waitFor(() => expect(b.result.current.ready).toBe(true));
    const salida = b.result.current.mass.find((m) => m.moment === 'salida')!;
    expect(salida.removed).toBe(true);
    expect(salida.chosenIndex).toBe(-1);
    // Otra fecha no hereda nada.
    const c = await renderHook(() => useSundaySongs('2026-11-29'));
    await waitFor(() => expect(c.result.current.ready).toBe(true));
    expect(c.result.current.customized).toBe(false);
  });

  it('restore y resetAll vuelven a la propuesta', async () => {
    const { result } = await renderHook(() => useSundaySongs(FECHA));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => result.current.remove('salida'));
    await act(async () => result.current.restore('salida'));
    expect(result.current.customized).toBe(false);
    await act(async () => result.current.change('entrada'));
    await act(async () => result.current.resetAll());
    expect(result.current.customized).toBe(false);
  });

  it('al abrir poda las fechas a más de 60 días y no toca las demás', async () => {
    await AsyncStorage.setItem(
      SUNDAY_PICKS_KEY,
      JSON.stringify({
        '2026-01-04': { entrada: 'e2' },
        [FECHA]: { entrada: 'e2' },
      }),
    );
    const { result } = await renderHook(() => useSundaySongs(FECHA));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(
      entrada(result).candidates[entrada(result).chosenIndex].filename,
    ).toBe('e2');
    await waitFor(async () => {
      const raw = JSON.parse(
        (await AsyncStorage.getItem(SUNDAY_PICKS_KEY)) ?? '{}',
      );
      expect(Object.keys(raw)).toEqual([FECHA]);
    });
  });

  it('un guardado corrupto no rompe: se parte de la propuesta', async () => {
    await AsyncStorage.setItem(SUNDAY_PICKS_KEY, '{{{');
    const { result } = await renderHook(() => useSundaySongs(FECHA));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(entrada(result).chosenIndex).toBe(0);
  });
});
