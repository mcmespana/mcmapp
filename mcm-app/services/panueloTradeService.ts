/**
 * Intercambios del pañuelo en la Realtime Database: `panueloTrades/{code}`.
 *
 * Las reglas del juego son las funciones puras de `utils/panueloTrade.ts`;
 * aquí solo se guardan y se leen. Tres cosas que importan:
 *
 * - **Toda escritura es una transacción sobre el nodo ENTERO**
 *   (`runTransaction`), aplicando la función pura al valor que hay en el
 *   servidor en ese momento. Dos personas contestando al mismo código a la
 *   vez: una gana, la otra recibe `closed`. Y las reglas (`database.rules.json`)
 *   evalúan siempre el nodo completo (un `update()` parcial no reevalúa el
 *   `.validate` de un ancestro: `docs/desarrollo/FIREBASE_REGLAS.md` §3).
 * - **`applyLocally: false`**: nadie ve en su `onValue` un estado que el
 *   servidor todavía no ha confirmado. Si no, un «aceptado» provisional haría
 *   que un móvil aplicara su mitad de un intercambio que luego no fue.
 * - **Nada se queda colgado**: cada operación tiene 8 s; pasados, devuelve
 *   `offline`. Si la transacción acaba llegando después, el hook lo ve por su
 *   suscripción (el estado manda, no el resultado de la llamada).
 *
 * Si las reglas de `panueloTrades` no están desplegadas en el proyecto, el
 * servidor contesta «permiso denegado»: se devuelve `rules` (la hoja lo dice
 * con palabras, no con el error crudo) y se reporta una vez a Sentry.
 *
 * Contrato: `docs/contratos/PANUELO_CONTRATO.md` §4. Plan:
 * `docs/planes/PLAN_PANUELO_INTERCAMBIOS.md`.
 */
import {
  get,
  getDatabase,
  onValue,
  ref,
  remove,
  runTransaction,
} from 'firebase/database';

import type { PanueloCatalog, PanueloUserState } from '@/types/panuelo';
import { getFirebaseApp } from '@/utils/firebaseApp';
import {
  isPermissionDenied,
  reportIfPermissionDenied,
} from '@/utils/firebaseErrors';
import { logger } from '@/utils/logger';
import {
  acceptTrade,
  answerTrade,
  cancelTrade,
  createTradeOffer,
  isTradeCode,
  normalizeTradeCode,
  sanitizeTrade,
  type PanueloTrade,
  type TradeError,
} from '@/utils/panueloTrade';

const ROOT = 'panueloTrades';
/** Lo que se espera a Firebase antes de decir «sin conexión». */
export const TRADE_TIMEOUT_MS = 8000;
/** Un intercambio aceptado se guarda un día para que la otra parte se
 *  recupere si cerró la app justo al aceptar. Las reglas usan el mismo. */
export const TRADE_KEEP_MS = 24 * 60 * 60 * 1000;
/** Códigos a probar si el elegido está ocupado. */
const OPEN_ATTEMPTS = 3;

/** Todo lo que puede salir mal, además de las reglas del juego. */
export type TradeFailure =
  | TradeError
  /** No contestó en `TRADE_TIMEOUT_MS`, o el SDK dice que no hay red. */
  | 'offline'
  /** No hay ningún intercambio con ese código (o el código está mal). */
  | 'not-found'
  /** El servidor denegó: las reglas de `panueloTrades` no están desplegadas. */
  | 'rules'
  /** Tres códigos ocupados seguidos (no debería pasar nunca). */
  | 'busy'
  /** Cualquier otro error del SDK. */
  | 'error';

export type TradeServiceResult =
  { ok: true; trade: PanueloTrade } | { ok: false; reason: TradeFailure };

const tradePath = (code: string) => `${ROOT}/${code}`;
const tradeRef = (code: string) =>
  ref(getDatabase(getFirebaseApp()), tradePath(code));

class TradeTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TradeTimeout()), TRADE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** De error del SDK (o del temporizador) a razón con nombre. */
function failureOf(err: unknown, op: 'read' | 'write', code: string) {
  if (err instanceof TradeTimeout) return 'offline' as const;
  if (isPermissionDenied(err)) {
    reportIfPermissionDenied(err, op, tradePath(code));
    return 'rules' as const;
  }
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (message.includes('disconnect') || message.includes('network')) {
    return 'offline' as const;
  }
  logger.error('[panueloTrade] fallo de Firebase:', err);
  return 'error' as const;
}

/** Lee un intercambio una vez, saneado. */
export async function fetchTrade(rawCode: string): Promise<TradeServiceResult> {
  const code = normalizeTradeCode(rawCode);
  if (!isTradeCode(code)) return { ok: false, reason: 'not-found' };
  try {
    const snap = await withTimeout(get(tradeRef(code)));
    const trade = sanitizeTrade(snap.exists() ? snap.val() : null);
    return trade ? { ok: true, trade } : { ok: false, reason: 'not-found' };
  } catch (err) {
    return { ok: false, reason: failureOf(err, 'read', code) };
  }
}

/**
 * Escucha un intercambio en vivo. `cb(null)` si no existe (o lo que hay no es
 * un intercambio). Devuelve la función para dejar de escuchar.
 */
export function subscribeTrade(
  rawCode: string,
  cb: (trade: PanueloTrade | null) => void,
  onError?: (reason: TradeFailure) => void,
): () => void {
  const code = normalizeTradeCode(rawCode);
  if (!isTradeCode(code)) {
    cb(null);
    return () => {};
  }
  return onValue(
    tradeRef(code),
    (snap) => cb(sanitizeTrade(snap.exists() ? snap.val() : null)),
    (err) => onError?.(failureOf(err, 'read', code)),
  );
}

/**
 * Corre `step` sobre el valor actual del servidor. `step` devuelve el
 * intercambio nuevo, o una razón para no escribir nada.
 *
 * Primera vuelta con `null`: el SDK aún no tiene el valor en caché. Se
 * devuelve `null` sin más; el servidor ve que la base no coincide y vuelve a
 * llamar con el valor de verdad. Por eso se comprueba antes con `get()` que el
 * nodo existe: si de verdad no existe, no se llega a escribir.
 */
async function transact(
  code: string,
  step: (current: PanueloTrade) => TradeServiceResult,
): Promise<TradeServiceResult> {
  const found = await fetchTrade(code);
  if (!found.ok) return found;
  // Un objeto y no un `let`: TypeScript no sigue lo que cambia un callback.
  const seen: { failure: TradeFailure | null } = { failure: null };
  try {
    const result = await withTimeout(
      runTransaction(
        tradeRef(code),
        (current: unknown) => {
          seen.failure = null;
          if (current === null || current === undefined) return null;
          const trade = sanitizeTrade(current);
          if (!trade) {
            seen.failure = 'not-found';
            return undefined;
          }
          const next = step(trade);
          if (!next.ok) {
            seen.failure = next.reason;
            return undefined;
          }
          return next.trade;
        },
        { applyLocally: false },
      ),
    );
    if (seen.failure) return { ok: false, reason: seen.failure };
    const trade = sanitizeTrade(
      result.snapshot.exists() ? result.snapshot.val() : null,
    );
    if (!result.committed || !trade) return { ok: false, reason: 'not-found' };
    return { ok: true, trade };
  } catch (err) {
    return { ok: false, reason: failureOf(err, 'write', code) };
  }
}

/**
 * Abre un intercambio con un código nuevo. Si el código elegido ya existe y
 * sigue vivo (o lleva menos de un día caducado), prueba con otro.
 */
export async function openTrade(input: {
  catalog: PanueloCatalog;
  state: PanueloUserState;
  uid: string;
  name?: string;
  itemId: string;
  now: number;
  random?: () => number;
}): Promise<TradeServiceResult> {
  for (let attempt = 0; attempt < OPEN_ATTEMPTS; attempt++) {
    const created = createTradeOffer(input);
    if (!created.ok) return created;
    const offer = created.trade;
    const seen = { taken: false };
    try {
      const result = await withTimeout(
        runTransaction(
          tradeRef(offer.code),
          (current: unknown) => {
            seen.taken = false;
            if (current === null || current === undefined) return offer;
            const existing = sanitizeTrade(current);
            // Un código abandonado hace más de un día se puede reutilizar.
            if (existing && existing.expiresAt + TRADE_KEEP_MS >= input.now) {
              seen.taken = true;
              return undefined;
            }
            return offer;
          },
          { applyLocally: false },
        ),
      );
      if (seen.taken || !result.committed) continue;
      return { ok: true, trade: offer };
    } catch (err) {
      return { ok: false, reason: failureOf(err, 'write', offer.code) };
    }
  }
  return { ok: false, reason: 'busy' };
}

/** Quien escribe el código dice qué da (o nada: un regalo). */
export function answerTradeRemote(input: {
  code: string;
  catalog: PanueloCatalog;
  state: PanueloUserState;
  uid: string;
  name?: string;
  itemId: string | null;
  now: number;
}): Promise<TradeServiceResult> {
  const { code, ...rest } = input;
  return transact(normalizeTradeCode(code), (trade) =>
    answerTrade({ ...rest, trade }),
  );
}

/** Quien abrió el intercambio acepta lo que le ofrecen. */
export function acceptTradeRemote(input: {
  code: string;
  state: PanueloUserState;
  uid: string;
  now: number;
}): Promise<TradeServiceResult> {
  const { code, ...rest } = input;
  return transact(normalizeTradeCode(code), (trade) =>
    acceptTrade({ ...rest, trade }),
  );
}

/** Cualquiera de las dos partes se echa atrás (antes de aceptar). */
export function cancelTradeRemote(input: {
  code: string;
  uid: string;
}): Promise<TradeServiceResult> {
  return transact(normalizeTradeCode(input.code), (trade) =>
    cancelTrade(trade, input.uid),
  );
}

/** Borra un intercambio (lo hace quien lo abrió, al limpiar). */
export async function removeTrade(rawCode: string): Promise<boolean> {
  const code = normalizeTradeCode(rawCode);
  if (!isTradeCode(code)) return false;
  try {
    await withTimeout(remove(tradeRef(code)));
    return true;
  } catch (err) {
    failureOf(err, 'write', code);
    return false;
  }
}

/**
 * Cuánto va adelantado o atrasado el reloj del móvil respecto al del servidor
 * (`.info/serverTimeOffset`). La caducidad se compara con
 * `Date.now() + offset`: un móvil con la hora mal no ve caducado un
 * intercambio vivo. `0` si no se puede saber.
 */
export async function getServerOffset(): Promise<number> {
  try {
    const snap = await withTimeout(
      get(ref(getDatabase(getFirebaseApp()), '.info/serverTimeOffset')),
    );
    const value: unknown = snap.val();
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
