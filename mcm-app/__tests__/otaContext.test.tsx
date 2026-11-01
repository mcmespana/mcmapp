/**
 * Test de `contexts/OTAContext.tsx`.
 *
 * Dos cosas:
 *  1. Wrapper de `useOTAUpdate` que espera a que `PreviewChannelContext` esté
 *     hidratado antes de comprobar updates — si `OTAProvider` pidiera el update
 *     antes de tiempo, un tester en modo alpha podría acabar pidiéndoselo a
 *     `production` por ganarle la carrera al override del canal.
 *  2. La OTA ya descargada se aplica SOLA y sin preguntar, pero solo en el
 *     momento que no molesta (recién abierta la app o al volver del fondo), con
 *     la pantalla de «un momentín» puesta y con cortafuegos anti-bucle.
 */
import React from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import {
  OTAProvider,
  useOTAContext,
  MIN_OVERLAY_MS,
  RELOAD_GRACE_MS,
} from '@/contexts/OTAContext';
import {
  AUTO_APPLY_COOLDOWN_MS,
  FRESH_WINDOW_MS,
  LAST_AUTO_APPLY_KEY,
} from '@/utils/otaAutoApply';

let mockHydrated = true;
const mockOta = {
  isReady: false,
  isDownloading: false,
  error: null as Error | null,
  applyUpdate: jest.fn(() => Promise.resolve()),
};
const mockUseOTAUpdate = jest.fn((opts: { ready: boolean }) => {
  mockLastReadyArg = opts.ready;
  return mockOta;
});
let mockLastReadyArg: boolean | undefined;
let mockOverlayVisible = false;

jest.mock('@/contexts/PreviewChannelContext', () => ({
  usePreviewChannel: () => ({ hydrated: mockHydrated }),
}));

jest.mock('@/hooks/useOTAUpdate', () => ({
  __esModule: true,
  default: (opts: { ready: boolean }) => mockUseOTAUpdate(opts),
}));

jest.mock('@/components/OTAUpdatingOverlay', () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) => {
    mockOverlayVisible = visible;
    return null;
  },
}));

let appStateHandler: ((s: string) => void) | undefined;

beforeEach(async () => {
  jest.useFakeTimers();
  mockHydrated = true;
  mockLastReadyArg = undefined;
  mockOverlayVisible = false;
  mockOta.isReady = false;
  mockOta.isDownloading = false;
  mockOta.error = null;
  jest.clearAllMocks();
  await AsyncStorage.clear();
  appStateHandler = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    handler: (s: string) => void,
  ) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OTAProvider>{children}</OTAProvider>
);

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('useOTAContext sin Provider', () => {
  it('devuelve los valores por defecto', async () => {
    const { result } = await renderHook(() => useOTAContext());
    expect(result.current.isReady).toBe(false);
    expect(result.current.applying).toBe(false);
  });
});

describe('OTAProvider — canal', () => {
  it('pasa `ready` a useOTAUpdate desde el hydrated del canal', async () => {
    mockHydrated = false;
    await renderHook(() => useOTAContext(), { wrapper });
    expect(mockLastReadyArg).toBe(false);
  });

  it('espera a hydrated: true para permitir la comprobación', async () => {
    mockHydrated = true;
    await renderHook(() => useOTAContext(), { wrapper });
    expect(mockLastReadyArg).toBe(true);
  });

  it('expone isReady/isDownloading/error de useOTAUpdate', async () => {
    mockOta.isReady = true;
    mockOta.isDownloading = false;
    mockOta.error = new Error('x');
    // Sin disparar el auto-apply (cortafuegos activo): solo se mira el estado.
    await AsyncStorage.setItem(LAST_AUTO_APPLY_KEY, String(Date.now()));
    const { result } = await renderHook(() => useOTAContext(), { wrapper });
    expect(result.current.isReady).toBe(true);
    expect(result.current.error).toBe(mockOta.error);
  });
});

describe('OTAProvider — aplicar la OTA sola', () => {
  it('update listo nada más abrir: se aplica solo, tras el «un momentín»', async () => {
    mockOta.isReady = true;
    const { result } = await renderHook(() => useOTAContext(), { wrapper });
    await advance(0);

    expect(result.current.applying).toBe(true);
    expect(mockOverlayVisible).toBe(true);
    // La pantalla se ve un mínimo ANTES de recargar, para que dé tiempo a leer.
    expect(mockOta.applyUpdate).not.toHaveBeenCalled();
    await advance(MIN_OVERLAY_MS);
    expect(mockOta.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('deja la marca anti-bucle ANTES de recargar', async () => {
    mockOta.isReady = true;
    await renderHook(() => useOTAContext(), { wrapper });
    await advance(0);
    expect(await AsyncStorage.getItem(LAST_AUTO_APPLY_KEY)).not.toBeNull();
  });

  it('si la recarga falla y la app sigue viva, quita la pantalla', async () => {
    mockOta.isReady = true;
    const { result } = await renderHook(() => useOTAContext(), { wrapper });
    await advance(MIN_OVERLAY_MS + RELOAD_GRACE_MS + 10);
    expect(result.current.applying).toBe(false);
    expect(mockOverlayVisible).toBe(false);
  });

  it('cortafuegos: con otra aplicación automática reciente, no recarga otra vez', async () => {
    await AsyncStorage.setItem(
      LAST_AUTO_APPLY_KEY,
      String(Date.now() - AUTO_APPLY_COOLDOWN_MS / 2),
    );
    mockOta.isReady = true;
    const { result } = await renderHook(() => useOTAContext(), { wrapper });
    await advance(MIN_OVERLAY_MS + 100);
    expect(result.current.applying).toBe(false);
    expect(mockOta.applyUpdate).not.toHaveBeenCalled();
  });

  it('update que llega con la app en uso: no interrumpe; espera a la vuelta del fondo', async () => {
    const { result, rerender } = await renderHook(() => useOTAContext(), {
      wrapper,
    });
    await advance(FRESH_WINDOW_MS + 5_000);

    mockOta.isReady = true;
    await rerender({});
    await advance(100);
    expect(result.current.applying).toBe(false);
    expect(result.current.isReady).toBe(true); // queda la insignia de Home

    // La persona saca la app del fondo → ahora sí.
    await act(async () => {
      appStateHandler?.('background');
      appStateHandler?.('active');
    });
    await advance(0);
    expect(result.current.applying).toBe(true);
    await advance(MIN_OVERLAY_MS);
    expect(mockOta.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('inactive → active (un aviso del sistema) NO cuenta como volver del fondo', async () => {
    const { result, rerender } = await renderHook(() => useOTAContext(), {
      wrapper,
    });
    await advance(FRESH_WINDOW_MS + 5_000);
    mockOta.isReady = true;
    await rerender({});

    await act(async () => {
      appStateHandler?.('inactive');
      appStateHandler?.('active');
    });
    await advance(100);
    expect(result.current.applying).toBe(false);
  });

  it('aplicar a mano (insignia de Home) funciona siempre y no se duplica', async () => {
    await AsyncStorage.setItem(LAST_AUTO_APPLY_KEY, String(Date.now()));
    mockOta.isReady = true;
    const { result } = await renderHook(() => useOTAContext(), { wrapper });

    await act(async () => {
      void result.current.applyUpdate();
      void result.current.applyUpdate();
    });
    await advance(MIN_OVERLAY_MS);
    expect(mockOta.applyUpdate).toHaveBeenCalledTimes(1);
  });
});
