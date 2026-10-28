// services/comunica/outbox.ts
//
// La cola de escrituras del área (plan 01 §4). Guardar nunca espera al CRM:
// la escritura se apunta en el móvil al instante, sube sola y la pantalla
// enseña en qué está.
//
//   · Una entrada por `key` (`roll:<sesión>:<grupo>`): GANA LA ÚLTIMA, como la
//     cola del plugin (`js/stic-pasar-lista.js`).
//   · El `clientId` lo pone quien encola y se conserva entre reintentos: el
//     servidor no duplica.
//   · Estados: pending → sending → applied | failed | stuck (tras 5 fallos).
//   · Sin red: NO es un fallo. Sigue `pending` («guardada en el móvil, se
//     enviará sola»), sin gastar intentos, y sube al volver la red (`wake`).
//   · CRM caído (503/5xx): `failed` con reintento automático y espera
//     creciente; a los 5, `stuck`.
//     `validation`, `forbidden` o una respuesta rota: `failed` con el mensaje,
//     sin reintentar sola (no se arregla insistiendo).
//   · Sube al encolar, al reconectar, al volver la app y al abrir cualquier
//     pantalla del área (lo quiso el propietario en octubre, plan 042 `pl-9`).
//   · Sin límite de horas: lo de 72 h del plugin venía del nonce de WordPress.
//     La pantalla enseña la fecha de lo viejo para que nadie suba una lista
//     antigua sin darse cuenta.
//   · Un 401 no cuenta para el límite: la escritura espera a que se vuelva a
//     entrar (no se arregla insistiendo, pero tampoco es culpa suya).
//   · Un fallo que no es del servidor ni de la red (un error de programación)
//     no se reintenta solo: `failed` con `internal`.
//
// Es por persona (el cajón `outbox` de `storage.ts`): al salir, se borra.
// `dispose()` la apaga para siempre: cancela los reintentos programados y, si
// había una subida en vuelo, lo que conteste ya no se escribe ni se anuncia.
// La llama el proveedor al cambiar de persona y la sesión al salir, ANTES de
// borrar: así nada de A se vuelve a escribir en el móvil ni se sube con la
// sesión de B.

import { isComunicaApiError } from './client';
import { getWorkingDelegation, withWriteDelegation } from './delegation';
import { readDrawer, writeDrawer } from './storage';
import { logger } from '@/utils/logger';

export type OutboxStatus =
  'pending' | 'sending' | 'applied' | 'failed' | 'stuck';

export interface OutboxEntry<P = unknown> {
  key: string;
  kind: string;
  payload: P;
  clientId: string;
  /** Lo que la pantalla necesita para enseñarla («C1 · 15 nov»). */
  meta: Record<string, string>;
  status: OutboxStatus;
  attempts: number;
  /** Para `failed`/`stuck`: el mensaje y si se reintenta sola. */
  error?: { code: string; message: string; reason?: string; auto: boolean };
  createdAt: number;
  updatedAt: number;
  nextAttemptAt: number;
  /** Veces que se ha esperado por falta de red (no cuentan como intento). */
  waits?: number;
  /** Lo que contestó el servidor al subir (solo en memoria). */
  result?: unknown;
}

export type OutboxHandler = (entry: OutboxEntry) => Promise<unknown>;

/** Fallos seguidos antes de darla por atascada. */
export const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000;
/** Lo subido se enseña como «Subida» un rato y luego se quita. */
const APPLIED_TTL_MS = 10 * 60_000;

export const backoffMs = (attempts: number) =>
  Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));

export interface Outbox {
  load(): Promise<void>;
  enqueue(input: {
    key: string;
    kind: string;
    payload: unknown;
    clientId: string;
    meta?: Record<string, string>;
  }): Promise<void>;
  /** Intenta subir lo que toca ya. */
  flush(): Promise<void>;
  /**
   * Ha vuelto la red, la app o se abre una pantalla: lo que esperaba (sin
   * red, sin sesión o un reintento de CRM caído) se intenta YA.
   */
  wake(): Promise<void>;
  /** «Reintentar» a mano (también lo atascado). */
  retry(key: string): Promise<void>;
  /** Descartar (con confirmación en la pantalla). */
  discard(key: string): Promise<void>;
  entries(): readonly OutboxEntry[];
  get(key: string): OutboxEntry | undefined;
  subscribe(listener: () => void): () => void;
  /** Apagarla para siempre (salir, cambiar de persona). */
  dispose(): void;
  readonly disposed: boolean;
}

interface Options {
  personId: string;
  handlers: Record<string, OutboxHandler>;
  /** Cuando una sube: refrescar consultas, etc. */
  onApplied?: (entry: OutboxEntry, result: unknown) => void;
  now?: () => number;
  /**
   * Programar el siguiente intento (en tests, falso). Devuelve, si puede, cómo
   * cancelarlo: `dispose()` lo llama.
   */
  schedule?: (fn: () => void, ms: number) => unknown;
}

/** Un reintento programado vale como mucho esto (sin `Infinity`: va a JSON). */
const NEVER = Number.MAX_SAFE_INTEGER;

/** ¿Le toca subir sola? Lo rechazado sin `auto` espera a «Reintentar». */
const isDue = (e: OutboxEntry, t: number) =>
  (e.status === 'pending' ||
    (e.status === 'failed' && e.error?.auto !== false)) &&
  (e.nextAttemptAt ?? 0) <= t;

export function createOutbox({
  personId,
  handlers,
  onApplied,
  now = Date.now,
  schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
}: Options): Outbox {
  let list: OutboxEntry[] = [];
  let snapshot: readonly OutboxEntry[] = [];
  let flushing: Promise<void> | null = null;
  let loaded = false;
  let disposed = false;
  const listeners = new Set<() => void>();
  const timers = new Set<() => void>();

  const later = (ms: number) => {
    let cancel: (() => void) | null = null;
    const run = () => {
      if (cancel) timers.delete(cancel);
      if (!disposed) void outbox.flush();
    };
    const handle = schedule(run, ms);
    cancel = typeof handle === 'function' ? (handle as () => void) : null;
    if (cancel) timers.add(cancel);
  };

  // Ya apagada, ni se anuncia ni se escribe: lo de esta persona puede estar
  // borrándose ahora mismo (salir) y no debe resucitar.
  const changed = async () => {
    if (disposed) return;
    snapshot = [...list];
    listeners.forEach((l) => l());
    await writeDrawer(
      personId,
      'outbox',
      list.filter((e) => e.status !== 'applied'),
    );
  };

  const prune = () => {
    const t = now();
    list = list.filter(
      (e) => e.status !== 'applied' || t - e.updatedAt < APPLIED_TTL_MS,
    );
  };

  async function sendOne(entry: OutboxEntry) {
    if (disposed) return;
    const handler = handlers[entry.kind];
    if (!handler) {
      logger.error('[comunica] cola sin manejador', entry.kind);
      // Sin manejador no hay nada que hacer: que no bloquee el bucle.
      entry.status = 'failed';
      entry.error = {
        code: 'internal',
        message: 'Sin manejador',
        auto: false,
      };
      entry.nextAttemptAt = NEVER;
      await changed();
      return;
    }
    entry.status = 'sending';
    entry.updatedAt = now();
    await changed();
    // Apagada mientras se escribía: no se sube (podría ir ya con otra sesión).
    if (disposed) return;
    const sentClientId = entry.clientId;
    try {
      // Sube con la delegación con la que se hizo (plan 17): '' = la de la
      // ficha; sin el dato (entradas de antes), la de trabajo.
      const d = entry.meta.delegation;
      const result = await withWriteDelegation(
        d === undefined ? undefined : d || null,
        () => handler(entry),
      );
      if (disposed) return;
      // Si mientras subía se encoló otra versión, esa sigue pendiente.
      const currentEntry = list.find((e) => e.key === entry.key);
      if (currentEntry && currentEntry.clientId !== sentClientId) return;
      entry.status = 'applied';
      entry.error = undefined;
      entry.result = result;
      entry.updatedAt = now();
      onApplied?.(entry, result);
    } catch (e) {
      if (disposed) return;
      const currentEntry = list.find((x) => x.key === entry.key);
      if (currentEntry && currentEntry.clientId !== sentClientId) return;
      entry.updatedAt = now();
      const apiError = isComunicaApiError(e);
      // Lo que no es un `ComunicaApiError` no viene del servidor ni de la red
      // (el cliente envuelve los fallos de `fetch`): es un fallo de la app.
      const code = apiError ? e.code : 'internal';
      const message = e instanceof Error ? e.message : String(e);
      const reason = apiError ? e.reason : undefined;
      if (code === 'unauthenticated') {
        // Sin sesión: se queda esperando a que se vuelva a entrar. No cuenta
        // como intento: no es que el servidor la rechace.
        entry.status = 'pending';
        entry.error = undefined;
        entry.nextAttemptAt = now() + backoffMs(Math.max(1, entry.attempts));
      } else if (code === 'network') {
        // Sin conexión no es un fallo: sigue «guardada en el móvil» y se sube
        // sola al volver la red (`wake`), sin gastar intentos. Mientras, se
        // prueba de vez en cuando por si la red volvió sin avisar.
        entry.waits = (entry.waits ?? 0) + 1;
        entry.status = 'pending';
        entry.error = undefined;
        entry.nextAttemptAt = now() + backoffMs(entry.waits);
        later(backoffMs(entry.waits));
      } else if (code === 'crm_unavailable') {
        entry.attempts += 1;
        if (entry.attempts >= MAX_ATTEMPTS) {
          entry.status = 'stuck';
          entry.error = { code, message, reason, auto: false };
          entry.nextAttemptAt = NEVER;
          // Ids, nunca nombres.
          logger.error('[comunica] escritura atascada', entry.kind, entry.key);
        } else {
          entry.status = 'failed';
          entry.error = { code, message, reason, auto: true };
          entry.nextAttemptAt = now() + backoffMs(entry.attempts);
          later(backoffMs(entry.attempts));
        }
      } else {
        entry.attempts += 1;
        if (code === 'internal') {
          logger.error('[comunica] escritura con fallo de la app', entry.kind);
        }
        entry.status = 'failed';
        entry.error = { code, message, reason, auto: false };
        entry.nextAttemptAt = NEVER;
      }
    }
    prune();
    await changed();
  }

  const outbox: Outbox = {
    async load() {
      if (loaded || disposed) return;
      loaded = true;
      const saved = await readDrawer<OutboxEntry[]>(personId, 'outbox');
      if (disposed) return;
      // Lo que se quedó «subiendo» al cerrar la app vuelve a pendiente. Lo
      // rechazado sin reintento automático sigue esperando a «Reintentar»
      // (antes un `Infinity` pasaba por JSON como `null` y se reenviaba).
      const fromDisk = (Array.isArray(saved) ? saved : []).map((e) => ({
        ...e,
        status: e.status === 'sending' ? ('pending' as const) : e.status,
        nextAttemptAt:
          typeof e.nextAttemptAt === 'number' &&
          Number.isFinite(e.nextAttemptAt)
            ? e.nextAttemptAt
            : e.status === 'failed' || e.status === 'stuck'
              ? NEVER
              : 0,
      }));
      // Lo encolado antes de terminar de cargar gana a lo del disco.
      const keys = new Set(list.map((e) => e.key));
      list = [...fromDisk.filter((e) => !keys.has(e.key)), ...list];
      snapshot = [...list];
      listeners.forEach((l) => l());
    },

    async enqueue({ key, kind, payload, clientId, meta: given = {} }) {
      if (disposed) return;
      const meta =
        'delegation' in given
          ? given
          : { ...given, delegation: getWorkingDelegation() ?? '' };
      const t = now();
      const prev = list.find((e) => e.key === key);
      const entry: OutboxEntry = {
        key,
        kind,
        payload,
        clientId,
        meta,
        status: 'pending',
        attempts: 0,
        createdAt: prev && prev.status !== 'applied' ? prev.createdAt : t,
        updatedAt: t,
        nextAttemptAt: t,
      };
      list = [...list.filter((e) => e.key !== key), entry];
      await changed();
      void outbox.flush();
    },

    flush() {
      if (disposed) return Promise.resolve();
      if (flushing) return flushing;
      const run = async () => {
        // El primer `await` va ANTES del bucle: si no hubiera nada que subir,
        // el `finally` correría antes de asignar `flushing` y la cola se
        // quedaría bloqueada para siempre con una promesa ya resuelta.
        await Promise.resolve();
        try {
          for (;;) {
            if (disposed) break;
            const t = now();
            const next = list.find((e) => isDue(e, t));
            if (!next) break;
            await sendOne(next);
          }
        } finally {
          flushing = null;
        }
      };
      flushing = run();
      return flushing;
    },

    wake() {
      if (disposed) return Promise.resolve();
      const t = now();
      for (const e of list) {
        if (isDue(e, Number.MAX_SAFE_INTEGER - 1) && e.nextAttemptAt > t) {
          e.nextAttemptAt = t;
        }
      }
      return outbox.flush();
    },

    async retry(key) {
      if (disposed) return;
      const e = list.find((x) => x.key === key);
      if (!e || e.status === 'sending' || e.status === 'applied') return;
      e.status = 'pending';
      if (e.attempts >= MAX_ATTEMPTS) e.attempts = 0;
      e.nextAttemptAt = now();
      e.error = undefined;
      await changed();
      await outbox.flush();
    },

    async discard(key) {
      if (disposed) return;
      list = list.filter((e) => e.key !== key);
      await changed();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      timers.forEach((cancel) => cancel());
      timers.clear();
      listeners.clear();
    },
    get disposed() {
      return disposed;
    },

    entries: () => snapshot,
    get: (key) => snapshot.find((e) => e.key === key),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return outbox;
}

/** Lo que falta por subir (para «Tienes 2 listas guardadas solo en el móvil»). */
export const unsent = (entries: readonly OutboxEntry[]) =>
  entries.filter((e) => e.status !== 'applied');
