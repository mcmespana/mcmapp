/**
 * El servicio de intercambios (`services/panueloTradeService.ts`) contra el
 * mock de Firebase: `runTransaction` aplica la función al nodo registrado con
 * `__setMockNode`, así que dos llamadas seguidas ven lo que dejó la primera
 * (como dos móviles contra el mismo servidor).
 */
import * as db from 'firebase/database';

import {
  TRADE_TIMEOUT_MS,
  acceptTradeRemote,
  answerTradeRemote,
  cancelTradeRemote,
  fetchTrade,
  getServerOffset,
  openTrade,
  removeTrade,
  subscribeTrade,
} from '@/services/panueloTradeService';
import type { PanueloUserState } from '@/types/panuelo';
import { syncPanueloTradeHalf } from '@/utils/authHelpers';
import { EMPTY_PANUELO, sanitizeCatalog } from '@/utils/panuelo';
import { TRADE_TTL_MS, applyTrade } from '@/utils/panueloTrade';

const mockDb = db as unknown as typeof db & {
  __setMockNode: (path: string, value: unknown) => void;
  __resetMockDb: () => void;
};

const NOW = 1_800_000_000_000;
const catalog = sanitizeCatalog({
  roja: { kind: 'pulsera', name: 'Roja', look: { colors: ['#f00'] } },
  azul: { kind: 'pulsera', name: 'Azul', look: { colors: ['#00f'] } },
  verde: { kind: 'pulsera', name: 'Verde', look: { colors: ['#0f0'] } },
});
const owning = (...ids: string[]): PanueloUserState => ({
  ...EMPTY_PANUELO,
  items: Object.fromEntries(
    ids.map((id) => [id, { at: NOW - 1000, via: 'manual' as const }]),
  ),
  layout: Object.fromEntries(
    ids.map((id, i) => [id, { u: i * 0.3, v: 0.2, rot: 0 }]),
  ),
});

/** Un `random` que da siempre el mismo código: AAAAAA, luego BBBBBB… */
const codeSeq = (...letters: number[]) => {
  let n = 0;
  return () => {
    const v = letters[Math.floor(n / 6)] ?? 0;
    n += 1;
    return v;
  };
};

beforeEach(() => {
  mockDb.__resetMockDb();
  jest.clearAllMocks();
});

async function openAna() {
  const r = await openTrade({
    catalog,
    state: owning('roja', 'verde'),
    uid: 'ana',
    name: 'Ana',
    itemId: 'roja',
    now: NOW,
    random: () => 0,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.trade;
}

describe('abrir', () => {
  it('escribe el nodo entero, con `have`, por transacción', async () => {
    const trade = await openAna();
    expect(trade.code).toBe('AAAAAA');
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    const read = await fetchTrade('aaa-aaa');
    expect(read).toEqual({ ok: true, trade });
    expect(trade.offer).toEqual({
      uid: 'ana',
      name: 'Ana',
      itemId: 'roja',
      have: ['verde'],
    });
  });

  it('si el código está ocupado y vivo, prueba con otro', async () => {
    await openAna();
    // 0 → 'A' (ocupado); 1/31 → 'B'.
    const r = await openTrade({
      catalog,
      state: owning('azul'),
      uid: 'marta',
      itemId: 'azul',
      now: NOW + 1000,
      random: codeSeq(0, 1 / 31),
    });
    expect(r).toMatchObject({ ok: true, trade: { code: 'BBBBBB' } });
    expect((await fetchTrade('AAAAAA')).ok).toBe(true);
  });

  it('reutiliza un código abandonado hace más de un día', async () => {
    await openAna();
    const r = await openTrade({
      catalog,
      state: owning('azul'),
      uid: 'marta',
      itemId: 'azul',
      now: NOW + TRADE_TTL_MS + 25 * 3600 * 1000,
      random: () => 0,
    });
    expect(r).toMatchObject({ ok: true, trade: { code: 'AAAAAA' } });
  });

  it('tres códigos ocupados seguidos: `busy`', async () => {
    await openAna();
    const r = await openTrade({
      catalog,
      state: owning('azul'),
      uid: 'marta',
      itemId: 'azul',
      now: NOW,
      random: () => 0,
    });
    expect(r).toEqual({ ok: false, reason: 'busy' });
  });

  it('lo que no se puede ofrecer no llega a Firebase', async () => {
    const r = await openTrade({
      catalog,
      state: EMPTY_PANUELO,
      uid: 'ana',
      itemId: 'roja',
      now: NOW,
    });
    expect(r).toEqual({ ok: false, reason: 'not-owned' });
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});

describe('contestar, aceptar, cancelar', () => {
  const answer = (uid: string, itemId: string | null, state = owning('azul')) =>
    answerTradeRemote({
      code: 'AAAAAA',
      catalog,
      state,
      uid,
      name: uid,
      itemId,
      now: NOW + 1000,
    });

  it('dos contestan a la vez: uno gana y el otro recibe `closed`', async () => {
    await openAna();
    const [luis, marta] = await Promise.all([
      answer('luis', 'azul'),
      answer('marta', null, EMPTY_PANUELO),
    ]);
    expect(luis).toMatchObject({ ok: true, trade: { status: 'proposed' } });
    expect(marta).toEqual({ ok: false, reason: 'closed' });
  });

  it('no puede darle una que ya tiene (`they-have`)', async () => {
    await openAna();
    expect(await answer('luis', 'verde', owning('verde'))).toEqual({
      ok: false,
      reason: 'they-have',
    });
  });

  it('aceptar deja `accepted` y las dos mitades se pueden aplicar', async () => {
    await openAna();
    await answer('luis', 'azul');
    const r = await acceptTradeRemote({
      code: 'AAAAAA',
      state: owning('roja', 'verde'),
      uid: 'ana',
      now: NOW + 2000,
    });
    expect(r).toMatchObject({ ok: true, trade: { status: 'accepted' } });
    if (!r.ok) return;
    const ana = applyTrade(owning('roja', 'verde'), r.trade, 'ana', NOW + 3000);
    expect(Object.keys(ana.items).sort()).toEqual(['azul', 'verde']);
  });

  it('cancelar después de aceptar: `closed`', async () => {
    await openAna();
    await answer('luis', 'azul');
    await acceptTradeRemote({
      code: 'AAAAAA',
      state: owning('roja'),
      uid: 'ana',
      now: NOW + 2000,
    });
    expect(await cancelTradeRemote({ code: 'AAAAAA', uid: 'luis' })).toEqual({
      ok: false,
      reason: 'closed',
    });
  });

  it('cancelar antes: cualquiera de los dos', async () => {
    await openAna();
    await answer('luis', 'azul');
    expect(
      await cancelTradeRemote({ code: 'AAAAAA', uid: 'luis' }),
    ).toMatchObject({ ok: true, trade: { status: 'cancelled' } });
  });

  it('un código que no existe: `not-found` sin transacción', async () => {
    expect(await answer('luis', 'azul')).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});

describe('fallos de Firebase', () => {
  it('sin respuesta en 8 s: `offline`', async () => {
    jest.useFakeTimers();
    try {
      (db.get as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
      const pending = fetchTrade('AAAAAA');
      jest.advanceTimersByTime(TRADE_TIMEOUT_MS + 1);
      await expect(pending).resolves.toEqual({
        ok: false,
        reason: 'offline',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('reglas sin desplegar: `rules`, no el error crudo', async () => {
    await openAna();
    (db.runTransaction as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('permission_denied at /panueloTrades/AAAAAA'), {
        code: 'PERMISSION_DENIED',
      }),
    );
    expect(await cancelTradeRemote({ code: 'AAAAAA', uid: 'ana' })).toEqual({
      ok: false,
      reason: 'rules',
    });
  });

  it('lo leído se sanea: basura es `not-found`', async () => {
    mockDb.__setMockNode('panueloTrades/AAAAAA', { code: 'AAAAAA', x: 1 });
    expect(await fetchTrade('AAAAAA')).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('la suscripción también sanea', () => {
    let emit: (snap: unknown) => void = () => {};
    (db.onValue as jest.Mock).mockImplementationOnce((_r, cb) => {
      emit = cb;
      return jest.fn();
    });
    const seen: unknown[] = [];
    subscribeTrade('AAAAAA', (t) => seen.push(t));
    emit({ exists: () => true, val: () => ({ status: 'raro' }) });
    expect(seen).toEqual([null]);
  });

  it('la hora del servidor: un número, o 0', async () => {
    mockDb.__setMockNode('.info/serverTimeOffset', 1500);
    expect(await getServerOffset()).toBe(1500);
    mockDb.__resetMockDb();
    expect(await getServerOffset()).toBe(0);
  });

  it('borrar un código mal escrito no llama a Firebase', async () => {
    expect(await removeTrade('xx')).toBe(false);
    expect(db.remove).not.toHaveBeenCalled();
  });
});

describe('syncPanueloTradeHalf', () => {
  it('borra la dada, apunta `gone` y sube la recibida en UNA llamada', async () => {
    const state: PanueloUserState = {
      ...owning('azul'),
      items: { azul: { at: NOW + 5, via: 'trade' } },
      gone: { roja: NOW + 5 },
      layoutAt: NOW + 5,
    };
    await syncPanueloTradeHalf('ana', state, { give: 'roja', take: 'azul' });
    expect(db.update).toHaveBeenCalledTimes(1);
    const [reference, changes] = (db.update as jest.Mock).mock.calls[0];
    expect(reference).toEqual({ path: 'users/ana/panuelo' });
    expect(changes).toMatchObject({
      'items/roja': null,
      'gone/roja': NOW + 5,
      'items/azul': { at: NOW + 5, via: 'trade' },
      layoutAt: NOW + 5,
    });
  });

  it('un regalo recibido no borra nada', async () => {
    const state: PanueloUserState = {
      ...EMPTY_PANUELO,
      items: { roja: { at: NOW, via: 'trade' } },
    };
    await syncPanueloTradeHalf('luis', state, { give: null, take: 'roja' });
    const changes = (db.update as jest.Mock).mock.calls[0][1];
    expect(Object.keys(changes).sort()).toEqual([
      'items/roja',
      'layout',
      'layoutAt',
    ]);
  });
});
