/**
 * Tests de `contexts/CarismochitoHuntContext.tsx` — la colección de
 * Carismochitos y su interruptor del Laboratorio Alpha.
 *
 * Lo que se prueba es lo que puede fallar SIN dar error: dos toques rápidos
 * que cuentan como uno, una colección que se duplica cada vez que se abre la
 * app con sesión, un "empezar de cero" que deja la nube llena y la vuelve a
 * bajar, o un contador de pantallas protegidas que se queda en negativo y
 * deja que Carismochito se asome en mitad de una lectura.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type CatchResult,
  COLLECTION_KEY,
  CarismochitoHuntProvider,
  HUNT_ENABLED_KEY,
  useCarismochitoHunt,
} from '@/contexts/CarismochitoHuntContext';

const mockUser: { current: { uid: string } | null } = { current: null };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));
jest.mock('@/utils/authHelpers', () => ({
  fetchCarismochitos: jest.fn(async () => ({})),
  syncCarismochitoEntry: jest.fn(async () => {}),
  clearCarismochitos: jest.fn(async () => {}),
}));
jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const helpers = require('@/utils/authHelpers');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trackEvent } = require('@/utils/analytics');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CarismochitoHuntProvider>{children}</CarismochitoHuntProvider>
);

async function mount() {
  const hook = await renderHook(() => useCarismochitoHunt(), { wrapper });
  // Deja resolver la lectura local y, si hay sesión, la de la nube.
  await act(async () => {});
  await act(async () => {});
  return hook;
}

async function storedCollection() {
  const raw = await AsyncStorage.getItem(COLLECTION_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockUser.current = null;
  await AsyncStorage.clear();
});

describe('interruptor del laboratorio', () => {
  it('arranca apagado y se recuerda al reabrir la app', async () => {
    const first = await mount();
    expect(first.result.current.huntEnabled).toBe(false);
    await act(async () => first.result.current.setHuntEnabled(true));
    expect(await AsyncStorage.getItem(HUNT_ENABLED_KEY)).toBe('1');
    await first.unmount();

    const second = await mount();
    expect(second.result.current.huntEnabled).toBe(true);
  });
});

describe('capturas', () => {
  it('dos toques seguidos sin re-render cuentan dos, no uno', async () => {
    const hook = await mount();
    let a: CatchResult | null = null;
    let b: CatchResult | null = null;
    await act(async () => {
      a = hook.result.current.catchCarismochito('rojo');
      b = hook.result.current.catchCarismochito('rojo');
    });
    expect(a).toMatchObject({ count: 1, isNew: true });
    expect(b).toMatchObject({ count: 2, isNew: false });
    expect(hook.result.current.collection.rojo.count).toBe(2);
    expect((await storedCollection()).rojo.count).toBe(2);
  });

  it('una variante que no existe no suma nada ni ensucia la colección', async () => {
    const hook = await mount();
    let r: unknown = 'sin tocar';
    await act(async () => {
      r = hook.result.current.catchCarismochito('no-existe');
    });
    expect(r).toBeNull();
    expect(hook.result.current.collection).toEqual({});
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('la analítica lleva la rareza y si es nuevo, nunca quién es', async () => {
    mockUser.current = { uid: 'secreto' };
    const hook = await mount();
    await act(async () => {
      hook.result.current.catchCarismochito('dorado');
    });
    expect(trackEvent).toHaveBeenCalledWith('carismochito_atrapado', {
      rareza: 'legendario',
      nuevo: true,
    });
    expect(JSON.stringify((trackEvent as jest.Mock).mock.calls)).not.toContain(
      'secreto',
    );
  });

  it('sin sesión se guarda en el móvil y no se intenta subir', async () => {
    const hook = await mount();
    await act(async () => {
      hook.result.current.catchCarismochito('clasico');
    });
    expect(helpers.syncCarismochitoEntry).not.toHaveBeenCalled();
    expect((await storedCollection()).clasico.count).toBe(1);
  });

  it('con sesión, cada captura sube solo su variante', async () => {
    mockUser.current = { uid: 'u1' };
    const hook = await mount();
    await act(async () => {
      hook.result.current.catchCarismochito('morado');
    });
    expect(helpers.syncCarismochitoEntry).toHaveBeenCalledWith(
      'u1',
      'morado',
      expect.objectContaining({ count: 1 }),
    );
  });
});

describe('sincronización con la nube', () => {
  it('abrir la app con sesión no duplica lo que ya estaba en los dos sitios', async () => {
    await AsyncStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify({ rojo: { count: 3, firstAt: 10 } }),
    );
    helpers.fetchCarismochitos.mockResolvedValueOnce({
      rojo: { count: 3, firstAt: 10 },
    });
    mockUser.current = { uid: 'u1' };
    const hook = await mount();
    expect(hook.result.current.collection.rojo.count).toBe(3);
    expect(helpers.syncCarismochitoEntry).not.toHaveBeenCalled();
  });

  it('baja lo de otro móvil y sube lo que este lleva de más', async () => {
    await AsyncStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify({ rojo: { count: 5, firstAt: 10 } }),
    );
    helpers.fetchCarismochitos.mockResolvedValueOnce({
      rojo: { count: 2, firstAt: 10 },
      dorado: { count: 1, firstAt: 20 },
    });
    mockUser.current = { uid: 'u1' };
    const hook = await mount();
    expect(hook.result.current.collection).toEqual({
      rojo: { count: 5, firstAt: 10 },
      dorado: { count: 1, firstAt: 20 },
    });
    expect(helpers.syncCarismochitoEntry).toHaveBeenCalledTimes(1);
    expect(helpers.syncCarismochitoEntry).toHaveBeenCalledWith('u1', 'rojo', {
      count: 5,
      firstAt: 10,
    });
  });

  it('una colección local corrupta no tumba el provider', async () => {
    await AsyncStorage.setItem(COLLECTION_KEY, '{esto no es json');
    const hook = await mount();
    expect(hook.result.current.collection).toEqual({});
  });
});

describe('empezar de cero', () => {
  it('vacía el móvil Y la nube: si no, la nube la volvería a bajar', async () => {
    mockUser.current = { uid: 'u1' };
    const hook = await mount();
    await act(async () => {
      hook.result.current.catchCarismochito('rojo');
    });
    await act(async () => {
      await hook.result.current.resetCollection();
    });
    expect(hook.result.current.collection).toEqual({});
    expect(await storedCollection()).toEqual({});
    expect(helpers.clearCarismochitos).toHaveBeenCalledWith('u1');
  });
});

describe('pantallas sin Carismochito', () => {
  it('se protege mientras quede alguna pantalla pidiéndolo', async () => {
    const hook = await mount();
    let releaseA = () => {};
    let releaseB = () => {};
    await act(async () => {
      releaseA = hook.result.current.suppress();
      releaseB = hook.result.current.suppress();
    });
    expect(hook.result.current.suppressed).toBe(true);
    await act(async () => releaseA());
    expect(hook.result.current.suppressed).toBe(true);
    await act(async () => releaseB());
    expect(hook.result.current.suppressed).toBe(false);
  });

  it('soltar dos veces no deja el contador en negativo', async () => {
    const hook = await mount();
    let release = () => {};
    await act(async () => {
      release = hook.result.current.suppress();
    });
    await act(async () => {
      release();
      release();
    });
    // Si hubiera bajado a -1, esta nueva protección no protegería nada.
    await act(async () => {
      hook.result.current.suppress();
    });
    expect(hook.result.current.suppressed).toBe(true);
  });
});

describe('sin provider', () => {
  it('todo apagado y sin romper: así una pantalla suelta se puede montar', async () => {
    const hook = await renderHook(() => useCarismochitoHunt());
    expect(hook.result.current.huntEnabled).toBe(false);
    expect(hook.result.current.catchCarismochito('rojo')).toBeNull();
    expect(() => hook.result.current.suppress()()).not.toThrow();
  });
});
