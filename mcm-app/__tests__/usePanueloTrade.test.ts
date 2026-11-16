/**
 * Tests de `hooks/usePanueloTrade.ts`: el intercambio en curso en un móvil.
 *
 * Se usa el servicio de verdad contra el mock de Firebase, con un pequeño
 * "servidor" encima: `onValue` registra a quien escucha y cada transacción
 * que se confirma se lo cuenta. Lo que hace "el otro móvil" se hace llamando
 * al servicio directamente con el otro uid.
 */
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as db from 'firebase/database';

import {
  TRADE_MINE_KEY,
  TRADE_PENDING_KEY,
  tradeMessage,
  usePanueloTrade,
  type PanueloTradeInput,
  type TradeMessageKey,
} from '@/hooks/usePanueloTrade';
import {
  acceptTradeRemote,
  answerTradeRemote,
  cancelTradeRemote,
  openTrade,
} from '@/services/panueloTradeService';
import type { PanueloUserState } from '@/types/panuelo';
import { EMPTY_PANUELO, sanitizeCatalog } from '@/utils/panuelo';
import type { PanueloTrade } from '@/utils/panueloTrade';

const mockAuth: { user: { uid: string; displayName: string } | null } = {
  user: null,
};
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuth.user }),
}));
jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/utils/haptics', () => ({
  h: { select: jest.fn(), formSuccess: jest.fn() },
}));
jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockDb = db as unknown as typeof db & {
  __setMockNode: (path: string, value: unknown) => void;
  __resetMockDb: () => void;
};

const catalog = sanitizeCatalog({
  roja: { kind: 'pulsera', name: 'Roja', look: { colors: ['#f00'] } },
  azul: { kind: 'pulsera', name: 'Azul', look: { colors: ['#00f'] } },
});
const owning = (...ids: string[]): PanueloUserState => ({
  ...EMPTY_PANUELO,
  items: Object.fromEntries(
    ids.map((id) => [id, { at: 1000, via: 'manual' as const }]),
  ),
});

// ── El "servidor": quien escucha se entera de cada transacción ─────────────
type Listener = (snap: { exists: () => boolean; val: () => unknown }) => void;
const listeners = new Map<string, Set<Listener>>();
async function emit(path: string) {
  const snap = await (db.get as jest.Mock)({ path });
  for (const cb of listeners.get(path) ?? []) cb(snap);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockDb.__resetMockDb();
  listeners.clear();
  (db.onValue as jest.Mock).mockImplementation(
    (reference: { path: string }, cb: Listener) => {
      const set = listeners.get(reference.path) ?? new Set();
      set.add(cb);
      listeners.set(reference.path, set);
      void emit(reference.path);
      return () => set.delete(cb);
    },
  );
  const tx = (db.runTransaction as jest.Mock).getMockImplementation()!;
  (db.runTransaction as jest.Mock).mockImplementation(
    async (reference: { path: string }, fn: unknown, opts: unknown) => {
      const r = await tx(reference, fn, opts);
      if (r.committed) await emit(reference.path);
      return r;
    },
  );
});

async function mount(
  uid: string | null,
  state: PanueloUserState,
  applyTradeHalf = jest.fn((_trade: PanueloTrade) => true),
) {
  mockAuth.user = uid ? { uid, displayName: `${uid} Apellido` } : null;
  const input: PanueloTradeInput = {
    ready: true,
    catalog,
    state,
    applyTradeHalf,
  };
  const hook = await renderHook(() => usePanueloTrade(input));
  return { applyTradeHalf, ...hook };
}

const flush = () => act(async () => {});

/** Ana (desde "su móvil", en el test) abre un intercambio con la roja. */
async function anaOpens(now = Date.now()): Promise<PanueloTrade> {
  const r = await openTrade({
    catalog,
    state: owning('roja'),
    uid: 'ana',
    name: 'Ana',
    itemId: 'roja',
    now,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.trade;
}

async function saved(key: string) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

describe('quien ofrece (Ana)', () => {
  it('ofrecer → propuesta → aceptar aplica su mitad una vez', async () => {
    const { result, applyTradeHalf } = await mount('ana', owning('roja'));
    await flush();
    await act(async () => {
      result.current.start({ mode: 'offer' });
    });
    expect(result.current.phase).toBe('choosing');
    await act(async () => result.current.offer('roja'));
    expect(result.current.phase).toBe('offering');
    const code = result.current.trade!.code;
    expect(await saved(TRADE_PENDING_KEY)).toEqual({ code, role: 'offer' });
    expect((await saved(TRADE_MINE_KEY))[0].code).toBe(code);

    // Luis contesta desde su móvil.
    await act(async () => {
      await answerTradeRemote({
        code,
        catalog,
        state: owning('azul'),
        uid: 'luis',
        name: 'Luis',
        itemId: 'azul',
        now: Date.now(),
      });
    });
    expect(result.current.phase).toBe('reviewing');
    expect(result.current.trade?.answer?.itemId).toBe('azul');

    await act(async () => result.current.accept());
    expect(result.current.phase).toBe('done');
    expect(result.current.received).toBe('azul');
    expect(applyTradeHalf).toHaveBeenCalledTimes(1);
    expect(applyTradeHalf.mock.calls[0][0]).toMatchObject({
      status: 'accepted',
    });
    expect(await saved(TRADE_PENDING_KEY)).toBeNull();
  });

  it('un segundo «ofrecer» con uno abierto devuelve el abierto', async () => {
    const { result } = await mount('ana', owning('roja', 'azul'));
    await flush();
    await act(async () => result.current.offer('roja'));
    const code = result.current.trade!.code;
    await act(async () => result.current.offer('azul'));
    expect(result.current.trade!.code).toBe(code);
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
  });

  it('si Luis se echa atrás, lo dice', async () => {
    const { result } = await mount('ana', owning('roja'));
    await flush();
    await act(async () => result.current.offer('roja'));
    const code = result.current.trade!.code;
    await act(async () => {
      await answerTradeRemote({
        code,
        catalog,
        state: owning('azul'),
        uid: 'luis',
        name: 'Luis',
        itemId: 'azul',
        now: Date.now(),
      });
      await cancelTradeRemote({ code, uid: 'luis' });
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.message).toBe('Luis se ha echado atrás.');
  });

  it('sin sesión no se llama al servicio', async () => {
    const { result } = await mount(null, owning('roja'));
    await flush();
    await act(async () => {
      result.current.start({ mode: 'offer', itemId: 'roja' });
    });
    expect(result.current.phase).toBe('signin');
    expect(result.current.message).toBe(tradeMessage('no-session'));
    await act(async () => result.current.offer('roja'));
    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it('con las reglas sin desplegar, un mensaje claro y no el error crudo', async () => {
    const { result } = await mount('ana', owning('roja'));
    await flush();
    (db.runTransaction as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('permission_denied at /panueloTrades/X'), {
        code: 'PERMISSION_DENIED',
      }),
    );
    await act(async () => result.current.offer('roja'));
    expect(result.current.phase).toBe('error');
    expect(result.current.message).toBe(tradeMessage('rules'));
    expect(result.current.message).not.toMatch(/permission/i);
  });
});

describe('quien contesta (Luis)', () => {
  it('escribe el código, propone y aplica al ver `accepted`', async () => {
    const trade = await anaOpens();
    const { result, applyTradeHalf } = await mount('luis', owning('azul'));
    await flush();
    await act(async () => {
      result.current.start({ mode: 'join', code: trade.code });
    });
    expect(result.current.prefill).toBe(trade.code);
    await act(async () => result.current.join(trade.code.toLowerCase()));
    expect(result.current.phase).toBe('answering');
    await act(async () => result.current.answer('azul'));
    expect(result.current.phase).toBe('waiting');
    expect(await saved(TRADE_PENDING_KEY)).toEqual({
      code: trade.code,
      role: 'answer',
    });

    await act(async () => {
      await acceptTradeRemote({
        code: trade.code,
        state: owning('roja'),
        uid: 'ana',
        now: Date.now(),
      });
    });
    expect(result.current.phase).toBe('done');
    expect(result.current.received).toBe('roja');
    expect(applyTradeHalf).toHaveBeenCalledTimes(1);
  });

  it('un código mal escrito o que no existe, sin salir del paso', async () => {
    const { result } = await mount('luis', owning('azul'));
    await flush();
    await act(async () => {
      result.current.start({ mode: 'join' });
    });
    await act(async () => result.current.join('ABC'));
    expect(result.current.message).toBe(tradeMessage('bad-code'));
    await act(async () => result.current.join('ABCDEF'));
    expect(result.current.message).toBe(tradeMessage('not-found'));
    expect(result.current.phase).toBe('joining');
  });

  it('caducado: lo dice y no deja seguir', async () => {
    const trade = await anaOpens(Date.now() - 11 * 60 * 1000);
    const { result } = await mount('luis', owning('azul'));
    await flush();
    await act(async () => {
      result.current.start({ mode: 'join' });
    });
    await act(async () => result.current.join(trade.code));
    expect(result.current.message).toBe(tradeMessage('expired'));
    expect(result.current.phase).toBe('joining');
  });

  it('su propio código, o una pieza que ya tiene', async () => {
    const trade = await anaOpens();
    const ana = await mount('ana', owning('roja'));
    await flush();
    await act(async () => {
      ana.result.current.start({ mode: 'join' });
    });
    await act(async () => ana.result.current.join(trade.code));
    expect(ana.result.current.message).toBe(tradeMessage('own-offer'));
    await ana.unmount();

    const { result } = await mount('luis', owning('roja'));
    await flush();
    await act(async () => {
      result.current.start({ mode: 'join' });
    });
    await act(async () => result.current.join(trade.code));
    expect(result.current.message).toBe(
      'Ya tienes «Roja». En el pañuelo cada pieza va una vez.',
    );
  });

  it('si Ana cancela, lo dice', async () => {
    const trade = await anaOpens();
    const { result } = await mount('luis', owning('azul'));
    await flush();
    await act(async () => result.current.join(trade.code));
    await act(async () => result.current.answer(null));
    await act(async () => {
      await cancelTradeRemote({ code: trade.code, uid: 'ana' });
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.message).toBe('Ana ha cancelado el intercambio.');
  });
});

describe('recuperación al abrir el pañuelo', () => {
  async function proposedAndAccepted() {
    const trade = await anaOpens();
    await answerTradeRemote({
      code: trade.code,
      catalog,
      state: owning('azul'),
      uid: 'luis',
      itemId: 'azul',
      now: Date.now(),
    });
    return trade;
  }

  it('Luis cerró la app tras proponer y Ana aceptó: al abrir, recibe la pieza', async () => {
    const trade = await proposedAndAccepted();
    await acceptTradeRemote({
      code: trade.code,
      state: owning('roja'),
      uid: 'ana',
      now: Date.now(),
    });
    await AsyncStorage.setItem(
      TRADE_PENDING_KEY,
      JSON.stringify({ code: trade.code, role: 'answer' }),
    );
    const { result, applyTradeHalf } = await mount('luis', owning('azul'));
    await flush();
    await flush();
    expect(applyTradeHalf).toHaveBeenCalledTimes(1);
    expect(applyTradeHalf.mock.calls[0][0]).toMatchObject({
      code: trade.code,
      status: 'accepted',
    });
    expect(await saved(TRADE_PENDING_KEY)).toBeNull();
    // Se presenta en el visor; la hoja no se abre.
    expect(result.current.sheetOpen).toBe(false);
  });

  it('si sigue vivo, reabre la hoja donde estaba', async () => {
    const trade = await proposedAndAccepted();
    await AsyncStorage.setItem(
      TRADE_PENDING_KEY,
      JSON.stringify({ code: trade.code, role: 'offer' }),
    );
    const { result } = await mount('ana', owning('roja'));
    await flush();
    await flush();
    expect(result.current.sheetOpen).toBe(true);
    expect(result.current.phase).toBe('reviewing');
  });

  it('cancelado o caducado: se olvida', async () => {
    const trade = await anaOpens(Date.now() - 11 * 60 * 1000);
    await AsyncStorage.setItem(
      TRADE_PENDING_KEY,
      JSON.stringify({ code: trade.code, role: 'offer' }),
    );
    const { result, applyTradeHalf } = await mount('ana', owning('roja'));
    await flush();
    await flush();
    expect(applyTradeHalf).not.toHaveBeenCalled();
    expect(result.current.sheetOpen).toBe(false);
    expect(await saved(TRADE_PENDING_KEY)).toBeNull();
  });

  it('limpieza: borra los suyos caducados y guarda los aceptados de hoy', async () => {
    const old = await anaOpens(Date.now() - 11 * 60 * 1000);
    await AsyncStorage.setItem(
      TRADE_MINE_KEY,
      JSON.stringify([{ code: old.code, expiresAt: old.expiresAt }]),
    );
    await mount('ana', owning('roja'));
    await flush();
    await flush();
    expect(db.remove).toHaveBeenCalledWith({
      path: `panueloTrades/${old.code}`,
    });
    expect(await saved(TRADE_MINE_KEY)).toBeNull();
  });
});

describe('los mensajes', () => {
  const keys: TradeMessageKey[] = [
    'no-session',
    'offline',
    'bad-code',
    'not-found',
    'expired',
    'expired-mine',
    'own-offer',
    'already-have',
    'already-have-accept',
    'they-have',
    'closed',
    'not-owned',
    'not-tradeable',
    'unknown-item',
    'not-yours',
    'cancelled-by-offer',
    'cancelled-by-answer',
    'gone',
    'rules',
    'busy',
    'error',
  ];

  it.each(keys)('%s: frase corta, sin exclamaciones ni errores crudos', (k) => {
    const text = tradeMessage(k, { other: 'Ana', item: 'Roja' });
    expect(text.length).toBeGreaterThan(5);
    expect(text).not.toMatch(/!|¡|permission|undefined/i);
  });

  it('sin nombre, «la otra persona»', () => {
    expect(tradeMessage('cancelled-by-answer')).toBe(
      'La otra persona se ha echado atrás.',
    );
  });
});
