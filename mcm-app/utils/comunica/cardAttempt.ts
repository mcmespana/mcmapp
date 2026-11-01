// utils/comunica/cardAttempt.ts
//
// El pago con tarjeta (plan 15), máquina de estados PURA: de lo que pasa en la pantalla (crear, la hoja del banco, cada comprobación) a qué se ve. La app
// enseña, arranca y pregunta; el servidor prepara, reclama y decide: NUNCA se concluye «pagado» por lo que diga la vuelta del banco, solo por `check`.
//
//   resumen → creando → pagando (hoja abierta) → comprobando → uno de:
//     pagado · pagado sin confirmar (`confirming`, con sondeo) · KO (`failed`) · cancelado (cerró la hoja a medias)

import type { CardAttemptStatus } from '@/services/comunica/contract';

export type GatewayResult = 'ok' | 'ko' | 'closed';

export type ResultKind =
  'paid' | 'confirming' | 'waiting' | 'failed' | 'cancelled' | 'create_failed';

export type Phase =
  | { kind: 'summary' }
  | { kind: 'creating' }
  | { kind: 'paying'; attemptId: string }
  | { kind: 'checking'; attemptId: string; returned: GatewayResult }
  | {
      kind: 'result';
      result: ResultKind;
      registrationId?: string;
      paymentId?: string;
    };

export type Event =
  | { type: 'create' }
  | { type: 'created'; attemptId: string }
  | { type: 'createFailed' }
  | { type: 'gateway'; returned: GatewayResult }
  | {
      type: 'status';
      status: CardAttemptStatus;
      returned: GatewayResult;
      elapsedMs: number;
    }
  | { type: 'poll'; status: CardAttemptStatus; elapsedMs: number }
  | { type: 'retry' };

export const INITIAL: Phase = { kind: 'summary' };

/** El sondeo tras un «pagado sin confirmar»: a los 2, 4, 8, 15 y 30 s y cada 30 s hasta 3 min. */
export const CONFIRM_DELAYS_MS = [2000, 4000, 8000, 15000, 30000] as const;
export const CONFIRM_EVERY_MS = 30000;
export const CONFIRM_GIVE_UP_MS = 180000;
/** Tras cerrar la hoja a medias: a los 0, 3 y 8 s («Comprobando…»). */
export const CANCELLED_CHECKS_MS = [0, 3000, 8000] as const;

/** Cuánto esperar para la comprobación número `n` (0 = la primera) mientras se confirma; `null` = ya no se insiste. */
export function confirmDelay(n: number, elapsedMs: number): number | null {
  if (elapsedMs >= CONFIRM_GIVE_UP_MS) return null;
  return n < CONFIRM_DELAYS_MS.length ? CONFIRM_DELAYS_MS[n] : CONFIRM_EVERY_MS;
}

export function reduce(phase: Phase, e: Event): Phase {
  switch (e.type) {
    case 'create':
      // También desde la hoja abierta: «Abrir en el navegador» deja ese intento y arranca otro.
      return phase.kind === 'summary' ||
        phase.kind === 'result' ||
        phase.kind === 'paying'
        ? { kind: 'creating' }
        : phase;
    case 'created':
      return phase.kind === 'creating'
        ? { kind: 'paying', attemptId: e.attemptId }
        : phase;
    case 'createFailed':
      return phase.kind === 'creating'
        ? { kind: 'result', result: 'create_failed' }
        : phase;
    case 'gateway':
      return phase.kind === 'paying'
        ? { kind: 'checking', attemptId: phase.attemptId, returned: e.returned }
        : phase;
    case 'retry':
      return phase.kind === 'result' ? { kind: 'creating' } : phase;
    case 'poll':
      // El sondeo de «pagado sin confirmar»: el servidor puede darlo por cobrado más tarde.
      return phase.kind === 'result' &&
        (phase.result === 'confirming' || phase.result === 'waiting')
        ? { kind: 'result', ...outcome(e.status, 'ok', e.elapsedMs) }
        : phase;
    case 'status': {
      if (phase.kind !== 'checking') return phase;
      return { kind: 'result', ...outcome(e.status, e.returned, e.elapsedMs) };
    }
  }
}

/** El servidor manda: «KO pero el CRM dice pagado» es pagado; «OK pero sin cobrar todavía» es `confirming`; cerrar a medias y sin cobro, cancelado. */
export function outcome(
  s: CardAttemptStatus,
  returned: GatewayResult,
  elapsedMs: number,
): { result: ResultKind; registrationId?: string; paymentId?: string } {
  const ids = { registrationId: s.registrationId, paymentId: s.paymentId };
  if (s.state === 'paid') return { result: 'paid', ...ids };
  if (s.state === 'confirming')
    return {
      result: elapsedMs >= CONFIRM_GIVE_UP_MS ? 'waiting' : 'confirming',
      ...ids,
    };
  if (s.state === 'failed') return { result: 'failed', ...ids };
  // `started` o `abandoned`: el banco no dio nada. Si volvió «ko», falló; si cerró, no ha terminado.
  return { result: returned === 'ko' ? 'failed' : 'cancelled', ...ids };
}

/** ¿Hay que seguir preguntando? (mientras se confirma). */
export const isPolling = (p: Phase) =>
  p.kind === 'result' && p.result === 'confirming';

// ── La vuelta del banco ─────────────────────────────────────────────────────

/** `ok`/`ko` de una URL de vuelta (`<returnUrlPrefix><ok|ko>`); `null` si no es la de vuelta. Basura tras el prefijo: nada. */
export function parseReturnUrl(
  url: string,
  returnUrlPrefix: string,
): 'ok' | 'ko' | null {
  if (!returnUrlPrefix || !url.startsWith(returnUrlPrefix)) return null;
  const rest = url
    .slice(returnUrlPrefix.length)
    .split(/[?#]/)[0]
    .replace(/\/+$/, '');
  return rest === 'ok' || rest === 'ko' ? rest : null;
}

/** ¿Es una URL que no es `http(s)` (la app del banco para confirmar, Bizum, `intent:`)? Se abre fuera con `Linking`; `about:` y vacías no. */
export function isExternalScheme(url: string): boolean {
  if (!url || /^about:/i.test(url)) return false;
  return !/^https?:\/\//i.test(url);
}

/** El camino de reserva por el navegador: `mcmapp://comunica/pagos/vuelta?intento=…&r=ok|ko`. */
export function parseBrowserReturn(
  url: string,
): { attemptId: string; returned: 'ok' | 'ko' } | null {
  const m = /^mcmapp:\/\/comunica\/pagos\/vuelta\?(.*)$/.exec(url);
  if (!m) return null;
  const q = Object.fromEntries(
    m[1]
      .split('&')
      .map((kv) => kv.split('=').map(decodeURIComponent) as [string, string]),
  );
  const r = q.r;
  return q.intento && (r === 'ok' || r === 'ko')
    ? { attemptId: q.intento, returned: r }
    : null;
}

/** El dominio que se ve en la cabecera de la hoja (con su candado). */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// ── Textos del resultado ────────────────────────────────────────────────────

export interface ResultCopy {
  title: string;
  body: string;
  /** `success`: icono de bien; `error`: de mal; `wait`: reloj. */
  tone: 'success' | 'error' | 'wait';
  primary: string;
  secondary?: string;
}

export function resultCopy(
  r: ResultKind,
  opts: { child: string | null; fromRegistration: boolean },
): ResultCopy {
  const { child, fromRegistration } = opts;
  switch (r) {
    case 'paid':
      return {
        tone: 'success',
        title: fromRegistration
          ? child
            ? `Pago hecho. ${child} ya tiene su plaza.`
            : 'Pago hecho. Ya tienes tu plaza.'
          : 'Pago hecho.',
        body: '',
        primary: fromRegistration ? 'Ver la inscripción' : 'Volver a Pagos',
      };
    case 'confirming':
      return {
        tone: 'wait',
        title: 'Pago hecho',
        body: 'Si aún lo ves pendiente, el banco está terminando de confirmarlo.',
        primary: fromRegistration ? 'Ver la inscripción' : 'Volver a Pagos',
      };
    case 'waiting':
      return {
        tone: 'wait',
        title: 'Estamos esperando la confirmación del banco',
        body: 'En unos minutos lo verás como pagado.',
        primary: fromRegistration ? 'Ver la inscripción' : 'Volver a Pagos',
      };
    case 'failed':
      return {
        tone: 'error',
        title: 'No hemos podido completar el pago',
        body: 'No se ha realizado ningún cargo. Puedes intentarlo de nuevo o, si el problema continúa, hablar con tu delegación.',
        primary: 'Reintentar el pago',
        secondary: 'Ahora no',
      };
    case 'cancelled':
      return {
        tone: 'error',
        title: 'No has terminado el pago',
        body: 'No se ha cobrado nada. Si llegaste a pagar, lo verás como pagado en unos minutos.',
        primary: 'Volver a intentarlo',
        secondary: 'Ahora no',
      };
    case 'create_failed':
      return {
        tone: 'error',
        title: 'No se ha podido abrir la pasarela del banco',
        body: 'No se ha realizado ningún cargo. Inténtalo otra vez en un rato.',
        primary: 'Reintentar el pago',
        secondary: 'Ahora no',
      };
  }
}

export const LEAVE_PAYMENT = {
  title: '¿Dejar el pago?',
  body: 'Si ya has pagado, no pasa nada: lo verás como pagado en unos minutos.',
  keep: 'Seguir pagando',
  leave: 'Salir',
} as const;
