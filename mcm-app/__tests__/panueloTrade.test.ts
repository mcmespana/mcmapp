import type { PanueloUserState } from '@/types/panuelo';
import { EMPTY_PANUELO, mergePanuelo, sanitizeCatalog } from '@/utils/panuelo';
import {
  TRADE_TTL_MS,
  acceptTrade,
  answerTrade,
  applyTrade,
  cancelTrade,
  createTradeOffer,
  generateTradeCode,
  isTradeCode,
  normalizeTradeCode,
  type PanueloTrade,
} from '@/utils/panueloTrade';

const NOW = 1_800_000_000_000;

const catalog = sanitizeCatalog({
  roja: { kind: 'pulsera', name: 'Roja', look: { colors: ['#f00'] } },
  azul: { kind: 'pulsera', name: 'Azul', look: { colors: ['#00f'] } },
  medalla: {
    kind: 'medalla',
    name: 'Medalla',
    look: { ribbon: ['#fff'] },
  },
});

const owning = (...ids: string[]): PanueloUserState => ({
  ...EMPTY_PANUELO,
  items: Object.fromEntries(
    ids.map((id) => [id, { at: NOW - 1000, via: 'manual' as const }]),
  ),
  layout: Object.fromEntries(
    ids.map((id, i) => [id, { u: i * 0.3, v: 0.2, rot: 15 }]),
  ),
});

/** Ana ofrece la roja; Luis contesta con la azul; Ana acepta. */
function agreed(): PanueloTrade {
  const offer = createTradeOffer({
    catalog,
    state: owning('roja'),
    uid: 'ana',
    name: 'Ana',
    itemId: 'roja',
    now: NOW,
    random: () => 0,
  });
  if (!offer.ok) throw new Error(offer.reason);
  const answer = answerTrade({
    trade: offer.trade,
    catalog,
    state: owning('azul'),
    uid: 'luis',
    itemId: 'azul',
    now: NOW + 1000,
  });
  if (!answer.ok) throw new Error(answer.reason);
  const accepted = acceptTrade({
    trade: answer.trade,
    state: owning('roja'),
    uid: 'ana',
    now: NOW + 2000,
  });
  if (!accepted.ok) throw new Error(accepted.reason);
  return accepted.trade;
}

describe('el código', () => {
  it('tiene seis caracteres y ninguno que se confunda al dictarlo', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateTradeCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      expect(isTradeCode(code)).toBe(true);
    }
  });

  it('se acepta escrito de cualquier manera', () => {
    expect(normalizeTradeCode(' abc-2 3x ')).toBe('ABC23X');
    expect(isTradeCode('abc-23x')).toBe(true);
    expect(isTradeCode('ABC10X')).toBe(false);
    expect(isTradeCode('ABC')).toBe(false);
  });
});

describe('abrir un intercambio', () => {
  const open = (itemId: string, state = owning('roja', 'medalla')) =>
    createTradeOffer({ catalog, state, uid: 'ana', itemId, now: NOW });

  it('nace abierto y caduca a los diez minutos', () => {
    const r = open('roja');
    expect(r).toMatchObject({
      ok: true,
      trade: { status: 'open', expiresAt: NOW + TRADE_TTL_MS },
    });
  });

  it('solo con piezas que se tienen y que se pueden intercambiar', () => {
    expect(open('azul')).toEqual({ ok: false, reason: 'not-owned' });
    expect(open('medalla')).toEqual({ ok: false, reason: 'not-tradeable' });
    expect(open('inventada')).toEqual({ ok: false, reason: 'unknown-item' });
  });
});

describe('contestar', () => {
  const offer = createTradeOffer({
    catalog,
    state: owning('roja'),
    uid: 'ana',
    itemId: 'roja',
    now: NOW,
  });
  if (!offer.ok) throw new Error('la oferta de prueba tenía que valer');
  const answer = (
    over: Partial<Parameters<typeof answerTrade>[0]> = {},
  ): ReturnType<typeof answerTrade> =>
    answerTrade({
      trade: offer.trade,
      catalog,
      state: owning('azul'),
      uid: 'luis',
      itemId: 'azul',
      now: NOW + 1000,
      ...over,
    });

  it('con una pieza propia, o con nada si es un regalo', () => {
    expect(answer()).toMatchObject({ ok: true, trade: { status: 'proposed' } });
    expect(answer({ itemId: null })).toMatchObject({ ok: true });
  });

  it('no vale: tarde, a una misma, o por una pieza que ya se tiene', () => {
    expect(answer({ now: NOW + TRADE_TTL_MS + 1 })).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(answer({ uid: 'ana' })).toEqual({ ok: false, reason: 'own-offer' });
    expect(answer({ state: owning('azul', 'roja') })).toEqual({
      ok: false,
      reason: 'already-have',
    });
    expect(answer({ itemId: 'medalla', state: owning('medalla') })).toEqual({
      ok: false,
      reason: 'not-tradeable',
    });
  });

  it('un intercambio ya contestado no admite a un tercero', () => {
    const first = answer();
    if (!first.ok) throw new Error('tenía que valer');
    expect(answer({ trade: first.trade, uid: 'marta' })).toEqual({
      ok: false,
      reason: 'closed',
    });
  });
});

describe('aceptar y echarse atrás', () => {
  it('solo acepta quien abrió el intercambio', () => {
    const trade: PanueloTrade = { ...agreed(), status: 'proposed' };
    expect(
      acceptTrade({ trade, state: owning('azul'), uid: 'luis', now: NOW }),
    ).toEqual({ ok: false, reason: 'not-yours' });
  });

  it('si ya no tiene la pieza que ofreció, no hay trato', () => {
    const trade: PanueloTrade = { ...agreed(), status: 'proposed' };
    expect(
      acceptTrade({ trade, state: EMPTY_PANUELO, uid: 'ana', now: NOW }),
    ).toEqual({ ok: false, reason: 'not-owned' });
  });

  it('se puede cancelar antes de aceptar, no después', () => {
    const proposed: PanueloTrade = { ...agreed(), status: 'proposed' };
    expect(cancelTrade(proposed, 'luis')).toMatchObject({
      ok: true,
      trade: { status: 'cancelled' },
    });
    expect(cancelTrade(proposed, 'marta')).toEqual({
      ok: false,
      reason: 'not-yours',
    });
    expect(cancelTrade(agreed(), 'ana')).toEqual({
      ok: false,
      reason: 'closed',
    });
  });
});

describe('aplicar el intercambio', () => {
  it('cada una se queda con la pieza de la otra, cosida donde estaba la suya', () => {
    const trade = agreed();
    const ana = applyTrade(owning('roja'), trade, 'ana', NOW + 3000);
    const luis = applyTrade(owning('azul'), trade, 'luis', NOW + 3000);
    expect(Object.keys(ana.items)).toEqual(['azul']);
    expect(Object.keys(luis.items)).toEqual(['roja']);
    expect(ana.items.azul.via).toBe('trade');
    expect(ana.layout.azul).toEqual({ u: 0, v: 0.2, rot: 15 });
    expect(ana.gone).toEqual({ roja: NOW + 3000 });
  });

  it('aplicarlo dos veces no cambia nada la segunda', () => {
    const trade = agreed();
    const once = applyTrade(owning('roja'), trade, 'ana', NOW + 3000);
    expect(applyTrade(once, trade, 'ana', NOW + 9000)).toBe(once);
  });

  it('a quien no participa, o sin aceptar, no le toca nada', () => {
    const mine = owning('roja');
    expect(applyTrade(mine, agreed(), 'marta', NOW)).toBe(mine);
    expect(
      applyTrade(mine, { ...agreed(), status: 'proposed' }, 'ana', NOW),
    ).toBe(mine);
  });

  it('un regalo: quien da se queda sin ella y quien recibe no pierde nada', () => {
    const gift: PanueloTrade = {
      ...agreed(),
      answer: { uid: 'luis', itemId: null },
    };
    const ana = applyTrade(owning('roja'), gift, 'ana', NOW);
    const luis = applyTrade(owning('azul'), gift, 'luis', NOW);
    expect(ana.items).toEqual({});
    expect(Object.keys(luis.items).sort()).toEqual(['azul', 'roja']);
  });

  it('lo dado no vuelve cuando el móvil se junta con la nube', () => {
    const trade = agreed();
    const ana = applyTrade(owning('roja'), trade, 'ana', NOW + 3000);
    // La nube todavía cree que Ana tiene la roja.
    const { merged } = mergePanuelo(ana, owning('roja'));
    expect(Object.keys(merged.items)).toEqual(['azul']);
  });
});
