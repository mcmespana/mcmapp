/**
 * Los hooks del tutorial (`usePanueloTutorial`) y del color de Comunica
 * (`usePanueloScarf`, `readOwnScarf`): qué se lee, de quién, y que sin sesión,
 * sin servidor o con error no se rompe nada.
 */
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PANUELO_TUTORIAL_VERSION } from '@/constants/panueloTutorial';
import {
  PANUELO_TUTORIAL_KEY,
  shouldAutoShowTutorial,
  usePanueloTutorial,
} from '@/hooks/usePanueloTutorial';
import { readOwnScarf, usePanueloScarf } from '@/hooks/usePanueloScarf';

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockApi = {
  getMyProfiles: jest.fn(),
  getProfileDetails: jest.fn(),
};
const mockAvailable = { value: true };
jest.mock('@/services/comunica', () => ({
  isComunicaApiAvailable: () => mockAvailable.value,
  getComunicaApi: () => mockApi,
}));

const mockSession: {
  status: 'loading' | 'signedOut' | 'signedIn';
  listeners: Set<() => void>;
} = { status: 'signedIn', listeners: new Set() };
jest.mock('@/services/comunica/session', () => ({
  initSession: jest.fn(() => Promise.resolve()),
  getSessionState: () => ({ status: mockSession.status, me: null }),
  subscribeSession: (l: () => void) => {
    mockSession.listeners.add(l);
    return () => mockSession.listeners.delete(l);
  },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockAvailable.value = true;
  mockSession.status = 'signedIn';
  mockSession.listeners.clear();
  mockApi.getMyProfiles.mockResolvedValue({
    self: { id: 'yo' },
    children: [{ id: 'hija' }],
  });
  mockApi.getProfileDetails.mockResolvedValue({ mcm: { scarf: 'green' } });
});

describe('usePanueloTutorial', () => {
  it('sin nada guardado o con una versión vieja toca enseñarlo', () => {
    expect(shouldAutoShowTutorial(null)).toBe(true);
    expect(shouldAutoShowTutorial('basura')).toBe(true);
    expect(shouldAutoShowTutorial(String(PANUELO_TUTORIAL_VERSION - 1))).toBe(
      true,
    );
    expect(shouldAutoShowTutorial(String(PANUELO_TUTORIAL_VERSION))).toBe(
      false,
    );
    expect(shouldAutoShowTutorial(String(PANUELO_TUTORIAL_VERSION + 1))).toBe(
      false,
    );
  });

  it('la primera vez se abre solo y mientras tanto está «ocupado»', async () => {
    const { result } = await renderHook(() => usePanueloTutorial());
    expect(result.current.busy).toBe(true);
    await act(async () => {});
    expect(result.current.loaded).toBe(true);
    expect(result.current.open).toBe(true);
  });

  it('terminar guarda la versión y lo libera', async () => {
    const { result } = await renderHook(() => usePanueloTutorial());
    await act(async () => {});
    await act(async () => {
      result.current.finish();
    });
    expect(result.current.open).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(await AsyncStorage.getItem(PANUELO_TUTORIAL_KEY)).toBe(
      String(PANUELO_TUTORIAL_VERSION),
    );
  });

  it('visto no sale solo, pero `show` lo abre', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    );
    const { result } = await renderHook(() => usePanueloTutorial());
    await act(async () => {});
    expect(result.current.open).toBe(false);
    await act(async () => {
      result.current.show();
    });
    expect(result.current.open).toBe(true);
  });

  it('si lo guardado no se puede leer, no insiste', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('x'));
    const { result } = await renderHook(() => usePanueloTutorial());
    await act(async () => {});
    expect(result.current.loaded).toBe(true);
    expect(result.current.open).toBe(false);
  });
});

describe('readOwnScarf', () => {
  it('lee el pañuelo de la ficha de la propia persona, no la de una hija', async () => {
    expect(await readOwnScarf()).toBe('green');
    expect(mockApi.getProfileDetails).toHaveBeenCalledWith('yo');
    expect(mockApi.getProfileDetails).not.toHaveBeenCalledWith('hija');
  });

  it('sin servidor no se pide nada', async () => {
    mockAvailable.value = false;
    expect(await readOwnScarf()).toBeNull();
    expect(mockApi.getMyProfiles).not.toHaveBeenCalled();
  });

  it('sin sesión de Comunica no se pide nada', async () => {
    mockSession.status = 'signedOut';
    expect(await readOwnScarf()).toBeNull();
    expect(mockApi.getMyProfiles).not.toHaveBeenCalled();
  });

  it('sin sección `mcm` (una ficha que no es de miembro) no hay pañuelo', async () => {
    mockApi.getProfileDetails.mockResolvedValue({ mcm: null });
    expect(await readOwnScarf()).toBeNull();
  });
});

describe('usePanueloScarf', () => {
  it('devuelve lo que dice Comunica', async () => {
    const { result } = await renderHook(() => usePanueloScarf());
    await act(async () => {});
    expect(result.current).toBe('green');
  });

  it('con error de red no rompe y se queda sin pañuelo', async () => {
    mockApi.getMyProfiles.mockRejectedValue(new Error('sin red'));
    const { result } = await renderHook(() => usePanueloScarf());
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it('apagado no pide nada', async () => {
    await renderHook(() => usePanueloScarf(false));
    await act(async () => {});
    expect(mockApi.getMyProfiles).not.toHaveBeenCalled();
  });

  it('si la sesión se inicia con la pantalla abierta, lo lee; si se cierra, lo olvida', async () => {
    mockSession.status = 'signedOut';
    const { result } = await renderHook(() => usePanueloScarf());
    await act(async () => {});
    expect(result.current).toBeNull();
    mockSession.status = 'signedIn';
    await act(async () => {
      mockSession.listeners.forEach((l) => l());
    });
    expect(result.current).toBe('green');
    mockSession.status = 'signedOut';
    await act(async () => {
      mockSession.listeners.forEach((l) => l());
    });
    expect(result.current).toBeNull();
  });
});
