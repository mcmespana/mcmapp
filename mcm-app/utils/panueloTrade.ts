/**
 * Intercambios de piezas del pañuelo — las reglas (funciones puras).
 *
 * La idea (2026-11-13): dos personas, cara a cara, se cambian una pulsera o
 * una chapa, como se hace con las de verdad en un encuentro. Una enseña un
 * código, la otra lo escribe, cada una elige qué da, y se cambian.
 *
 * Aquí está la parte que no depende de nada: las reglas (quién puede ofrecer
 * qué, cuándo caduca, qué pasa con el pañuelo de cada una) como funciones
 * puras, con sus tests. Las usan el servicio (`services/panueloTradeService.ts`,
 * que guarda el intercambio en `panueloTrades/{code}` con transacciones), el
 * hook `hooks/usePanueloTrade.ts` y la hoja `PanueloTradeSheet`. Cómo funciona
 * entero: `docs/funcionalidades/PANUELO.md` («Intercambios»).
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
  PanueloItemDef,
  PanueloPlacement,
  PanueloUserState,
} from '@/types/panuelo';
import { isTradeable, sortCatalog } from '@/utils/panuelo';
import { nextFreeSlot } from '@/utils/panueloPlacement';

/** Un intercambio abierto dura diez minutos: es para hacerlo en el momento. */
export const TRADE_TTL_MS = 10 * 60 * 1000;
export const TRADE_CODE_LENGTH = 6;
/** Sin 0/O, 1/I/L: el código se dicta de viva voz en un patio con ruido. */
const TRADE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type PanueloTradeStatus = 'open' | 'proposed' | 'accepted' | 'cancelled';
const STATUSES: readonly PanueloTradeStatus[] = [
  'open',
  'proposed',
  'accepted',
  'cancelled',
];

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
  /**
   * Quien abre el intercambio y enseña el código. `have`: las piezas
   * intercambiables que ya tiene (solo esas, no su colección), para que quien
   * contesta no le ofrezca algo que no puede recibir.
   */
  offer: PanueloTradeSide & { itemId: string; have?: string[] };
  /** Quien escribe el código. */
  answer?: PanueloTradeSide;
}

export type TradeError =
  | 'unknown-item'
  | 'not-owned'
  | 'not-tradeable'
  | 'already-have'
  | 'they-have'
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
  const have = tradeableOwned(input.catalog, input.state)
    .map((item) => item.id)
    .filter((id) => id !== input.itemId);
  return {
    ok: true,
    trade: {
      code: generateTradeCode(input.random),
      status: 'open',
      createdAt: input.now,
      expiresAt: input.now + TRADE_TTL_MS,
      // Sin claves `undefined`: Firebase las rechaza.
      offer: {
        uid: input.uid,
        ...(input.name ? { name: input.name } : {}),
        itemId: input.itemId,
        ...(have.length > 0 ? { have } : {}),
      },
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
    if (trade.offer.have?.includes(itemId)) {
      return { ok: false, reason: 'they-have' };
    }
  }
  return {
    ok: true,
    trade: {
      ...trade,
      status: 'proposed',
      answer: { uid, ...(input.name ? { name: input.name } : {}), itemId },
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

/** Qué da y qué recibe `uid` en un intercambio (o `null` si no participa). */
export function tradeHalf(
  trade: PanueloTrade,
  uid: string,
): { give: string | null; take: string | null } | null {
  if (!trade.answer) return null;
  if (trade.offer.uid === uid) {
    return { give: trade.offer.itemId, take: trade.answer.itemId };
  }
  if (trade.answer.uid === uid) {
    return { give: trade.answer.itemId, take: trade.offer.itemId };
  }
  return null;
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
  if (trade.status !== 'accepted') return state;
  const mine = tradeHalf(trade, uid);
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

// ── Lo que llega de fuera, y lo que se enseña ──────────────────────────────

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const ITEM_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const itemId = (x: unknown): string | undefined =>
  typeof x === 'string' && ITEM_ID.test(x) ? x : undefined;
const uidOf = (x: unknown): string | undefined =>
  typeof x === 'string' && x.trim() !== '' && x.length <= 128 ? x : undefined;
const nameOf = (x: unknown): string | undefined => {
  if (typeof x !== 'string') return undefined;
  const s = x.trim().slice(0, 40);
  return s === '' ? undefined : s;
};
const numOf = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined;

/**
 * Un intercambio leído de `panueloTrades/{code}`, saneado, o `null` si no es
 * uno. Lo escribe el móvil de otra persona: no se fía de nada. Un `answer`
 * sin `itemId` es un regalo (Firebase no guarda `null`: la clave desaparece).
 */
export function sanitizeTrade(raw: unknown): PanueloTrade | null {
  if (!isObject(raw) || !isObject(raw.offer)) return null;
  const code = typeof raw.code === 'string' ? raw.code : '';
  if (!/^[A-HJKMNP-Z2-9]{6}$/.test(code)) return null;
  const status = STATUSES.find((s) => s === raw.status);
  const createdAt = numOf(raw.createdAt);
  const expiresAt = numOf(raw.expiresAt);
  const offerUid = uidOf(raw.offer.uid);
  const offerItem = itemId(raw.offer.itemId);
  if (
    !status ||
    createdAt === undefined ||
    expiresAt === undefined ||
    !offerUid ||
    !offerItem
  ) {
    return null;
  }
  const have = (Array.isArray(raw.offer.have) ? raw.offer.have : [])
    .map(itemId)
    .filter((id): id is string => Boolean(id))
    .slice(0, 200);
  const offerName = nameOf(raw.offer.name);
  const trade: PanueloTrade = {
    code,
    status,
    createdAt,
    expiresAt,
    offer: {
      uid: offerUid,
      ...(offerName ? { name: offerName } : {}),
      itemId: offerItem,
      ...(have.length > 0 ? { have } : {}),
    },
  };
  if (isObject(raw.answer)) {
    const uid = uidOf(raw.answer.uid);
    if (uid) {
      const name = nameOf(raw.answer.name);
      trade.answer = {
        uid,
        ...(name ? { name } : {}),
        itemId: itemId(raw.answer.itemId) ?? null,
      };
    }
  }
  // Propuesto o aceptado sin respuesta no es un intercambio que se pueda usar.
  if ((status === 'proposed' || status === 'accepted') && !trade.answer) {
    return null;
  }
  return trade;
}

/** Las piezas propias que se pueden dar, en el orden de la colección. */
export function tradeableOwned(
  catalog: PanueloCatalog,
  state: PanueloUserState,
): PanueloItemDef[] {
  return sortCatalog(catalog).filter(
    (item) => Boolean(state.items[item.id]) && isTradeable(item),
  );
}

export interface TradeChoice {
  item: PanueloItemDef;
  /** Por qué no se puede elegir: quien ofrece ya la tiene. */
  disabled?: 'they-have';
}

/**
 * Lo que puede dar quien contesta: sus intercambiables, con las que la otra
 * persona ya tiene deshabilitadas («Ya la tiene»). La pieza que le ofrecen no
 * sale (no la tiene: si la tuviera, no podría contestar).
 */
export function answerChoices(
  catalog: PanueloCatalog,
  state: PanueloUserState,
  trade: PanueloTrade,
): TradeChoice[] {
  const have = new Set(trade.offer.have ?? []);
  return tradeableOwned(catalog, state)
    .filter((item) => item.id !== trade.offer.itemId)
    .map((item) =>
      have.has(item.id) ? { item, disabled: 'they-have' as const } : { item },
    );
}

/** El nombre de pila: el `displayName` hasta el primer espacio, o nada. */
export function firstName(
  displayName: string | null | undefined,
): string | undefined {
  const first = (displayName ?? '').trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : undefined;
}
