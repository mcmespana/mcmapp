// Pagos (plan 15): las lecturas y el pago con tarjeta de un perfil.
//
//   · NADA de Pagos va al móvil (importes, conceptos, cuenta enmascarada, correo del pagador): `persist: false` en el contrato, memoria 5 min y
//     `staleTime: 0` (el plugin no cachea Pagos, «es dinero»). A disco solo va el INTENTO EN CURSO (`attemptId`, `pid`, de dónde sale, hora; SIN importes),
//     en el cajón `payattempt` de la persona; se borra al terminar y al salir.
//   · Nada va por la cola: pagar exige conexión.
//   · La app nunca escribe en el CRM ni concluye «pagado» por su cuenta: el estado sale siempre de `check` (`cardAttempt.ts`).

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { comunicaNow, getComunicaApi } from '@/services/comunica';
import type {
  CardAttemptResult,
  CardAttemptStatus,
} from '@/services/comunica/contract';
import { readDrawer, writeDrawer } from '@/services/comunica/storage';
import {
  CANCELLED_CHECKS_MS,
  confirmDelay,
  INITIAL,
  reduce,
  type GatewayResult,
  type Phase,
} from '@/utils/comunica/cardAttempt';
import { uuidV4 } from '@/utils/comunica/uuid';
import { useMe } from './useMe';
import { useAreaQuery } from './useAreaQuery';
import { invalidateAfterRegistration } from './useRegistrations';

const GC = 5 * 60_000;

export const paymentsKey = (pid: string) => ['pagos', pid] as const;

export function usePayments(pid: string | null | undefined) {
  return useAreaQuery({
    key: [...paymentsKey(pid ?? '')],
    route: 'profilePayments',
    fetch: () => getComunicaApi().getProfilePayments(pid!),
    staleTime: 0,
    gcTime: GC,
    enabled: !!pid,
    retry: false,
  });
}

export function usePayment(pid: string | null | undefined, id: string) {
  return useAreaQuery({
    key: [...paymentsKey(pid ?? ''), 'detalle', id],
    route: 'profilePayment',
    fetch: () => getComunicaApi().getProfilePayment(pid!, id),
    staleTime: 0,
    gcTime: GC,
    enabled: !!pid && !!id,
    retry: false,
  });
}

export type PaySource = { payment: string } | { registration: string };

export function useCardCheckout(
  pid: string | null | undefined,
  source: PaySource | null,
) {
  const kind = source && 'payment' in source ? 'pago' : 'inscripcion';
  const id = source
    ? 'payment' in source
      ? source.payment
      : source.registration
    : '';
  return useAreaQuery({
    key: [...paymentsKey(pid ?? ''), 'pagar', kind, id],
    route: 'cardCheckout',
    fetch: () => getComunicaApi().getCardCheckout(pid!, source!),
    staleTime: 0,
    gcTime: 60_000,
    enabled: !!pid && !!source,
    retry: false,
  });
}

// ── El intento en curso (a disco, sin importes) ─────────────────────────────

interface Saved {
  attemptId: string;
  pid: string;
  source: PaySource;
  /** ms desde 1970. */
  at: number;
}
const SAVED_TTL_MS = 24 * 60 * 60 * 1000;

async function saveAttempt(personId: string, s: Saved) {
  await writeDrawer(personId, 'payattempt', s);
}
async function clearAttempt(personId: string) {
  await writeDrawer(personId, 'payattempt', null);
}

/**
 * Pagar con tarjeta: crea el intento (con un `clientId` NUEVO cada vez, también al reintentar), da la pasarela a la hoja, pregunta al servidor al volver y
 * sondea mientras el banco confirma. Devuelve la fase para pintar; nada más.
 */
export function useCardPayment(opts: { pid: string; source: PaySource }) {
  const { pid, source } = opts;
  const qc = useQueryClient();
  const personId = useMe().me?.personId ?? null;
  const [phase, dispatch] = useReducer(reduce, INITIAL as Phase);
  const [attempt, setAttempt] = useState<CardAttemptResult | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const returnedRef = useRef<GatewayResult>('closed');
  const startedAt = useRef(0);
  const amountRef = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const finish = useCallback(
    (s: CardAttemptStatus) => {
      if (s.state === 'paid' || s.state === 'confirming')
        invalidateAfterRegistration(qc, pid);
    },
    [qc, pid],
  );

  const start = useCallback(
    async (amountCents: number) => {
      clearTimers();
      amountRef.current = amountCents;
      dispatch({ type: 'create' });
      try {
        const a = await getComunicaApi().createCardAttempt(pid, {
          clientId: uuidV4(),
          source,
          amountCents,
          channel: 'sheet',
        });
        setAttempt(a);
        if (personId)
          void saveAttempt(personId, {
            attemptId: a.attemptId,
            pid,
            source,
            at: comunicaNow().getTime(),
          });
        returnedRef.current = 'closed';
        dispatch({ type: 'created', attemptId: a.attemptId });
      } catch {
        dispatch({ type: 'createFailed' });
      }
    },
    [pid, source, personId, clearTimers],
  );

  /** Lo que pasa tras volver del banco (o cerrar a medias): preguntar al servidor, que decide. */
  const runCheck = useCallback(
    async (attemptId: string, returned: GatewayResult) => {
      returnedRef.current = returned;
      startedAt.current = comunicaNow().getTime();
      dispatch({ type: 'gateway', returned });
      const api = getComunicaApi();
      const ask = (r?: GatewayResult) =>
        api.checkCardAttempt(pid, attemptId, r ? { returned: r } : {});
      try {
        let status = await ask(returned);
        // Cerrar a medias: se comprueba a los 0, 3 y 8 s por si llegó a pagar.
        if (returned === 'closed') {
          for (const ms of CANCELLED_CHECKS_MS.slice(1)) {
            if (status.state === 'paid' || status.state === 'confirming') break;
            await new Promise((r) => timers.current.push(setTimeout(r, ms)));
            status = await ask();
          }
        }
        finish(status);
        dispatch({ type: 'status', status, returned, elapsedMs: 0 });
        if (status.state !== 'confirming' && personId)
          void clearAttempt(personId);
      } catch {
        // Sin saber qué pasó: no se dice «pagado» ni «no se cobró»; «esperando al banco» y se sigue preguntando.
        dispatch({
          type: 'status',
          status: { attemptId, state: 'confirming' },
          returned,
          elapsedMs: 0,
        });
      }
    },
    [pid, finish, personId],
  );

  /** La hoja devolvió algo: `ok` o `ko` de la URL de vuelta, o `closed` si la cerró a medias. */
  const onGateway = useCallback(
    async (returned: GatewayResult) => {
      if (phase.kind !== 'paying') return;
      await runCheck(phase.attemptId, returned);
    },
    [phase, runCheck],
  );

  /**
   * La reserva: el navegador del sistema (`channel: 'browser'`). `open` abre la URL y dice cómo volvió (`ok`, `ko` o `closed`); el servidor, que
   * redirige a `mcmapp://comunica/pagos/vuelta`, es quien decide si se cobró.
   */
  const startBrowser = useCallback(
    async (
      amountCents: number,
      open: (launchUrl: string) => Promise<GatewayResult>,
    ) => {
      clearTimers();
      amountRef.current = amountCents;
      dispatch({ type: 'create' });
      try {
        const a = await getComunicaApi().createCardAttempt(pid, {
          clientId: uuidV4(),
          source,
          amountCents,
          channel: 'browser',
        });
        if ('simulated' in a) throw new Error('simulated');
        setAttempt(a);
        if (personId)
          void saveAttempt(personId, {
            attemptId: a.attemptId,
            pid,
            source,
            at: comunicaNow().getTime(),
          });
        dispatch({ type: 'created', attemptId: a.attemptId });
        await runCheck(a.attemptId, await open(a.launchUrl));
      } catch {
        dispatch({ type: 'createFailed' });
      }
    },
    [pid, source, personId, clearTimers, runCheck],
  );

  // El sondeo mientras el banco confirma: 2, 4, 8, 15 y 30 s y cada 30 s hasta 3 min.
  const attemptId =
    phase.kind === 'result' &&
    (phase.result === 'confirming' || phase.result === 'waiting')
      ? (attempt?.attemptId ?? null)
      : null;
  const resultKind = phase.kind === 'result' ? phase.result : null;
  useEffect(() => {
    if (!attemptId || resultKind !== 'confirming') return;
    let n = 0;
    let stopped = false;
    const tick = () => {
      const elapsed = comunicaNow().getTime() - startedAt.current;
      const wait = confirmDelay(n, elapsed);
      if (wait == null) {
        dispatch({
          type: 'poll',
          status: { attemptId, state: 'confirming' },
          elapsedMs: elapsed + 1,
        });
        return;
      }
      timers.current.push(
        setTimeout(async () => {
          if (stopped) return;
          n += 1;
          try {
            const s = await getComunicaApi().checkCardAttempt(
              pid,
              attemptId,
              {},
            );
            finish(s);
            dispatch({
              type: 'poll',
              status: s,
              elapsedMs: comunicaNow().getTime() - startedAt.current,
            });
            if (s.state === 'paid' && personId) void clearAttempt(personId);
            if (s.state === 'confirming') tick();
          } catch {
            tick();
          }
        }, wait),
      );
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [attemptId, resultKind, pid, finish, personId]);

  const retry = useCallback(() => {
    dispatch({ type: 'retry' });
    return start(amountRef.current);
  }, [start]);

  return {
    phase,
    attempt,
    start,
    startBrowser,
    onGateway,
    retry,
    amountCents: amountRef.current,
  };
}

/**
 * Si la app se cerró a mitad de pago: al volver a Pagos o a la inscripción con un intento en curso de menos de 24 h, se comprueba y se enseña el resultado UNA
 * vez; el registro local se borra. `null` mientras no hay nada que decir.
 */
export function useResumedAttempt(pid: string | null | undefined) {
  const qc = useQueryClient();
  const personId = useMe().me?.personId ?? null;
  const [state, setState] = useState<CardAttemptStatus | null>(null);
  useEffect(() => {
    if (!personId || !pid) return;
    let cancelled = false;
    void (async () => {
      const saved = await readDrawer<Saved>(personId, 'payattempt');
      if (!saved || saved.pid !== pid) return;
      if (comunicaNow().getTime() - saved.at > SAVED_TTL_MS) {
        await clearAttempt(personId);
        return;
      }
      try {
        const s = await getComunicaApi().checkCardAttempt(
          pid,
          saved.attemptId,
          {},
        );
        if (cancelled) return;
        if (s.state === 'paid' || s.state === 'confirming')
          invalidateAfterRegistration(qc, pid);
        setState(s);
        if (s.state !== 'confirming') await clearAttempt(personId);
      } catch {
        // Sin red: se queda guardado para la próxima.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personId, pid, qc]);
  return state;
}
