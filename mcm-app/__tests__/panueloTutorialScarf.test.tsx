/**
 * Los hooks del tutorial (`usePanueloTutorial`) y del color de Comunica
 * (`usePanueloScarf`, `readOwnScarf`): qué se lee, de quién, y que sin sesión,
 * sin servidor o con error no se rompe nada.
 */
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  PANUELO_TUTORIAL,
  PANUELO_TUTORIAL_VERSION,
} from '@/constants/panueloTutorial';
import { usePanueloTutorialStage } from '@/hooks/usePanueloTutorialStage';
import {
  PANUELO_TUTORIAL_KEY,
  shouldAutoShowTutorial,
  usePanueloTutorial,
} from '@/hooks/usePanueloTutorial';
import { readOwnScarf, usePanueloScarf } from '@/hooks/usePanueloScarf';

// Estos tests usan las piezas de ejemplo (una de cada clase), no el catálogo
// de verdad, que cambia cada vez que se añade una chapa.
jest.mock('@/firebase-seed/panuelo.json', () =>
  jest.requireActual('@/constants/panueloEjemplo.json'),
);
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

describe('usePanueloTutorialStage', () => {
  const stepOf = (id: string) => PANUELO_TUTORIAL.findIndex((s) => s.id === id);
  const send = jest.fn();
  beforeEach(() => {
    send.mockClear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  const mount = (step: number, open = true, viewerReady = true) =>
    renderHook(
      (p: { step: number; open: boolean }) =>
        usePanueloTutorialStage({
          open: p.open,
          step: p.step,
          viewerReady,
          sendToViewer: send,
        }),
      { initialProps: { step, open } },
    );

  it('cerrado no pone nada', async () => {
    const { result } = await mount(0, false);
    expect(result.current.state).toBeUndefined();
    expect(result.current.mode).toBe('view');
  });

  it('abierto da el pañuelo de ejemplo del paso', async () => {
    const { result } = await mount(stepOf('las-piezas'));
    expect(result.current.state?.color).toBe('green');
    expect(result.current.state?.items).toHaveLength(6);
  });

  it('«Decorarlo»: modo decorar y una pieza seleccionada', async () => {
    const { result } = await mount(stepOf('decorarlo'));
    expect(result.current.mode).toBe('edit');
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(send).toHaveBeenCalledWith({
      type: 'select',
      id: 'corazon-consolacion',
    });
  });

  it('«Verlas de cerca»: una pieza enfocada', async () => {
    await mount(stepOf('verlas-de-cerca'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(send).toHaveBeenCalledWith({
      type: 'focus',
      id: 'medalla-jubileo-2025',
    });
  });

  it('«Canjear»: una pieza que se presenta', async () => {
    await mount(stepOf('canjear'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(send).toHaveBeenCalledWith({ type: 'reveal', id: 'parche-pascua' });
  });

  it('«Cambiar de etapa»: la tela pasa de verde a azul', async () => {
    const { result } = await mount(stepOf('cambiar-de-etapa'));
    expect(result.current.state?.color).toBe('green');
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.state?.color).toBe('blue');
  });

  it('al cambiar de paso vuelve a la tela del ejemplo y suelta la pieza', async () => {
    const { result, rerender } = await mount(stepOf('cambiar-de-etapa'));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    send.mockClear();
    await rerender({ step: stepOf('cambiar-de-etapa') - 1, open: true });
    expect(result.current.state?.color).toBe('green');
    expect(send).toHaveBeenCalledWith({ type: 'blur' });
    expect(send).toHaveBeenCalledWith({ type: 'select', id: null });
  });

  it('sin el visor listo no manda órdenes', async () => {
    await mount(stepOf('verlas-de-cerca'), true, false);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(send).not.toHaveBeenCalled();
  });
});
