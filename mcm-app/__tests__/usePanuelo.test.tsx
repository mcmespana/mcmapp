/**
 * Tests de `hooks/usePanuelo.ts` — el pañuelo virtual de una persona.
 *
 * La lógica pura (canjear, colocar, fusionar) ya está en `panuelo.test.ts`;
 * aquí se prueba lo que solo hace el hook: leer y guardar en el móvil, repartir
 * las piezas «para todos», llevar la cuenta de las piezas sin presentar y
 * hablar con la nube solo cuando hay sesión (con la subida de la colocación
 * retrasada).
 */
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import {
  PANUELO_SEEN_KEY,
  PANUELO_STATE_KEY,
  usePanuelo,
} from '@/hooks/usePanuelo';
import type { PanueloCatalog, PanueloUserState } from '@/types/panuelo';
import { EMPTY_PANUELO } from '@/utils/panuelo';

const mockAuth: { user: { uid: string } | null } = { user: null };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuth.user }),
}));

const mockRemoteCatalog: { data: PanueloCatalog | null } = { data: null };
jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: () => ({ data: mockRemoteCatalog.data }),
}));

jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('@/utils/authHelpers', () => ({
  fetchPanuelo: jest.fn(),
  syncPanueloItem: jest.fn(),
  syncPanueloLayout: jest.fn(),
  syncPanueloMemory: jest.fn(),
  syncPanueloTradeHalf: jest.fn(),
  clearPanuelo: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const helpers = require('@/utils/authHelpers');
const fetchPanuelo = helpers.fetchPanuelo as jest.Mock;
const syncPanueloItem = helpers.syncPanueloItem as jest.Mock;
const syncPanueloLayout = helpers.syncPanueloLayout as jest.Mock;
const syncPanueloMemory = helpers.syncPanueloMemory as jest.Mock;
const clearPanuelo = helpers.clearPanuelo as jest.Mock;

const AUTO = 'pionero-alpha';
const LAYOUT_DELAY = 1200;

const state = (over: Partial<PanueloUserState> = {}): PanueloUserState => ({
  ...EMPTY_PANUELO,
  ...over,
});

/** Un pañuelo guardado con una pieza ya cosida. */
const owned = (id: string, at = 1000): Partial<PanueloUserState> => ({
  items: { [id]: { at, via: 'code' } },
  layout: { [id]: { u: 0.5, v: 0.5, rot: 0 } },
  layoutAt: at,
});

async function store(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function saved(key: string) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function mount() {
  const hook = await renderHook(() => usePanuelo());
  await act(async () => {});
  return hook;
}

beforeEach(async () => {
  mockAuth.user = null;
  mockRemoteCatalog.data = null;
  fetchPanuelo.mockReset().mockResolvedValue(null);
  syncPanueloItem.mockReset();
  syncPanueloLayout.mockReset();
  syncPanueloMemory.mockReset();
  clearPanuelo.mockReset().mockResolvedValue(undefined);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  fetchPanuelo.mockResolvedValue(null);
  clearPanuelo.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePanuelo: arranque', () => {
  it('sin nada guardado arranca vacío y listo, salvo la pieza para todos', async () => {
    const { result } = await mount();
    expect(result.current.ready).toBe(true);
    expect(Object.keys(result.current.state.items)).toEqual([AUTO]);
  });

  it('lee el estado guardado en el móvil', async () => {
    await store(
      PANUELO_STATE_KEY,
      state({ ...owned('parche-pascua'), color: 'red' }),
    );
    const { result } = await mount();
    expect(result.current.state.color).toBe('red');
    expect(result.current.state.items['parche-pascua']).toEqual({
      at: 1000,
      via: 'code',
    });
    expect(result.current.state.layout['parche-pascua']).toEqual({
      u: 0.5,
      v: 0.5,
      rot: 0,
    });
  });

  it('un estado guardado corrupto no tumba el hook', async () => {
    await AsyncStorage.setItem(PANUELO_STATE_KEY, '{no es json');
    const { result } = await mount();
    expect(result.current.ready).toBe(true);
    expect(result.current.state.items['parche-pascua']).toBeUndefined();
  });

  it('sin catálogo remoto usa el de muestra', async () => {
    const { result } = await mount();
    expect(result.current.catalog).toBe(DEFAULT_PANUELO_CATALOG);
  });

  it('un catálogo remoto vacío tampoco sustituye al de muestra', async () => {
    mockRemoteCatalog.data = {};
    const { result } = await mount();
    expect(result.current.catalog).toBe(DEFAULT_PANUELO_CATALOG);
  });

  it('con catálogo remoto usa el del Panel', async () => {
    const remote: PanueloCatalog = {
      solo: {
        id: 'solo',
        name: 'Solo',
        kind: 'pin',
        rarity: 'comun',
        look: { kind: 'pin', shape: 'star', enamel: '#fff' },
        grant: { type: 'all' },
      } as PanueloCatalog[string],
    };
    mockRemoteCatalog.data = remote;
    const { result } = await mount();
    expect(result.current.catalog).toBe(remote);
    expect(Object.keys(result.current.state.items)).toEqual(['solo']);
  });
});

describe('usePanuelo: piezas para todo el mundo', () => {
  it('se conceden y se cosen al abrir, y se guardan', async () => {
    const { result } = await mount();
    expect(result.current.state.items[AUTO]).toMatchObject({ via: 'all' });
    expect(result.current.state.layout[AUTO]).toBeDefined();
    const persisted = await saved(PANUELO_STATE_KEY);
    expect(persisted.items[AUTO].via).toBe('all');
    expect(persisted.layout[AUTO]).toBeDefined();
  });

  it('no se repiten si ya se tenían', async () => {
    await store(PANUELO_STATE_KEY, state({ ...owned(AUTO, 5) }));
    const { result } = await mount();
    expect(result.current.state.items[AUTO].at).toBe(5);
    expect(result.current.state.items[AUTO].via).toBe('code');
  });
});

describe('usePanuelo: canjear códigos', () => {
  it.each([
    ['CONSOLACION', 'corazon-consolacion'],
    ['PASCUA27', 'parche-pascua'],
    ['CAMINO', 'vieira-camino'],
    ['VERANO', 'cinta-campamento'],
  ])('el código %s abre %s, lo añade y lo cose', async (code, id) => {
    const { result } = await mount();
    let res: ReturnType<typeof result.current.redeem> | undefined;
    await act(async () => {
      res = result.current.redeem(code);
    });
    expect(res).toMatchObject({ ok: true, already: false });
    expect(result.current.state.items[id]).toMatchObject({ via: 'code' });
    expect(result.current.state.layout[id]).toBeDefined();
    expect((await saved(PANUELO_STATE_KEY)).items[id]).toBeDefined();
  });

  it('acepta el código con otra grafía', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.redeem('pascua-27');
    });
    expect(result.current.state.items['parche-pascua']).toBeDefined();
  });

  it('un código inválido no cambia nada', async () => {
    const { result } = await mount();
    const before = result.current.state;
    let res: ReturnType<typeof result.current.redeem> | undefined;
    await act(async () => {
      res = result.current.redeem('NOEXISTE');
    });
    expect(res).toEqual({ ok: false, reason: 'unknown' });
    expect(result.current.state).toBe(before);
  });

  it('un código vacío se rechaza', async () => {
    const { result } = await mount();
    let res: ReturnType<typeof result.current.redeem> | undefined;
    await act(async () => {
      res = result.current.redeem('  - ');
    });
    expect(res).toEqual({ ok: false, reason: 'empty' });
  });

  it('un código ya canjeado dice «already» y no duplica ni cambia la fecha', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.redeem('CAMINO');
    });
    const first = result.current.state.items['vieira-camino'];
    const before = result.current.state;
    let res: ReturnType<typeof result.current.redeem> | undefined;
    await act(async () => {
      res = result.current.redeem('CAMINO');
    });
    expect(res).toMatchObject({ ok: true, already: true });
    expect(result.current.state).toBe(before);
    expect(result.current.state.items['vieira-camino']).toBe(first);
  });
});

describe('usePanuelo: colocación y color', () => {
  async function withPiece() {
    const hook = await mount();
    await act(async () => {
      hook.result.current.redeem('CAMINO');
    });
    return hook;
  }

  it('quitar descose la pieza pero la conserva, y persiste', async () => {
    const { result } = await withPiece();
    await act(async () => {
      result.current.unplace('vieira-camino');
    });
    expect(result.current.state.layout['vieira-camino']).toBeUndefined();
    expect(result.current.state.items['vieira-camino']).toBeDefined();
    const persisted = await saved(PANUELO_STATE_KEY);
    expect(persisted.layout['vieira-camino']).toBeUndefined();
    expect(persisted.items['vieira-camino']).toBeDefined();
  });

  it('colocar vuelve a coser una pieza descosida', async () => {
    const { result } = await withPiece();
    await act(async () => {
      result.current.unplace('vieira-camino');
    });
    await act(async () => {
      result.current.place('vieira-camino');
    });
    expect(result.current.state.layout['vieira-camino']).toBeDefined();
    expect(
      (await saved(PANUELO_STATE_KEY)).layout['vieira-camino'],
    ).toBeDefined();
  });

  it('colocar una pieza que no se tiene no hace nada', async () => {
    const { result } = await mount();
    const before = result.current.state;
    await act(async () => {
      result.current.place('medalla-jubileo-2025');
    });
    expect(result.current.state).toBe(before);
  });

  it('mover cambia la posición y persiste', async () => {
    const { result } = await withPiece();
    await act(async () => {
      result.current.move('vieira-camino', 0.3, 0.4);
    });
    const placement = result.current.state.layout['vieira-camino'];
    expect(placement.u).toBeCloseTo(0.3, 1);
    expect(placement.v).toBeCloseTo(0.4, 1);
    expect((await saved(PANUELO_STATE_KEY)).layout['vieira-camino']).toEqual(
      placement,
    );
  });

  it('mover una pieza no cosida no hace nada', async () => {
    const { result } = await mount();
    const before = result.current.state;
    await act(async () => {
      result.current.move('parche-pascua', 0.3, 0.4);
    });
    expect(result.current.state).toBe(before);
  });

  it('girar suma grados y persiste', async () => {
    const { result } = await withPiece();
    const rot = result.current.state.layout['vieira-camino'].rot;
    await act(async () => {
      result.current.rotate('vieira-camino', 15);
    });
    expect(result.current.state.layout['vieira-camino'].rot).not.toBe(rot);
    expect((await saved(PANUELO_STATE_KEY)).layout['vieira-camino'].rot).toBe(
      result.current.state.layout['vieira-camino'].rot,
    );
  });

  it('cambiar de color lo guarda; repetir el mismo no escribe otra vez', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.setColor('blue');
    });
    expect(result.current.state.color).toBe('blue');
    expect((await saved(PANUELO_STATE_KEY)).color).toBe('blue');
    const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
    await act(async () => {
      result.current.setColor('blue');
    });
    expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(writes);
  });

  it('dos gestos seguidos parten cada uno del resultado del anterior', async () => {
    const { result } = await withPiece();
    await act(async () => {
      result.current.setColor('yellow');
      result.current.move('vieira-camino', 0.2, 0.2);
    });
    expect(result.current.state.color).toBe('yellow');
    expect(result.current.state.layout['vieira-camino'].u).toBeCloseTo(0.2, 1);
  });
});

describe('usePanuelo: piezas sin ver', () => {
  it('lo que ya se tiene y no se ha presentado queda como «sin ver»', async () => {
    await store(PANUELO_STATE_KEY, state({ ...owned('parche-pascua', 10) }));
    const { result } = await mount();
    expect(result.current.unseen).toEqual(
      expect.arrayContaining(['parche-pascua', AUTO]),
    );
  });

  it('una pieza recién canjeada queda sin ver y markSeen la apaga y persiste', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.redeem('VERANO');
    });
    expect(result.current.unseen).toContain('cinta-campamento');
    await act(async () => {
      result.current.markSeen('cinta-campamento');
    });
    expect(result.current.unseen).not.toContain('cinta-campamento');
    expect(await saved(PANUELO_SEEN_KEY)).toContain('cinta-campamento');
  });

  it('las piezas salen por orden de fecha', async () => {
    await store(
      PANUELO_STATE_KEY,
      state({
        items: {
          'parche-pascua': { at: 30, via: 'code' },
          'vieira-camino': { at: 10, via: 'code' },
        },
      }),
    );
    await store(PANUELO_SEEN_KEY, [AUTO]);
    const { result } = await mount();
    const mine = result.current.unseen.filter((id) => id !== AUTO);
    expect(mine).toEqual(['vieira-camino', 'parche-pascua']);
  });

  it('lo visto guardado en el móvil no vuelve a salir como nuevo', async () => {
    await store(PANUELO_STATE_KEY, state({ ...owned('parche-pascua') }));
    await store(PANUELO_SEEN_KEY, ['parche-pascua', AUTO, 7]);
    const { result } = await mount();
    expect(result.current.unseen).toEqual([]);
  });

  it('markSeen repetido no escribe otra vez', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.markSeen(AUTO);
    });
    const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
    await act(async () => {
      result.current.markSeen(AUTO);
    });
    expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(writes);
  });

  it('una pieza repartida por el Panel, sin sitio y sin ver, se cose sola', async () => {
    await store(
      PANUELO_STATE_KEY,
      state({ items: { 'estrella-guia': { at: 50, via: 'manual' } } }),
    );
    const { result } = await mount();
    expect(result.current.state.layout['estrella-guia']).toBeDefined();
  });

  it('grantDemo da las piezas, las cose y las da por vistas', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.grantDemo(['nota-coro', 'luna-vigilia', 'no-existe']);
    });
    expect(result.current.state.items['nota-coro']).toMatchObject({
      via: 'demo',
    });
    expect(result.current.state.items['no-existe']).toBeUndefined();
    expect(result.current.state.layout['luna-vigilia']).toBeDefined();
    expect(result.current.unseen).not.toContain('nota-coro');
  });
});

describe('usePanuelo: sin sesión', () => {
  it('no lee ni escribe en Firebase', async () => {
    jest.useFakeTimers();
    const { result } = await mount();
    await act(async () => {
      result.current.redeem('CAMINO');
      result.current.move('vieira-camino', 0.1, 0.1);
      result.current.setColor('red');
    });
    await act(async () => {
      jest.advanceTimersByTime(LAYOUT_DELAY * 2);
    });
    expect(fetchPanuelo).not.toHaveBeenCalled();
    expect(syncPanueloItem).not.toHaveBeenCalled();
    expect(syncPanueloLayout).not.toHaveBeenCalled();
  });

  it('reset deja el móvil vacío sin tocar la nube', async () => {
    const { result } = await mount();
    await act(async () => {
      await result.current.reset();
    });
    expect(result.current.state).toEqual(EMPTY_PANUELO);
    expect(await saved(PANUELO_SEEN_KEY)).toEqual([]);
    expect(clearPanuelo).not.toHaveBeenCalled();
  });
});

describe('usePanuelo: con sesión', () => {
  beforeEach(() => {
    mockAuth.user = { uid: 'u1' };
  });

  it('lee la nube al montar y fusiona: suma las piezas de ambos lados', async () => {
    await store(PANUELO_STATE_KEY, state({ ...owned('parche-pascua', 100) }));
    fetchPanuelo.mockResolvedValue(
      state({
        items: { 'vieira-camino': { at: 50, via: 'code' } },
        layout: { 'vieira-camino': { u: 0.1, v: 0.1, rot: 0 } },
        layoutAt: 50,
        color: 'red',
      }),
    );
    const { result } = await mount();
    expect(fetchPanuelo).toHaveBeenCalledWith('u1');
    expect(Object.keys(result.current.state.items)).toEqual(
      expect.arrayContaining(['parche-pascua', 'vieira-camino']),
    );
  });

  it('sube a la nube las piezas que solo tiene el móvil, y su colocación', async () => {
    await store(
      PANUELO_STATE_KEY,
      state({ ...owned('parche-pascua', 100), layoutAt: 900 }),
    );
    await store(PANUELO_SEEN_KEY, ['parche-pascua', AUTO]);
    fetchPanuelo.mockResolvedValue(state());
    await mount();
    expect(syncPanueloItem).toHaveBeenCalledWith(
      'u1',
      'parche-pascua',
      expect.objectContaining({ at: 100 }),
    );
    expect(syncPanueloLayout).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ layoutAt: expect.any(Number) }),
    );
  });

  it('si la nube no responde no se sube nada de la fusión', async () => {
    await store(PANUELO_STATE_KEY, state({ ...owned('parche-pascua', 100) }));
    fetchPanuelo.mockResolvedValue(null);
    await mount();
    expect(syncPanueloItem).not.toHaveBeenCalledWith(
      'u1',
      'parche-pascua',
      expect.anything(),
    );
  });

  const soloManuales = (): PanueloCatalog =>
    Object.fromEntries(
      Object.entries(DEFAULT_PANUELO_CATALOG).filter(
        ([, item]) => item.grant?.type !== 'all',
      ),
    );
  const nubeConUnaPieza = () =>
    state({
      items: { 'vieira-camino': { at: 50, via: 'code' } },
      layout: { 'vieira-camino': { u: 0.1, v: 0.1, rot: 0 } },
      layoutAt: 50,
    });

  it('móvil nuevo (catálogo sin piezas para todos): lo de la nube no se presenta como nuevo', async () => {
    mockRemoteCatalog.data = soloManuales();
    fetchPanuelo.mockResolvedValue(nubeConUnaPieza());
    const { result } = await mount();
    expect(result.current.state.items['vieira-camino']).toBeDefined();
    expect(result.current.unseen).not.toContain('vieira-camino');
  });

  it('móvil nuevo con el catálogo de muestra: lo de la nube no se presenta como nuevo', async () => {
    fetchPanuelo.mockResolvedValue(nubeConUnaPieza());
    const { result } = await mount();
    expect(result.current.unseen).not.toContain('vieira-camino');
  });

  it('una pieza canjeada se sube enseguida y la colocación, con retardo', async () => {
    const { result } = await mount();
    syncPanueloItem.mockClear();
    syncPanueloLayout.mockClear();
    jest.useFakeTimers();
    await act(async () => {
      result.current.redeem('CAMINO');
    });
    expect(syncPanueloItem).toHaveBeenCalledWith(
      'u1',
      'vieira-camino',
      expect.objectContaining({ via: 'code' }),
    );
    expect(syncPanueloLayout).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(LAYOUT_DELAY - 1);
    });
    expect(syncPanueloLayout).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(syncPanueloLayout).toHaveBeenCalledTimes(1);
    expect(syncPanueloLayout).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        items: expect.objectContaining({ 'vieira-camino': expect.anything() }),
      }),
    );
  });

  it('arrastrar varias veces seguidas sube la colocación una sola vez, con la última', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.redeem('CAMINO');
    });
    jest.useFakeTimers();
    syncPanueloLayout.mockClear();
    await act(async () => {
      result.current.move('vieira-camino', 0.1, 0.1);
      jest.advanceTimersByTime(500);
      result.current.move('vieira-camino', 0.2, 0.2);
      jest.advanceTimersByTime(500);
      result.current.move('vieira-camino', 0.3, 0.3);
    });
    expect(syncPanueloLayout).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(LAYOUT_DELAY);
    });
    expect(syncPanueloLayout).toHaveBeenCalledTimes(1);
    const sent = syncPanueloLayout.mock.calls[0][1] as PanueloUserState;
    expect(sent.layout['vieira-camino'].u).toBeCloseTo(0.3, 1);
  });

  it('al desmontar con la subida pendiente, se sube ya', async () => {
    const { result, unmount } = await mount();
    jest.useFakeTimers();
    await act(async () => {
      result.current.setColor('yellow');
    });
    syncPanueloLayout.mockClear();
    await act(async () => {
      unmount();
    });
    expect(syncPanueloLayout).toHaveBeenCalledTimes(1);
    expect(syncPanueloLayout).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ color: 'yellow' }),
    );
  });

  it('reset borra también la nube y cancela la subida pendiente', async () => {
    const { result } = await mount();
    jest.useFakeTimers();
    await act(async () => {
      result.current.setColor('red');
    });
    syncPanueloLayout.mockClear();
    await act(async () => {
      await result.current.reset();
    });
    expect(clearPanuelo).toHaveBeenCalledWith('u1');
    await act(async () => {
      jest.advanceTimersByTime(LAYOUT_DELAY * 2);
    });
    expect(syncPanueloLayout).not.toHaveBeenCalled();
  });
});

describe('usePanuelo: cambio de etapa e historial', () => {
  /** Un móvil con la pieza `vieira-camino` ya cosida. */
  async function dressed() {
    const hook = await mount();
    await act(async () => {
      hook.result.current.redeem('CAMINO');
    });
    return hook;
  }

  it('llevándose las piezas: guarda el recuerdo, cambia el color y deja las piezas', async () => {
    const { result } = await dressed();
    const before = result.current.state.layout;
    await act(async () => {
      result.current.changeStage('red', true);
    });
    expect(result.current.state.color).toBe('red');
    expect(result.current.state.layout).toEqual(before);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].color).toBe('green');
    expect(result.current.history[0].layout).toEqual(before);
    // Y todo, en el móvil.
    const persisted = await saved(PANUELO_STATE_KEY);
    expect(persisted.color).toBe('red');
    expect(Object.values(persisted.history)).toHaveLength(1);
  });

  it('con el pañuelo limpio: descose todo pero lo conserva en la colección y en el recuerdo', async () => {
    const { result } = await dressed();
    const before = result.current.state.layout;
    await act(async () => {
      result.current.changeStage('blue', false);
    });
    expect(result.current.state.layout).toEqual({});
    expect(result.current.state.items['vieira-camino']).toBeDefined();
    expect(result.current.history[0].layout).toEqual(before);
    expect((await saved(PANUELO_STATE_KEY)).layout).toEqual({});
  });

  it('el historial sale del más reciente al más antiguo', async () => {
    const { result } = await dressed();
    await act(async () => {
      result.current.changeStage('red', true);
    });
    await act(async () => {
      result.current.changeStage('blue', true);
    });
    expect(result.current.history.map((m) => m.color)).toEqual([
      'red',
      'green',
    ]);
  });

  it('sin piezas cosidas no hay recuerdo; al mismo color, tampoco cambio', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.unplace(AUTO);
    });
    await act(async () => {
      result.current.changeStage('red', false);
    });
    expect(result.current.state.color).toBe('red');
    expect(result.current.history).toEqual([]);
    const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
    await act(async () => {
      result.current.changeStage('red', true);
    });
    expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(writes);
  });

  it('lee el historial guardado en el móvil', async () => {
    await store(
      PANUELO_STATE_KEY,
      state({
        history: {
          '5': { color: 'yellow', at: 5, layout: {} },
          '9': { color: 'red', at: 9, layout: {} },
        },
      }),
    );
    const { result } = await mount();
    expect(result.current.history.map((m) => m.at)).toEqual([9, 5]);
  });

  it('reset también vacía el historial', async () => {
    const { result } = await dressed();
    await act(async () => {
      result.current.changeStage('red', true);
    });
    await act(async () => {
      await result.current.reset();
    });
    expect(result.current.history).toEqual([]);
    expect((await saved(PANUELO_STATE_KEY)).history).toBeUndefined();
  });

  it('sin sesión no sube nada', async () => {
    jest.useFakeTimers();
    const { result } = await dressed();
    await act(async () => {
      result.current.changeStage('red', true);
    });
    await act(async () => {
      jest.advanceTimersByTime(LAYOUT_DELAY * 2);
    });
    expect(syncPanueloMemory).not.toHaveBeenCalled();
  });

  describe('con sesión', () => {
    beforeEach(() => {
      mockAuth.user = { uid: 'u1' };
      fetchPanuelo.mockResolvedValue(state());
    });

    it('sube el recuerdo ya (una escritura suelta) y el color con el retardo de siempre', async () => {
      const { result } = await dressed();
      jest.useFakeTimers();
      syncPanueloMemory.mockClear();
      syncPanueloLayout.mockClear();
      await act(async () => {
        result.current.changeStage('red', false);
      });
      expect(syncPanueloMemory).toHaveBeenCalledTimes(1);
      expect(syncPanueloMemory).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          color: 'green',
          layout: expect.objectContaining({
            'vieira-camino': expect.anything(),
          }),
        }),
      );
      expect(syncPanueloLayout).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(LAYOUT_DELAY);
      });
      expect(syncPanueloLayout).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ color: 'red', layout: {} }),
      );
    });

    it('sin piezas cosidas no sube ningún recuerdo', async () => {
      const { result } = await mount();
      await act(async () => {
        result.current.unplace(AUTO);
      });
      await act(async () => {
        result.current.changeStage('red', true);
      });
      expect(syncPanueloMemory).not.toHaveBeenCalled();
    });

    it('al abrir, suma los recuerdos de la nube y sube solo los que le faltan a la nube', async () => {
      await store(
        PANUELO_STATE_KEY,
        state({ history: { '1': { color: 'red', at: 1, layout: {} } } }),
      );
      await store(PANUELO_SEEN_KEY, [AUTO]);
      fetchPanuelo.mockResolvedValue(
        state({
          history: { '2': { color: 'blue', at: 2, layout: {} } },
        }),
      );
      const { result } = await mount();
      expect(result.current.history.map((m) => m.at)).toEqual([2, 1]);
      expect(syncPanueloMemory).toHaveBeenCalledTimes(1);
      expect(syncPanueloMemory).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ at: 1 }),
      );
    });

    it('si la nube ya lo tiene, no se vuelve a subir', async () => {
      const history = { '1': { color: 'red' as const, at: 1, layout: {} } };
      await store(PANUELO_STATE_KEY, state({ history }));
      fetchPanuelo.mockResolvedValue(state({ history }));
      await mount();
      expect(syncPanueloMemory).not.toHaveBeenCalled();
    });
  });
});

describe('usePanuelo: recolocar', () => {
  it('reparte las piezas cosidas sin giros, lo guarda y lo sube con el retardo de siempre', async () => {
    mockAuth.user = { uid: 'u1' };
    fetchPanuelo.mockResolvedValue(state());
    const { result } = await mount();
    await act(async () => {
      result.current.redeem('CAMINO');
    });
    await act(async () => {
      result.current.rotate('vieira-camino', 45);
      result.current.move('vieira-camino', 0.5, 0.5);
    });
    jest.useFakeTimers();
    syncPanueloLayout.mockClear();
    await act(async () => {
      result.current.arrange();
    });
    const layout = result.current.state.layout;
    expect(Object.keys(layout).sort()).toEqual([AUTO, 'vieira-camino'].sort());
    expect(Object.values(layout).every((p) => p.rot === 0)).toBe(true);
    expect((await saved(PANUELO_STATE_KEY)).layout['vieira-camino'].rot).toBe(
      0,
    );
    await act(async () => {
      jest.advanceTimersByTime(LAYOUT_DELAY);
    });
    expect(syncPanueloLayout).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ layout }),
    );
  });

  it('sin piezas cosidas no escribe nada', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.unplace(AUTO);
    });
    const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
    await act(async () => {
      result.current.arrange();
    });
    expect((AsyncStorage.setItem as jest.Mock).mock.calls.length).toBe(writes);
  });
});

describe('usePanuelo: la mitad de un intercambio', () => {
  const trade = {
    code: 'K7WQ4M',
    status: 'accepted' as const,
    createdAt: 1,
    expiresAt: 2,
    offer: { uid: 'u1', itemId: AUTO },
    answer: { uid: 'luis', itemId: 'pulsera-amistad' },
  };

  it('sale la dada, entra la recibida en su sitio, se presenta y se sube una vez', async () => {
    mockAuth.user = { uid: 'u1' };
    fetchPanuelo.mockResolvedValue(state());
    const { result } = await mount();
    await act(async () => {
      result.current.markSeen('pulsera-amistad');
    });
    const spot = result.current.state.layout[AUTO];
    let applied = false;
    await act(async () => {
      applied = result.current.applyTradeHalf(trade);
    });
    expect(applied).toBe(true);
    expect(result.current.state.items[AUTO]).toBeUndefined();
    expect(result.current.state.items['pulsera-amistad'].via).toBe('trade');
    expect(result.current.state.layout['pulsera-amistad']).toEqual(spot);
    expect(result.current.unseen).toContain('pulsera-amistad');
    const sync = helpers.syncPanueloTradeHalf as jest.Mock;
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync.mock.calls[0][2]).toEqual({
      give: AUTO,
      take: 'pulsera-amistad',
    });
    // La segunda vez no cambia nada.
    await act(async () => {
      applied = result.current.applyTradeHalf(trade);
    });
    expect(applied).toBe(false);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('sin sesión no hace nada', async () => {
    const { result } = await mount();
    let applied = true;
    await act(async () => {
      applied = result.current.applyTradeHalf(trade);
    });
    expect(applied).toBe(false);
  });
});
