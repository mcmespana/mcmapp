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
import { useFirebaseData } from '@/hooks/useFirebaseData';
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

// Reiniciar mocks antes de cada test
beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
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

    // Firebase devuelve el mismo timestamp
    (get as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        updatedAt: '500',
        data: { new: 'data' },
      }),
    });

    const { result } = renderHook(() => useFirebaseData('test', 'same_ts'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Debe usar los datos de caché, no los nuevos
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
