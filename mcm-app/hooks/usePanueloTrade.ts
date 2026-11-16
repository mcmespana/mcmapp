// El intercambio del pañuelo en curso en ESTE móvil: en qué paso está, qué
// dice la otra parte (en vivo), y qué hacer si la app se cerró a mitad.
//
// La pantalla solo lo monta y le pasa lo que hace falta de `usePanuelo`; la
// hoja (`PanueloTradeSheet`) pinta `phase` y llama a las acciones. Reglas del
// juego: `utils/panueloTrade.ts`. Firebase: `services/panueloTradeService.ts`.
// Plan: `docs/planes/PLAN_PANUELO_INTERCAMBIOS.md` (§2 flujo, §2.3 mensajes,
// §2.4 recuperación, §4.4 limpieza).
//
// Lo que importa:
// - **Un intercambio a la vez.** Mientras hay uno abierto, «Intercambiar» lleva
//   a ese: así nadie compromete la misma pieza dos veces.
// - **El estado del servidor manda.** Cada móvil aplica su mitad cuando VE
//   `accepted` en su suscripción (o al recuperarse), no cuando le contesta su
//   propia llamada: si la transacción de Ana llega tarde, Ana lo aplica igual.
//   `applyTradeHalf` es idempotente y además se llama una vez por código.
// - **Recuperación**: el código en curso se guarda en `@panuelo_trade_pending`.
//   Al abrir el pañuelo con sesión: si está `accepted`, se aplica lo que falte;
//   si sigue vivo, se reabre la hoja; si no, se olvida.
// - **Limpieza** (decisión del usuario, 2026-11-16): cada móvil borra al abrir
//   el pañuelo los intercambios que abrió y ya caducaron
//   (`@panuelo_trade_mine`); los aceptados, pasado un día.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/contexts/AuthContext';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import {
  TRADE_KEEP_MS,
  acceptTradeRemote,
  answerTradeRemote,
  cancelTradeRemote,
  fetchTrade,
  getServerOffset,
  openTrade,
  removeTrade,
  subscribeTrade,
  type TradeFailure,
} from '@/services/panueloTradeService';
import type { PanueloCatalog, PanueloUserState } from '@/types/panuelo';
import { trackEvent } from '@/utils/analytics';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  firstName,
  isTradeCode,
  isTradeExpired,
  normalizeTradeCode,
  tradeHalf,
  type PanueloTrade,
} from '@/utils/panueloTrade';

export const TRADE_PENDING_KEY = '@panuelo_trade_pending';
export const TRADE_MINE_KEY = '@panuelo_trade_mine';
/** Cada cuánto se mira el reloj (cuenta atrás en minutos, no un cronómetro). */
const TICK_MS = 10_000;

export type TradeRole = 'offer' | 'answer';

/**
 * - `signin`: sin sesión; la hoja enseña cómo entrar.
 * - Ana: `choosing` (qué ofrece) → `offering` (enseña el código) →
 *   `reviewing` (le han propuesto algo).
 * - Luis: `joining` (escribe el código) → `answering` (elige qué da) →
 *   `waiting` (a que Ana acepte).
 * - `done`: aceptado y aplicado. `error`: fin con un mensaje (cancelado,
 *   caducado, reglas sin desplegar…).
 */
export type TradePhase =
  | 'idle'
  | 'signin'
  | 'choosing'
  | 'offering'
  | 'reviewing'
  | 'joining'
  | 'answering'
  | 'waiting'
  | 'done'
  | 'error';

/** Lo que se dice en cada caso (PLAN_PANUELO_INTERCAMBIOS §2.3). */
export type TradeMessageKey =
  | TradeFailure
  | 'no-session'
  | 'bad-code'
  | 'expired-mine'
  | 'already-have-accept'
  | 'cancelled-by-offer'
  | 'cancelled-by-answer'
  | 'gone';

/**
 * El texto de cada mensaje. `other`: el nombre de la otra persona (si se
 * sabe); `item`: el nombre de la pieza de la que se habla.
 */
export function tradeMessage(
  key: TradeMessageKey,
  ctx: { other?: string; item?: string } = {},
): string {
  const Other = ctx.other ?? 'La otra persona';
  const other = ctx.other ?? 'la otra persona';
  const item = ctx.item ? `«${ctx.item}»` : 'esa pieza';
  switch (key) {
    case 'no-session':
      return 'Para intercambiar tenéis que haber entrado los dos con vuestra cuenta.';
    case 'offline':
      return 'Sin conexión. Intercambiar necesita internet en los dos móviles.';
    case 'bad-code':
      return 'Son 6 letras y números.';
    case 'not-found':
      return 'No hay ningún intercambio con ese código.';
    case 'expired':
      return 'Este intercambio ha caducado. Pídele que abra otro.';
    case 'expired-mine':
      return 'Ha caducado. Puedes abrir otro.';
    case 'own-offer':
      return 'Ese código es tuyo: enséñaselo a la otra persona.';
    case 'already-have':
      return `Ya tienes ${item}. En el pañuelo cada pieza va una vez.`;
    case 'already-have-accept':
      return `Ya tienes ${item}. Pídele a ${other} que te ofrezca otra.`;
    case 'they-have':
      return `${Other} ya tiene esa pieza. Elige otra.`;
    case 'closed':
      return 'Otra persona ya ha contestado a este código.';
    case 'not-owned':
      return `Ya no tienes ${item}: el intercambio se ha cancelado.`;
    case 'not-tradeable':
      return 'Esa pieza no se puede intercambiar.';
    case 'unknown-item':
      return 'Tu app todavía no conoce esa pieza. Abre el pañuelo con conexión y vuelve a probar.';
    case 'not-yours':
      return 'Este intercambio no es tuyo.';
    case 'cancelled-by-offer':
      return `${Other} ha cancelado el intercambio.`;
    case 'cancelled-by-answer':
      return `${Other} se ha echado atrás.`;
    case 'gone':
      return 'Este intercambio ya no existe.';
    case 'rules':
      return 'Los intercambios todavía no están activados en el servidor. Avisa a quien lleva la app.';
    case 'busy':
    case 'error':
      return 'No se ha podido. Vuelve a probar en un momento.';
  }
}

interface Pending {
  code: string;
  role: TradeRole;
}
interface Mine {
  code: string;
  expiresAt: number;
}

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  const op =
    value === null
      ? AsyncStorage.removeItem(key)
      : AsyncStorage.setItem(key, JSON.stringify(value));
  op.catch((err) => logger.warn('[Pañuelo] intercambio sin guardar:', err));
}
function parsePending(raw: unknown): Pending | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { code, role } = raw as Record<string, unknown>;
  if (typeof code !== 'string' || !isTradeCode(code)) return null;
  if (role !== 'offer' && role !== 'answer') return null;
  return { code: normalizeTradeCode(code), role };
}
function parseMine(raw: unknown): Mine[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is Mine =>
      typeof m === 'object' &&
      m !== null &&
      typeof m.code === 'string' &&
      isTradeCode(m.code) &&
      typeof m.expiresAt === 'number',
  );
}

export interface PanueloTradeInput {
  /** `usePanuelo().ready`: ya se leyó lo guardado en el móvil. */
  ready: boolean;
  catalog: PanueloCatalog;
  state: PanueloUserState;
  applyTradeHalf: (trade: PanueloTrade) => boolean;
}

export interface PanueloTradeValue {
  /** La hoja está a la vista. */
  sheetOpen: boolean;
  phase: TradePhase;
  role: TradeRole | null;
  trade: PanueloTrade | null;
  /** Mensaje para la persona (de §2.3), o nada. */
  message: string | null;
  /** Hay una llamada en curso: los botones esperan. */
  busy: boolean;
  /** El móvil dice que no tiene red. */
  offline: boolean;
  /** Hora del servidor (aprox.) en el último tic: para la cuenta atrás. */
  now: number;
  /** Lo recibido al cerrarse el trato (`null` si nada o si fue un regalo dado). */
  received: string | null;
  /** El código con el que se abrió la hoja desde un enlace, para el campo. */
  prefill: string;
  /** Abre la hoja: retoma el intercambio en curso si lo hay. */
  start: (
    intent:
      { mode: 'offer'; itemId?: string } | { mode: 'join'; code?: string },
  ) => void;
  offer: (itemId: string) => Promise<void>;
  join: (code: string) => Promise<void>;
  answer: (itemId: string | null) => Promise<void>;
  accept: () => Promise<void>;
  cancel: () => Promise<void>;
  /** Cierra la hoja. Si hay un intercambio vivo, sigue escuchándolo. */
  close: () => void;
  /** Tras un error o un trato cerrado: empezar otro desde el principio. */
  restart: () => void;
}

const ACTIVE: readonly TradePhase[] = [
  'offering',
  'reviewing',
  'answering',
  'waiting',
];

export function usePanueloTrade(input: PanueloTradeInput): PanueloTradeValue {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const name = firstName(user?.displayName);
  const isConnected = useNetworkStatus();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [phase, setPhase] = useState<TradePhase>('idle');
  const [intent, setIntent] = useState<'offer' | 'join'>('offer');
  const [role, setRole] = useState<TradeRole | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [trade, setTrade] = useState<PanueloTrade | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [received, setReceived] = useState<string | null>(null);
  const [prefill, setPrefill] = useState('');

  // Lo último de `usePanuelo` y del propio hook, para los callbacks que
  // llegan de Firebase (que no pueden cerrar sobre un render viejo).
  const inputRef = useRef(input);
  const uidRef = useRef(uid);
  const roleRef = useRef<TradeRole | null>(null);
  const codeRef = useRef<string | null>(null);
  const phaseRef = useRef<TradePhase>('idle');
  const tradeRef = useRef<PanueloTrade | null>(null);
  useEffect(() => {
    inputRef.current = input;
    uidRef.current = uid;
  });
  const offsetRef = useRef(0);
  /** Códigos ya aplicados en esta sesión: la mitad propia, una sola vez. */
  const appliedRef = useRef(new Set<string>());
  /** Código que este móvil acaba de cancelar: su `cancelled` no es noticia. */
  const cancelledByMeRef = useRef<string | null>(null);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const goTo = useCallback((next: TradePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const follow = useCallback(
    (nextCode: string | null, nextRole: TradeRole | null) => {
      codeRef.current = nextCode;
      roleRef.current = nextRole;
      setCode(nextCode);
      setRole(nextRole);
    },
    [],
  );
  const showTrade = useCallback((next: PanueloTrade | null) => {
    tradeRef.current = next;
    setTrade(next);
  }, []);

  const savePending = useCallback((pending: Pending | null) => {
    writeJson(TRADE_PENDING_KEY, pending);
  }, []);

  /** Vuelve a cero (sin intercambio seguido). No toca lo guardado. */
  const reset = useCallback(() => {
    follow(null, null);
    showTrade(null);
    setMessage(null);
    setBusy(false);
    setReceived(null);
    setPrefill('');
    goTo('idle');
    setSheetOpen(false);
  }, [follow, showTrade, goTo]);

  /** Nombre de la otra persona y de las piezas, para los mensajes. */
  const names = useCallback((t: PanueloTrade | null) => {
    const r = roleRef.current;
    const catalog = inputRef.current.catalog;
    return {
      other: r === 'offer' ? t?.answer?.name : t?.offer.name,
      offered: t ? catalog[t.offer.itemId]?.name : undefined,
      answered: t?.answer?.itemId ? catalog[t.answer.itemId]?.name : undefined,
    };
  }, []);

  /** Un trato cerrado: la mitad propia, una vez, y se cuenta. */
  const settle = useCallback(
    (t: PanueloTrade) => {
      const me = uidRef.current;
      if (!me || appliedRef.current.has(t.code)) return;
      const half = tradeHalf(t, me);
      if (!half) return;
      appliedRef.current.add(t.code);
      inputRef.current.applyTradeHalf(t);
      savePending(null);
      setReceived(half.take);
      setMessage(null);
      setBusy(false);
      goTo('done');
      setSheetOpen(true);
      h.formSuccess();
    },
    [goTo, savePending],
  );

  /** Lo que llega en vivo del intercambio que se sigue. */
  const onTrade = useCallback(
    (next: PanueloTrade | null) => {
      const r = roleRef.current;
      const me = uidRef.current;
      const current = phaseRef.current;
      if (!r || !me) return;
      if (!next) {
        if (ACTIVE.includes(current)) {
          savePending(null);
          setMessage(tradeMessage('gone'));
          goTo('error');
          setSheetOpen(true);
        }
        return;
      }
      showTrade(next);
      if (next.status === 'accepted') {
        settle(next);
        return;
      }
      if (next.status === 'cancelled') {
        if (cancelledByMeRef.current === next.code) return;
        if (!ACTIVE.includes(current)) return;
        savePending(null);
        const n = names(next);
        setMessage(
          tradeMessage(
            r === 'offer' ? 'cancelled-by-answer' : 'cancelled-by-offer',
            { other: n.other },
          ),
        );
        goTo('error');
        setSheetOpen(true);
        return;
      }
      if (next.status === 'proposed') {
        if (r === 'offer' && current === 'offering') {
          goTo('reviewing');
          setSheetOpen(true);
          h.select();
        } else if (r === 'answer' && next.answer?.uid !== me) {
          if (current === 'answering') {
            setMessage(tradeMessage('closed'));
            goTo('error');
          }
        }
      }
    },
    [goTo, names, savePending, settle, showTrade],
  );

  // La suscripción al intercambio que se sigue.
  useEffect(() => {
    if (!code || !uid) return;
    return subscribeTrade(code, onTrade, (reason) => {
      setMessage(tradeMessage(reason));
    });
  }, [code, uid, onTrade]);

  // El reloj: hora del servidor cada `TICK_MS` mientras se sigue un código.
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNow(serverNow()), TICK_MS);
    return () => clearInterval(id);
  }, [code, serverNow]);

  // Al abrir el pañuelo con sesión: hora del servidor, recuperación y limpieza.
  useEffect(() => {
    if (!uid || !input.ready) return;
    let alive = true;
    (async () => {
      offsetRef.current = await getServerOffset();
      if (!alive) return;
      setNow(serverNow());

      // §2.4 — lo que quedó a medias.
      const pending = parsePending(await readJson(TRADE_PENDING_KEY));
      if (pending && alive && !codeRef.current) {
        const found = await fetchTrade(pending.code);
        if (!alive) return;
        if (!found.ok) {
          // Sin red no se sabe: se intenta la próxima vez.
          if (found.reason !== 'offline') savePending(null);
        } else {
          const t = found.trade;
          const half = tradeHalf(t, uid);
          const mine =
            pending.role === 'offer' ? t.offer.uid === uid : Boolean(half);
          if (!mine) {
            savePending(null);
          } else if (t.status === 'accepted') {
            roleRef.current = pending.role;
            settle(t);
            // La pieza se presenta en el visor; la hoja no hace falta.
            setSheetOpen(false);
            goTo('idle');
          } else if (
            (t.status === 'open' || t.status === 'proposed') &&
            !isTradeExpired(t, serverNow())
          ) {
            follow(t.code, pending.role);
            showTrade(t);
            goTo(
              pending.role === 'offer'
                ? t.status === 'open'
                  ? 'offering'
                  : 'reviewing'
                : 'waiting',
            );
            setSheetOpen(true);
          } else {
            savePending(null);
          }
        }
      }

      // §4.4 — los que abrió este móvil y ya caducaron.
      const mine = parseMine(await readJson(TRADE_MINE_KEY));
      if (!alive || mine.length === 0) return;
      const t = serverNow();
      const keep: Mine[] = [];
      for (const m of mine) {
        if (m.code === codeRef.current || t <= m.expiresAt) {
          keep.push(m);
          continue;
        }
        if (t <= m.expiresAt + TRADE_KEEP_MS) {
          const found = await fetchTrade(m.code);
          if (found.ok && found.trade.status === 'accepted') {
            keep.push(m); // la otra parte puede estar recuperándose
            continue;
          }
          if (!found.ok && found.reason !== 'not-found') {
            keep.push(m); // sin red o sin reglas: otro día
            continue;
          }
        }
        if (!(await removeTrade(m.code))) keep.push(m);
      }
      writeJson(TRADE_MINE_KEY, keep.length > 0 ? keep : null);
    })();
    return () => {
      alive = false;
    };
  }, [
    uid,
    input.ready,
    follow,
    goTo,
    savePending,
    serverNow,
    settle,
    showTrade,
  ]);

  const hasLive = useCallback(
    () => Boolean(codeRef.current) && ACTIVE.includes(phaseRef.current),
    [],
  );

  const start = useCallback<PanueloTradeValue['start']>(
    (want) => {
      if (hasLive()) {
        setSheetOpen(true);
        return;
      }
      reset();
      setIntent(want.mode);
      setSheetOpen(true);
      if (!uidRef.current) {
        goTo('signin');
        return;
      }
      if (want.mode === 'offer') {
        goTo('choosing');
      } else {
        setPrefill(want.code ? normalizeTradeCode(want.code) : '');
        goTo('joining');
      }
    },
    [goTo, hasLive, reset],
  );

  const offer = useCallback(
    async (itemId: string) => {
      const me = uidRef.current;
      if (!me) {
        goTo('signin');
        setSheetOpen(true);
        return;
      }
      if (hasLive()) {
        setSheetOpen(true);
        return;
      }
      setBusy(true);
      setMessage(null);
      const { catalog, state } = inputRef.current;
      const t = serverNow();
      const r = await openTrade({
        catalog,
        state,
        uid: me,
        name,
        itemId,
        now: t,
      });
      setBusy(false);
      if (!r.ok) {
        setMessage(tradeMessage(r.reason, { item: catalog[itemId]?.name }));
        goTo(r.reason === 'rules' ? 'error' : 'choosing');
        setSheetOpen(true);
        return;
      }
      setNow(t);
      follow(r.trade.code, 'offer');
      showTrade(r.trade);
      goTo('offering');
      setSheetOpen(true);
      savePending({ code: r.trade.code, role: 'offer' });
      const mine = parseMine(await readJson(TRADE_MINE_KEY));
      writeJson(TRADE_MINE_KEY, [
        ...mine,
        { code: r.trade.code, expiresAt: r.trade.expiresAt },
      ]);
      trackEvent('panuelo_intercambio', { paso: 'abierto', regalo: false });
    },
    [follow, goTo, hasLive, name, savePending, serverNow, showTrade],
  );

  const join = useCallback(
    async (raw: string) => {
      const me = uidRef.current;
      if (!me) {
        goTo('signin');
        return;
      }
      const wanted = normalizeTradeCode(raw);
      if (!isTradeCode(wanted)) {
        setMessage(tradeMessage('bad-code'));
        return;
      }
      setBusy(true);
      setMessage(null);
      const found = await fetchTrade(wanted);
      setBusy(false);
      if (!found.ok) {
        setMessage(tradeMessage(found.reason));
        return;
      }
      const t = found.trade;
      const { catalog, state } = inputRef.current;
      const item = catalog[t.offer.itemId]?.name;
      const at = serverNow();
      setNow(at);
      if (t.status === 'proposed' && t.answer?.uid === me) {
        // Su propia propuesta (volvió a escribir el código): a esperar.
        follow(t.code, 'answer');
        showTrade(t);
        savePending({ code: t.code, role: 'answer' });
        goTo('waiting');
        return;
      }
      const problem =
        t.offer.uid === me
          ? 'own-offer'
          : t.status === 'accepted' || t.status === 'cancelled'
            ? t.answer?.uid === me
              ? 'gone'
              : 'closed'
            : isTradeExpired(t, at)
              ? 'expired'
              : t.status !== 'open'
                ? 'closed'
                : !catalog[t.offer.itemId]
                  ? 'unknown-item'
                  : state.items[t.offer.itemId]
                    ? 'already-have'
                    : null;
      if (problem) {
        setMessage(tradeMessage(problem, { item }));
        return;
      }
      follow(t.code, 'answer');
      showTrade(t);
      goTo('answering');
    },
    [follow, goTo, savePending, serverNow, showTrade],
  );

  const answer = useCallback(
    async (itemId: string | null) => {
      const me = uidRef.current;
      const c = codeRef.current;
      if (!me || !c) return;
      setBusy(true);
      setMessage(null);
      const { catalog, state } = inputRef.current;
      const r = await answerTradeRemote({
        code: c,
        catalog,
        state,
        uid: me,
        name,
        itemId,
        now: serverNow(),
      });
      setBusy(false);
      if (!r.ok) {
        const n = names(tradeRef.current);
        setMessage(
          tradeMessage(r.reason, {
            other: n.other,
            item: r.reason === 'already-have' ? n.offered : undefined,
          }),
        );
        if (r.reason === 'closed' || r.reason === 'expired') goTo('error');
        return;
      }
      showTrade(r.trade);
      savePending({ code: c, role: 'answer' });
      // Si la suscripción ya trajo `accepted`, no se pisa el `done`.
      if (phaseRef.current === 'answering') goTo('waiting');
      trackEvent('panuelo_intercambio', {
        paso: 'propuesto',
        regalo: itemId === null,
      });
    },
    [goTo, name, names, savePending, serverNow, showTrade],
  );

  const accept = useCallback(async () => {
    const me = uidRef.current;
    const c = codeRef.current;
    if (!me || !c) return;
    setBusy(true);
    setMessage(null);
    const r = await acceptTradeRemote({
      code: c,
      state: inputRef.current.state,
      uid: me,
      now: serverNow(),
    });
    setBusy(false);
    const n = names(tradeRef.current);
    if (r.ok) {
      trackEvent('panuelo_intercambio', {
        paso: 'aceptado',
        regalo: r.trade.answer?.itemId == null,
      });
      settle(r.trade);
      return;
    }
    if (r.reason === 'not-owned') {
      // Ya no tiene lo que ofreció: no hay trato. Se cancela solo.
      cancelledByMeRef.current = c;
      await cancelTradeRemote({ code: c, uid: me });
      savePending(null);
      setMessage(tradeMessage('not-owned', { item: n.offered }));
      goTo('error');
      return;
    }
    if (r.reason === 'already-have') {
      setMessage(
        tradeMessage('already-have-accept', {
          other: n.other,
          item: n.answered,
        }),
      );
      return;
    }
    if (r.reason === 'expired') {
      setMessage(tradeMessage('expired-mine'));
      goTo('error');
      return;
    }
    setMessage(tradeMessage(r.reason, { other: n.other }));
  }, [goTo, names, savePending, serverNow, settle]);

  const cancel = useCallback(async () => {
    const me = uidRef.current;
    const c = codeRef.current;
    // Antes de proponer, Luis no ha escrito nada: basta con irse.
    if (!me || !c || phaseRef.current === 'answering') {
      reset();
      return;
    }
    setBusy(true);
    cancelledByMeRef.current = c;
    const r = await cancelTradeRemote({ code: c, uid: me });
    setBusy(false);
    if (!r.ok && r.reason !== 'closed' && r.reason !== 'not-found') {
      cancelledByMeRef.current = null;
      setMessage(tradeMessage(r.reason));
      return;
    }
    // `closed` puede ser que la otra parte aceptó justo antes: entonces la
    // suscripción ya lo está aplicando y no se cierra nada.
    if (tradeRef.current?.status === 'accepted') return;
    savePending(null);
    if (r.ok) {
      trackEvent('panuelo_intercambio', {
        paso: 'cancelado',
        regalo: r.trade.answer?.itemId === null,
      });
    }
    reset();
  }, [reset, savePending]);

  const close = useCallback(() => {
    const t = tradeRef.current;
    const isExpired = t !== null && isTradeExpired(t, serverNow());
    if (hasLive() && phaseRef.current !== 'answering' && !isExpired) {
      // Sigue vivo: se escucha por debajo y la hoja vuelve sola si pasa algo.
      setSheetOpen(false);
      return;
    }
    // Lo de Ana caducado ya no sirve. Un `proposed` de Luis caducado en su
    // reloj se queda apuntado: si Ana aceptó en el último segundo, la
    // recuperación lo aplica la próxima vez.
    if (isExpired && roleRef.current === 'offer') savePending(null);
    reset();
  }, [hasLive, reset, savePending, serverNow]);

  const restart = useCallback(() => {
    const mode = roleRef.current === 'answer' ? 'join' : intent;
    if (roleRef.current === 'offer') savePending(null);
    reset();
    start({ mode });
  }, [intent, reset, savePending, start]);

  // Caducado: se deriva del reloj, no se escribe en un efecto.
  const expired =
    trade !== null &&
    now > 0 &&
    (phase === 'offering' ||
      phase === 'reviewing' ||
      phase === 'answering' ||
      phase === 'waiting') &&
    isTradeExpired(trade, now);

  const view = useMemo(() => {
    if (phase === 'signin' && uid) {
      return { phase: intent === 'offer' ? 'choosing' : 'joining', message };
    }
    if (phase === 'signin') {
      return { phase, message: tradeMessage('no-session') };
    }
    if (expired) {
      return {
        phase: 'error' as const,
        message: tradeMessage(role === 'offer' ? 'expired-mine' : 'expired'),
      };
    }
    return { phase, message };
  }, [phase, uid, intent, message, expired, role]);

  return {
    sheetOpen,
    phase: view.phase as TradePhase,
    role,
    trade,
    message: view.message,
    busy,
    offline: isConnected === false,
    now,
    received,
    prefill,
    start,
    offer,
    join,
    answer,
    accept,
    cancel,
    close,
    restart,
  };
}
