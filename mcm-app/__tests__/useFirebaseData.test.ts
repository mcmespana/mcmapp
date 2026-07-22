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
import { get } from 'firebase/database';
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
  (AsyncStorage.clear as jest.Mock)();
  __resetNodeCacheForTests();
});

describe('useFirebaseData', () => {
  it('descarga datos de Firebase y los devuelve', async () => {
    // Configurar lo que "devuelve" Firebase
    (get as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        updatedAt: '100',
        data: { songs: ['canción1', 'canción2'] },
      }),
    });

    const { result } = renderHook(() => useFirebaseData('songs', 'test_songs'));

    // Al principio está cargando
    expect(result.current.loading).toBe(true);

    // Esperar a que cargue
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Los datos están ahí
    expect(result.current.data).toEqual({
      songs: ['canción1', 'canción2'],
    });
  });

  it('guarda datos en caché tras descargar de Firebase', async () => {
    (get as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        updatedAt: '200',
        data: { cached: true },
      }),
    });

    const { result } = renderHook(() => useFirebaseData('test', 'cache_test'));

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
    (get as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        updatedAt: '300',
        data: [1, 2, 3],
      }),
    });

    // Transformación: duplicar cada número
    const transform = (data: number[]) => data.map((n) => n * 2);

    const { result } = renderHook(() =>
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

    const { result } = renderHook(() =>
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

    const { result } = renderHook(() => useFirebaseData('test', 'same_ts'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Debe usar los datos de caché, no descargar `data`
    expect(result.current.data).toEqual({ old: 'data' });
  });

  it('maneja el caso donde Firebase no tiene datos (snapshot vacío)', async () => {
    (get as jest.Mock).mockResolvedValueOnce({
      exists: () => false,
      val: () => null,
    });

    const { result } = renderHook(() => useFirebaseData('empty', 'empty_test'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });
});

describe('useFirebaseData — caché de módulo compartida (dedupe)', () => {
  it('coalesce el fetch remoto: dos hooks del mismo path hacen un solo get()', async () => {
    (get as jest.Mock).mockResolvedValue({
      exists: () => true,
      val: () => ({ updatedAt: '100', data: { n: 1 } }),
    });

    const { result } = renderHook(() => ({
      a: useFirebaseData<{ n: number }>('songs', 'shared'),
      b: useFirebaseData<{ n: number }>('songs', 'shared'),
    }));

    await waitFor(() => {
      expect(result.current.a.loading).toBe(false);
      expect(result.current.b.loading).toBe(false);
    });

    // Un único round-trip a Firebase pese a haber dos consumidores.
    expect((get as jest.Mock).mock.calls.length).toBe(1);
    expect(result.current.a.data).toEqual({ n: 1 });
    expect(result.current.b.data).toEqual({ n: 1 });
  });

  it('un segundo mount se sirve de la caché de módulo (sin releer AsyncStorage)', async () => {
    (get as jest.Mock)
      // Mount A (sin caché): descarga completa del nodo.
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ updatedAt: '100', data: { n: 1 } }),
      })
      // Mount B (caché de módulo caliente): solo comprueba metadatos, iguales.
      .mockResolvedValueOnce({ exists: () => true, val: () => '100' }) // updatedAt
      .mockResolvedValueOnce({ exists: () => true, val: () => false }); // hidden

    const a = renderHook(() => useFirebaseData<{ n: number }>('songs', 'warm'));
    await waitFor(() => expect(a.result.current.loading).toBe(false));

    const getItemForData = () =>
      (AsyncStorage.getItem as jest.Mock).mock.calls.filter(
        (c) => c[0] === 'warm_data',
      ).length;
    const callsAfterA = getItemForData();

    const b = renderHook(() => useFirebaseData<{ n: number }>('songs', 'warm'));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    // B no vuelve a leer `warm_data` de AsyncStorage: lo sirve la caché de módulo.
    expect(getItemForData()).toBe(callsAfterA);
    expect(b.result.current.data).toEqual({ n: 1 });
  });

  it('aplica el transform de cada instancia sobre los mismos datos crudos', async () => {
    (get as jest.Mock).mockResolvedValue({
      exists: () => true,
      val: () => ({ updatedAt: '100', data: [1, 2, 3] }),
    });

    const doble = (d: number[]) => d.map((n) => n * 2);
    const cuenta = (d: number[]) => d.length;

    const { result } = renderHook(() => ({
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
    expect((get as jest.Mock).mock.calls.length).toBe(1);
  });
});
