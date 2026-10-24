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
//   · Red caída o CRM caído: se reintenta sola, con espera creciente.
//     `validation`, `forbidden` o una respuesta rota: `failed` con el mensaje,
//     sin reintentar sola (no se arregla insistiendo).
//   · Sube al encolar, al reconectar, al volver la app y al abrir cualquier
//     pantalla del área (lo quiso el propietario en octubre, plan 042 `pl-9`).
//   · Sin límite de horas: lo de 72 h del plugin venía del nonce de WordPress.
//     La pantalla enseña la fecha de lo viejo para que nadie suba una lista
//     antigua sin darse cuenta.
//
// Es por persona (el cajón `outbox` de `storage.ts`): al salir, se borra.

import { isComunicaApiError } from './client';
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
  /** «Reintentar» a mano (también lo atascado). */
  retry(key: string): Promise<void>;
  /** Descartar (con confirmación en la pantalla). */
  discard(key: string): Promise<void>;
  entries(): readonly OutboxEntry[];
  get(key: string): OutboxEntry | undefined;
  subscribe(listener: () => void): () => void;
}

interface Options {
  personId: string;
  handlers: Record<string, OutboxHandler>;
  /** Cuando una sube: refrescar consultas, etc. */
  onApplied?: (entry: OutboxEntry, result: unknown) => void;
  now?: () => number;
  /** Programar el siguiente intento (en tests, falso). */
  schedule?: (fn: () => void, ms: number) => void;
}

export function createOutbox({
  personId,
  handlers,
  onApplied,
  now = Date.now,
  schedule = (fn, ms) => {
    setTimeout(fn, ms);
  },
}: Options): Outbox {
  let list: OutboxEntry[] = [];
  let snapshot: readonly OutboxEntry[] = [];
  let flushing: Promise<void> | null = null;
  let loaded = false;
  const listeners = new Set<() => void>();

  const changed = async () => {
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
    const handler = handlers[entry.kind];
    if (!handler) {
      logger.error('[comunica] cola sin manejador', entry.kind);
      return;
    }
    entry.status = 'sending';
    entry.updatedAt = now();
    await changed();
    const sentClientId = entry.clientId;
    try {
      const result = await handler(entry);
      // Si mientras subía se encoló otra versión, esa sigue pendiente.
      const currentEntry = list.find((e) => e.key === entry.key);
      if (currentEntry && currentEntry.clientId !== sentClientId) return;
      entry.status = 'applied';
      entry.error = undefined;
      entry.result = result;
      entry.updatedAt = now();
      onApplied?.(entry, result);
    } catch (e) {
      const currentEntry = list.find((x) => x.key === entry.key);
      if (currentEntry && currentEntry.clientId !== sentClientId) return;
      entry.attempts += 1;
      entry.updatedAt = now();
      const code = isComunicaApiError(e) ? e.code : 'network';
      const message = e instanceof Error ? e.message : String(e);
      const reason = isComunicaApiError(e) ? e.reason : undefined;
      if (code === 'unauthenticated') {
        // Sin sesión: se queda esperando a que se vuelva a entrar.
        entry.status = 'pending';
        entry.nextAttemptAt = now() + backoffMs(entry.attempts);
      } else if (code === 'network' || code === 'crm_unavailable') {
        if (entry.attempts >= MAX_ATTEMPTS) {
          entry.status = 'stuck';
          entry.error = { code, message, reason, auto: false };
          // Ids, nunca nombres.
          logger.error('[comunica] escritura atascada', entry.kind, entry.key);
        } else {
          entry.status = 'failed';
          entry.error = { code, message, reason, auto: true };
          entry.nextAttemptAt = now() + backoffMs(entry.attempts);
          schedule(() => void outbox.flush(), backoffMs(entry.attempts));
        }
      } else {
        entry.status = 'failed';
        entry.error = { code, message, reason, auto: false };
        entry.nextAttemptAt = Number.POSITIVE_INFINITY;
      }
    }
    prune();
    await changed();
  }

  const outbox: Outbox = {
    async load() {
      if (loaded) return;
      loaded = true;
      const saved = await readDrawer<OutboxEntry[]>(personId, 'outbox');
      // Lo que se quedó «subiendo» al cerrar la app vuelve a pendiente.
      const fromDisk = (saved ?? []).map((e) =>
        e.status === 'sending' ? { ...e, status: 'pending' as const } : e,
      );
      // Lo encolado antes de terminar de cargar gana a lo del disco.
      const keys = new Set(list.map((e) => e.key));
      list = [...fromDisk.filter((e) => !keys.has(e.key)), ...list];
      snapshot = [...list];
      listeners.forEach((l) => l());
    },

    async enqueue({ key, kind, payload, clientId, meta = {} }) {
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
      if (flushing) return flushing;
      const run = async () => {
        // El primer `await` va ANTES del bucle: si no hubiera nada que subir,
        // el `finally` correría antes de asignar `flushing` y la cola se
        // quedaría bloqueada para siempre con una promesa ya resuelta.
        await Promise.resolve();
        try {
          for (;;) {
            const t = now();
            const next = list.find(
              (e) =>
                (e.status === 'pending' || e.status === 'failed') &&
                e.nextAttemptAt <= t,
            );
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

    async retry(key) {
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
      list = list.filter((e) => e.key !== key);
      await changed();
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
