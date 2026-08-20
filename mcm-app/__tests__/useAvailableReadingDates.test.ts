/**
 * Tests de `useAvailableReadingDates`: qué días tienen lecturas disponibles
 * en Firebase (para pintar el calendario de CONTIGO). Usa `shallow=true`
 * sobre el REST de RTDB para traer solo las claves, cacheadas 6h. Lo
 * importante:
 *
 *  - Caché fresca (< 6h) no dispara red.
 *  - Caché vieja se muestra al instante mientras se refresca en segundo plano.
 *  - `enabled=false` no hace absolutamente nada (ni leer caché).
 *  - Sin `databaseURL` configurado, no intenta la petición.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '@/constants/firebase';
import { useAvailableReadingDates } from '@/hooks/useAvailableReadingDates';

jest.mock('@/constants/firebase', () => ({
  firebaseConfig: { databaseURL: 'https://mcmapp-test.firebaseio.com' },
}));

const CACHE_KEY = '@contigo_lecturas_dates';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function mockFetchOnce(json: unknown, ok = true) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(json),
  });
}

const realFetch = global.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('enabled=false', () => {
  it('no hace nada: ni caché ni red', async () => {
    const { result } = await renderHook(() =>
      useAvailableReadingDates(false),
    );
    expect(result.current).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('sin caché', () => {
  it('descarga y cachea solo las claves con forma de fecha ISO', async () => {
    mockFetchOnce({
      '2026-08-20': true,
      '2026-08-21': true,
      basura: true,
      updatedAt: 123,
    });
    const { result } = await renderHook(() => useAvailableReadingDates(true));
    await waitFor(() =>
      expect(result.current).toEqual(new Set(['2026-08-20', '2026-08-21'])),
    );
    const stored = JSON.parse((await AsyncStorage.getItem(CACHE_KEY))!);
    expect(stored.dates.sort()).toEqual(['2026-08-20', '2026-08-21']);
  });

  it('respuesta null → conjunto vacío, sin reventar', async () => {
    mockFetchOnce(null);
    const { result } = await renderHook(() => useAvailableReadingDates(true));
    await waitFor(() => expect(result.current).toEqual(new Set()));
  });

  it('si la respuesta no es ok, no actualiza dates ni cachea', async () => {
    mockFetchOnce({ '2026-08-20': true }, false);
    const { result } = await renderHook(() => useAvailableReadingDates(true));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('un fallo de red no revienta', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('sin red'));
    const { result } = await renderHook(() => useAvailableReadingDates(true));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('sin databaseURL configurado, no intenta la petición', async () => {
    const original = firebaseConfig.databaseURL;
    (firebaseConfig as { databaseURL?: string }).databaseURL = undefined;
    try {
      const { result } = await renderHook(() =>
        useAvailableReadingDates(true),
      );
      await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current).toBeNull();
    } finally {
      (firebaseConfig as { databaseURL?: string }).databaseURL = original;
    }
  });
});

describe('con caché', () => {
  it('caché fresca (< 6h): se muestra y NO se refresca por red', async () => {
    const now = 2_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: now - 1000, dates: ['2026-08-01'] }),
    );
    const { result } = await renderHook(() => useAvailableReadingDates(true));
    await waitFor(() =>
      expect(result.current).toEqual(new Set(['2026-08-01'])),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('caché vieja (>= 6h): se muestra al instante y luego se refresca', async () => {
    const now = 2_000_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: now - SIX_HOURS_MS - 1, dates: ['2026-08-01'] }),
    );
    mockFetchOnce({ '2026-08-02': true });
    const { result } = await renderHook(() => useAvailableReadingDates(true));
    await waitFor(() =>
      expect(result.current).toEqual(new Set(['2026-08-02'])),
    );
    expect(global.fetch).toHaveBeenCalled();
  });

  it('JSON de caché corrupto no revienta (y no llega a pedir red)', async () => {
    await AsyncStorage.setItem(CACHE_KEY, 'no-json');
    const { result } = await renderHook(() => useAvailableReadingDates(true));
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    expect(result.current).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
