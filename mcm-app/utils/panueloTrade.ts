/**
 * Intercambios de piezas del pañuelo — LA BASE, sin pantalla todavía.
 *
 * La idea (2026-11-13): dos personas, cara a cara, se cambian una pulsera o
 * una chapa, como se hace con las de verdad en un encuentro. Una enseña un
 * código, la otra lo escribe, cada una elige qué da, y se cambian.
 *
 * Aquí está la parte que no depende de nada: las reglas (quién puede ofrecer
 * qué, cuándo caduca, qué pasa con el pañuelo de cada una) como funciones
 * puras, con sus tests. Falta lo que las usa: el servicio que guarda el
 * intercambio en `panueloTrades/{code}` y la pantalla. El diseño entero, los
 * pasos que quedan y las reglas de Firebase que hacen falta están en
 * `docs/funcionalidades/PANUELO.md` («Intercambios»).
 *
 * Cómo va un intercambio:
 *
 *   1. Ana abre una pieza suya intercambiable y pulsa «Intercambiar».
 *      → `createTradeOffer`: nace con estado `open` y un código de 6 letras.
 *   2. Ana le enseña el código (o su QR) a Luis. Luis lo escribe, ve la pieza
 *      de Ana y elige qué da él a cambio (o nada: entonces es un regalo).
 *      → `answerTrade`: pasa a `proposed`.
 *   3. Ana ve lo que ofrece Luis y acepta. → `acceptTrade`: pasa a `accepted`.
 *   4. Cada móvil aplica SU mitad al pañuelo de su dueña o dueño.
 *      → `applyTrade`: sale la pieza que se da, entra la que se recibe, en el
 *        mismo sitio del pañuelo.
 *
 * Que cada móvil aplique su mitad es deliberado: hoy cada persona solo puede
 * escribir en su propio nodo (`users/{uid}`). Es el mismo nivel de confianza
 * que los códigos de las piezas: vale para un juego entre gente que se
 * conoce. El día que haya servidor, el paso 4 lo hace una función y nada de
 * lo de arriba cambia.
 */
import type {
  PanueloCatalog,
  PanueloPlacement,
  PanueloUserState,
} from '@/types/panuelo';
import { isTradeable } from '@/utils/panuelo';
import { nextFreeSlot } from '@/utils/panueloPlacement';

/** Un intercambio abierto dura diez minutos: es para hacerlo en el momento. */
export const TRADE_TTL_MS = 10 * 60 * 1000;
export const TRADE_CODE_LENGTH = 6;
/** Sin 0/O, 1/I/L: el código se dicta de viva voz en un patio con ruido. */
const TRADE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type PanueloTradeStatus = 'open' | 'proposed' | 'accepted' | 'cancelled';

export interface PanueloTradeSide {
  uid: string;
  /** Nombre de pila, para que la otra persona sepa con quién cambia. */
  name?: string;
  /** La pieza que da. `null` solo en la respuesta: no da nada, es un regalo. */
  itemId: string | null;
}

/** Lo que se guarda en `panueloTrades/{code}`. */
export interface PanueloTrade {
  code: string;
  status: PanueloTradeStatus;
  createdAt: number;
  expiresAt: number;
  /** Quien abre el intercambio y enseña el código. */
  offer: PanueloTradeSide & { itemId: string };
  /** Quien escribe el código. */
  answer?: PanueloTradeSide;
}

export type TradeError =
  | 'unknown-item'
  | 'not-owned'
  | 'not-tradeable'
  | 'already-have'
  | 'own-offer'
  | 'not-yours'
  | 'expired'
  | 'closed';

export type TradeResult =
  { ok: true; trade: PanueloTrade } | { ok: false; reason: TradeError };

/** Un código nuevo. `random` se inyecta en los tests. */
export function generateTradeCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < TRADE_CODE_LENGTH; i++) {
    code += TRADE_ALPHABET[Math.floor(random() * TRADE_ALPHABET.length)];
  }
  return code;
}

/** El código tal como se busca: mayúsculas, sin espacios ni guiones. */
export function normalizeTradeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isTradeCode(code: string): boolean {
  const c = normalizeTradeCode(code);
  return (
    c.length === TRADE_CODE_LENGTH &&
    [...c].every((ch) => TRADE_ALPHABET.includes(ch))
  );
}

export function isTradeExpired(trade: PanueloTrade, now: number): boolean {
  return trade.status !== 'accepted' && now > trade.expiresAt;
}

/** ¿Puede esta persona dar esta pieza? */
function canGive(
  catalog: PanueloCatalog,
  state: PanueloUserState,
  itemId: string,
): TradeError | null {
  const item = catalog[itemId];
  if (!item) return 'unknown-item';
  if (!state.items[itemId]) return 'not-owned';
  if (!isTradeable(item)) return 'not-tradeable';
  return null;
}

/** Paso 1: abrir un intercambio ofreciendo una pieza propia. */
export function createTradeOffer(input: {
  catalog: PanueloCatalog;
  state: PanueloUserState;
  uid: string;
  name?: string;
  itemId: string;
  now: number;
  random?: () => number;
}): TradeResult {
  const error = canGive(input.catalog, input.state, input.itemId);
  if (error) return { ok: false, reason: error };
  return {
    ok: true,
    trade: {
      code: generateTradeCode(input.random),
      status: 'open',
      createdAt: input.now,
      expiresAt: input.now + TRADE_TTL_MS,
      offer: { uid: input.uid, name: input.name, itemId: input.itemId },
    },
  };
}

/**
 * Paso 2: quien ha escrito el código dice qué da a cambio (`itemId`), o nada
 * (`null`) si es un regalo. No se puede recibir una pieza que ya se tiene: en
 * el pañuelo cada pieza está una vez.
 */
export function answerTrade(input: {
  trade: PanueloTrade;
  catalog: PanueloCatalog;
  state: PanueloUserState;
  uid: string;
  name?: string;
  itemId: string | null;
  now: number;
}): TradeResult {
  const { trade, state, uid, itemId } = input;
  if (trade.status !== 'open') return { ok: false, reason: 'closed' };
  if (isTradeExpired(trade, input.now)) return { ok: false, reason: 'expired' };
  if (trade.offer.uid === uid) return { ok: false, reason: 'own-offer' };
  if (state.items[trade.offer.itemId]) {
    return { ok: false, reason: 'already-have' };
  }
  if (itemId !== null) {
    const error = canGive(input.catalog, state, itemId);
    if (error) return { ok: false, reason: error };
  }
  return {
    ok: true,
    trade: {
      ...trade,
      status: 'proposed',
      answer: { uid, name: input.name, itemId },
    },
  };
}

/**
 * Paso 3: quien abrió el intercambio acepta lo que le ofrecen. `state` es SU
 * pañuelo: si entre tanto ha conseguido la pieza que iba a recibir, no vale.
 */
export function acceptTrade(input: {
  trade: PanueloTrade;
  state: PanueloUserState;
  uid: string;
  now: number;
}): TradeResult {
  const { trade, state, uid } = input;
  if (trade.status !== 'proposed' || !trade.answer) {
    return { ok: false, reason: 'closed' };
  }
  if (isTradeExpired(trade, input.now)) return { ok: false, reason: 'expired' };
  if (trade.offer.uid !== uid) return { ok: false, reason: 'not-yours' };
  if (!state.items[trade.offer.itemId]) {
    return { ok: false, reason: 'not-owned' };
  }
  const incoming = trade.answer.itemId;
  if (incoming !== null && state.items[incoming]) {
    return { ok: false, reason: 'already-have' };
  }
  return { ok: true, trade: { ...trade, status: 'accepted' } };
}

/** Cualquiera de las dos partes puede echarse atrás antes de aceptar. */
export function cancelTrade(trade: PanueloTrade, uid: string): TradeResult {
  if (trade.status === 'accepted' || trade.status === 'cancelled') {
    return { ok: false, reason: 'closed' };
  }
  if (trade.offer.uid !== uid && trade.answer?.uid !== uid) {
    return { ok: false, reason: 'not-yours' };
  }
  return { ok: true, trade: { ...trade, status: 'cancelled' } };
}

/**
 * Paso 4: la mitad de `uid` en un intercambio aceptado. Sale la pieza que da
 * y entra la que recibe, **cosida donde estaba la otra** (un cambio, no un
 * hueco). Se puede llamar dos veces sin miedo: la segunda no cambia nada.
 */
export function applyTrade(
  state: PanueloUserState,
  trade: PanueloTrade,
  uid: string,
  now: number,
): PanueloUserState {
  if (trade.status !== 'accepted' || !trade.answer) return state;
  const mine =
    trade.offer.uid === uid
      ? { give: trade.offer.itemId, take: trade.answer.itemId }
      : trade.answer.uid === uid
        ? { give: trade.answer.itemId, take: trade.offer.itemId }
        : null;
  if (!mine) return state;
  const alreadyGave = mine.give === null || !state.items[mine.give];
  const alreadyTook = mine.take === null || Boolean(state.items[mine.take]);
  if (alreadyGave && alreadyTook) return state;

  const items = { ...state.items };
  const layout: Record<string, PanueloPlacement> = { ...state.layout };
  let spot: PanueloPlacement | undefined;
  const gone = { ...state.gone };
  if (mine.give !== null) {
    spot = layout[mine.give];
    delete items[mine.give];
    delete layout[mine.give];
    // Queda apuntado que se dio: así la nube no la devuelve al fusionar.
    gone[mine.give] = now;
  }
  if (mine.take !== null && !items[mine.take]) {
    items[mine.take] = { at: now, via: 'trade' };
    layout[mine.take] = spot ?? nextFreeSlot(Object.values(layout));
  }
  return { ...state, items, layout, layoutAt: now, gone };
}
