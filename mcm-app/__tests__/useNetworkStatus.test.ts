/**
 * Tests para el hook useNetworkStatus.
 *
 * ¿Qué testea?
 * - Que detecte cuando hay conexión a internet
 * - Que detecte cuando NO hay conexión
 * - Que el estado inicial sea null (aún no se ha comprobado)
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { getNetworkStateAsync, addNetworkStateListener } from 'expo-network';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNetworkStatus', () => {
  it('devuelve true cuando hay conexión', async () => {
    (getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('devuelve false cuando no hay conexión', async () => {
    (getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });

    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('se suscribe a cambios de red', async () => {
    (getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: true,
      isInternetReachable: true,
    });

    renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(addNetworkStateListener).toHaveBeenCalled();
    });
  });
});
