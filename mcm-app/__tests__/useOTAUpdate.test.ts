/**
 * Tests de `hooks/useOTAUpdate.ts`.
 *
 * Orquesta la descarga silenciosa de actualizaciones OTA (EAS Update): si el
 * flag `checkedRef` no se resetea al volver del background, o el error de
 * red se cuela sin capturar, el usuario se queda sin poder aplicar un update
 * ya descargado o la app revienta.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import useOTAUpdate from '@/hooks/useOTAUpdate';

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

const originalDev = (global as { __DEV__?: boolean }).__DEV__;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  Platform.OS = 'ios';
  (global as { __DEV__?: boolean }).__DEV__ = false;
  (Updates as { isEnabled: boolean }).isEnabled = true;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  (global as { __DEV__?: boolean }).__DEV__ = originalDev;
});

describe('useOTAUpdate', () => {
  it('no comprueba nada en __DEV__', async () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(3000));
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('no comprueba nada si Updates.isEnabled es false', async () => {
    (Updates as { isEnabled: boolean }).isEnabled = false;
    await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(3000));
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('no comprueba nada en web', async () => {
    Platform.OS = 'web';
    await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(3000));
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('no comprueba nada si ready: false', async () => {
    await renderHook(() => useOTAUpdate({ ready: false }));
    await act(async () => jest.advanceTimersByTime(3000));
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('comprueba tras el delay inicial y no hace nada si no hay update', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: false,
    });
    const { result } = await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(2500));
    await waitFor(() =>
      expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1),
    );
    expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(false);
  });

  it('descarga y marca isReady cuando hay update nuevo', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: true,
    });
    (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({
      isNew: true,
    });
    const { result } = await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(2500));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isDownloading).toBe(false);
  });

  it('no marca isReady si fetchUpdateAsync no trae nada nuevo', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: true,
    });
    (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({
      isNew: false,
    });
    const { result } = await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(2500));
    await waitFor(() =>
      expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1),
    );
    expect(result.current.isReady).toBe(false);
  });

  it('captura errores de red sin romper la app', async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValue(
      new Error('sin red'),
    );
    const { result } = await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(2500));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('sin red');
    expect(result.current.isDownloading).toBe(false);
  });

  it('vuelve a comprobar cuando la app vuelve de background a active', async () => {
    (AppState as { currentState: string }).currentState = 'active';
    let appStateHandler: ((state: string) => void) | undefined;
    const addSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((_event: string, handler: (s: string) => void) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      }) as typeof AppState.addEventListener);
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: false,
    });

    await renderHook(() => useOTAUpdate());
    await act(async () => jest.advanceTimersByTime(2500));
    await waitFor(() =>
      expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      appStateHandler?.('background');
      appStateHandler?.('active');
    });
    await waitFor(() =>
      expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(2),
    );

    addSpy.mockRestore();
  });

  describe('applyUpdate', () => {
    it('si ya está listo, solo llama a reloadAsync', async () => {
      (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
        isAvailable: true,
      });
      (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({
        isNew: true,
      });
      const { result } = await renderHook(() => useOTAUpdate());
      await act(async () => jest.advanceTimersByTime(2500));
      await waitFor(() => expect(result.current.isReady).toBe(true));

      (Updates.fetchUpdateAsync as jest.Mock).mockClear();
      await act(async () => result.current.applyUpdate());
      expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    });

    it('si no está listo, descarga primero y luego recarga', async () => {
      (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({});
      const { result } = await renderHook(() => useOTAUpdate());
      await act(async () => result.current.applyUpdate());
      expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    });

    it('propaga el error si falla la descarga/recarga', async () => {
      (Updates.fetchUpdateAsync as jest.Mock).mockRejectedValue(
        new Error('fallo al recargar'),
      );
      const { result } = await renderHook(() => useOTAUpdate());
      await act(async () => result.current.applyUpdate());
      expect(result.current.error?.message).toBe('fallo al recargar');
      expect(result.current.isDownloading).toBe(false);
    });
  });
});
