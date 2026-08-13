/**
 * Tests para el hook useFirebaseData.
 *
 * ¿Qué testea?
 * - Que se descarguen los datos de Firebase correctamente
 * - Que se guarden en caché (AsyncStorage) tras descargar
 * - Que se usen datos de caché si ya existen
 * - Que se actualicen los datos cuando cambia el timestamp de Firebase
 * - Que se aplique la función de transformación si se proporciona
 * - Que se detecte correctamente el estado offline
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import {
  useFirebaseData,
  __resetNodeCacheForTests,
} from '@/hooks/useFirebaseData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, __setMockNode, __resetMockDb } from 'firebase/database';
import { getNetworkStateAsync } from 'expo-network';

// Silenciar console.error en tests (esperamos errores controlados)
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// Reiniciar mocks y la caché de módulo del hook antes de cada test.
beforeEach(() => {
  jest.clearAllMocks();
  __resetMockDb();
  (AsyncStorage.clear as jest.Mock)();
  __resetNodeCacheForTests();
});

/** Cuántas veces se ha pedido el hijo `data` de algún nodo. */
const dataFetches = () =>
  (get as jest.Mock).mock.calls.filter((c) =>
    String(c[0]?.path ?? '').endsWith('/data'),
  ).length;

describe('useFirebaseData', () => {
  it('descarga datos de Firebase y los devuelve', async () => {
    // Configurar lo que "devuelve" Firebase. El hook pide `songs/updatedAt`,
    // `songs/hidden` y `songs/data` por separado, nunca el nodo entero.
    __setMockNode('songs', {
      updatedAt: '100',
      data: { songs: ['canción1', 'canción2'] },
    });

    const { result } = await renderHook(() =>
      useFirebaseData('songs', 'test_songs'),
    );

    // El estado inicial `loading === true` ya no es observable: desde RNTL 14
    // `renderHook` es asíncrono y envuelve el render en `act`, así que cuando
    // devuelve el control los efectos ya han corrido. Lo que se comprueba es
    // que acaba en `loading === false` con los datos puestos.
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Los datos están ahí
    expect(result.current.data).toEqual({
      songs: ['canción1', 'canción2'],
    });
  });

  it('guarda datos en caché tras descargar de Firebase', async () => {
    __setMockNode('test', { updatedAt: '200', data: { cached: true } });

    const { result } = await renderHook(() =>
      useFirebaseData('test', 'cache_test'),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verificar que se guardó en AsyncStorage
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'cache_test_data',
      JSON.stringify({ cached: true }),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'cache_test_updatedAt',
      '200',
    );
  });

  it('aplica la función de transformación a los datos', async () => {
    __setMockNode('test', { updatedAt: '300', data: [1, 2, 3] });

    // Transformación: duplicar cada número
    const transform = (data: number[]) => data.map((n) => n * 2);

    const { result } = await renderHook(() =>
      useFirebaseData('test', 'transform_test', transform),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([2, 4, 6]);
  });

  it('detecta estado offline', async () => {
    // Simular que no hay red
    (getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });

    // Firebase falla porque no hay red
    (get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = await renderHook(() =>
      useFirebaseData('test', 'offline_test'),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.offline).toBe(true);
  });

  it('no actualiza datos si el timestamp no cambió', async () => {
    // Simular caché con los mismos datos
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'same_ts_data') return Promise.resolve('{"old":"data"}');
      if (key === 'same_ts_updatedAt') return Promise.resolve('500');
      return Promise.resolve(null);
    });

    // Cuando hay caché local, el hook hace dos lecturas pequeñas en paralelo:
    // path/updatedAt y path/hidden. Sólo si updatedAt cambia descarga `data`.
    (get as jest.Mock)
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => '500',
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => false,
      });

    const { result } = await renderHook(() =>
      useFirebaseData('test', 'same_ts'),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Debe usar los datos de caché, no descargar `data`
    expect(result.current.data).toEqual({ old: 'data' });
  });

  it('maneja el caso donde Firebase no tiene datos (snapshot vacío)', async () => {
    __setMockNode('empty', null);

    const { result } = await renderHook(() =>
      useFirebaseData('empty', 'empty_test'),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });
});

describe('useFirebaseData — caché de módulo compartida (dedupe)', () => {
  it('coalesce el fetch remoto: dos hooks del mismo path hacen un solo get()', async () => {
    __setMockNode('songs', { updatedAt: '100', data: { n: 1 } });

    const { result } = await renderHook(() => ({
      a: useFirebaseData<{ n: number }>('songs', 'shared'),
      b: useFirebaseData<{ n: number }>('songs', 'shared'),
    }));

    await waitFor(() => {
      expect(result.current.a.loading).toBe(false);
      expect(result.current.b.loading).toBe(false);
    });

    // Un único refresco pese a haber dos consumidores: `data` se pide una
    // sola vez (el hook pide además `updatedAt` y `hidden` del mismo nodo).
    expect(dataFetches()).toBe(1);
    expect(result.current.a.data).toEqual({ n: 1 });
    expect(result.current.b.data).toEqual({ n: 1 });
  });

  it('un segundo mount se sirve de la caché de módulo (sin releer AsyncStorage)', async () => {
    // Mount A baja `data`; mount B solo comprueba `updatedAt`/`hidden`, que
    // no han cambiado, y se sirve de la caché de módulo.
    __setMockNode('songs', { updatedAt: '100', data: { n: 1 } });

    const a = await renderHook(() =>
      useFirebaseData<{ n: number }>('songs', 'warm'),
    );
    await waitFor(() => expect(a.result.current.loading).toBe(false));

    const getItemForData = () =>
      (AsyncStorage.getItem as jest.Mock).mock.calls.filter(
        (c) => c[0] === 'warm_data',
      ).length;
    const callsAfterA = getItemForData();

    const b = await renderHook(() =>
      useFirebaseData<{ n: number }>('songs', 'warm'),
    );
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    // B no vuelve a leer `warm_data` de AsyncStorage: lo sirve la caché de módulo.
    expect(getItemForData()).toBe(callsAfterA);
    expect(b.result.current.data).toEqual({ n: 1 });
  });

  it('aplica el transform de cada instancia sobre los mismos datos crudos', async () => {
    __setMockNode('songs', { updatedAt: '100', data: [1, 2, 3] });

    const doble = (d: number[]) => d.map((n) => n * 2);
    const cuenta = (d: number[]) => d.length;

    const { result } = await renderHook(() => ({
      a: useFirebaseData<number[]>('songs', 'shared', doble),
      b: useFirebaseData<number>('songs', 'shared', cuenta),
    }));

    await waitFor(() => {
      expect(result.current.a.loading).toBe(false);
      expect(result.current.b.loading).toBe(false);
    });

    expect(result.current.a.data).toEqual([2, 4, 6]);
    expect(result.current.b.data).toBe(3);
    // Sigue siendo un único fetch pese a los transforms distintos.
    expect(dataFetches()).toBe(1);
  });
});

describe('useFirebaseData — memo del transform por instancia (Plan 007)', () => {
  it('identidad estable: updatedAt remoto igual al local → transform se llama UNA sola vez', async () => {
    const transformSpy = jest.fn((d: { old: string }) => ({ ...d }));

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'memo_stable_data') return Promise.resolve('{"old":"data"}');
      if (key === 'memo_stable_updatedAt') return Promise.resolve('500');
      return Promise.resolve(null);
    });

    // Caché local presente; el refresh remoto confirma el mismo updatedAt
    // (la vía rápida de refreshRemote) → parsed NO cambia de identidad.
    (get as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, val: () => '500' }) // updatedAt
      .mockResolvedValueOnce({ exists: () => true, val: () => false }); // hidden

    const { result } = await renderHook(() =>
      useFirebaseData('memo_stable_path', 'memo_stable', transformSpy),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Sin el memo, applyParsed llama a transform dos veces (fase caché +
    // post-refresh) aunque `parsed` sea el MISMO objeto crudo.
    expect(transformSpy).toHaveBeenCalledTimes(1);
  });

  it('datos nuevos (updatedAt distinto) → transform se llama de nuevo', async () => {
    const transformSpy = jest.fn((d: { v: number }) => ({ v: d.v }));

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'memo_changed_data') return Promise.resolve('{"v":1}');
      if (key === 'memo_changed_updatedAt') return Promise.resolve('1');
      return Promise.resolve(null);
    });

    (get as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, val: () => '2' }) // updatedAt distinto
      .mockResolvedValueOnce({ exists: () => true, val: () => false }) // hidden
      .mockResolvedValueOnce({ exists: () => true, val: () => ({ v: 2 }) }); // data nueva

    const { result } = await renderHook(() =>
      useFirebaseData('memo_changed_path', 'memo_changed', transformSpy),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Cache (v:1) + post-refresh con datos genuinamente nuevos (v:2): el
    // memo NO debe esconder este caso.
    expect(transformSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual({ v: 2 });
  });

  it('sin transform: sigue funcionando devolviendo los datos crudos', async () => {
    __setMockNode('memo_no_transform_path', {
      updatedAt: '1',
      data: { raw: true },
    });

    const { result } = await renderHook(() =>
      useFirebaseData<{ raw: boolean }>(
        'memo_no_transform_path',
        'memo_no_transform',
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ raw: true });
  });
});
