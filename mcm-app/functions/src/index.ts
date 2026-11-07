/**
 * Cloud Functions del proyecto MCM App.
 *
 *   - `purgeExpiredShares`: barre /playlistShares y /choirSessions y borra
 *     entradas cuyo `expiresAt` ya pasó.
 *   - `cacheCalendarIcs`: descarga y parsea los ICS de /calendars y deja el
 *     resultado en /calendarEvents para que la app no tenga que hablar con
 *     Google Calendar. Ver docs/funcionalidades/CALENDARIOS.md.
 *
 * Despliegue:
 *   cd mcm-app && firebase deploy --only functions
 *
 * Requisitos:
 *   - Proyecto en plan Blaze (las scheduled functions lo exigen).
 *   - `firebase use --add` ejecutado al menos una vez en mcm-app/ para
 *     vincular el proyecto.
 */
import { createHash } from 'node:crypto';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { parseICSPortable, type PortableEvent } from './generated/icsParser';

initializeApp();

const PLAYLIST_ROOT = 'playlistShares';
const CHOIR_ROOT = 'choirSessions';

/**
 * Recorre `path` y devuelve los IDs cuyo `expiresAt` (epoch ms) está en el
 * pasado. Maneja ausencia del campo (no borra) y formato inesperado (ignora).
 */
async function collectExpired(path: string, now: number): Promise<string[]> {
  const snap = await getDatabase().ref(path).once('value');
  if (!snap.exists()) return [];
  const root = snap.val() as Record<string, unknown>;
  const expired: string[] = [];
  for (const [id, value] of Object.entries(root)) {
    if (!value || typeof value !== 'object') continue;
    const expiresAt = (value as { expiresAt?: unknown }).expiresAt;
    if (typeof expiresAt !== 'number') continue;
    if (expiresAt < now) expired.push(id);
  }
  return expired;
}

export const purgeExpiredShares = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'Europe/Madrid',
    region: 'us-central1',
    retryCount: 0,
  },
  async () => {
    const now = Date.now();
    const [expiredPlaylists, expiredSessions] = await Promise.all([
      collectExpired(PLAYLIST_ROOT, now),
      collectExpired(CHOIR_ROOT, now),
    ]);

    const updates: Record<string, null> = {};
    for (const code of expiredPlaylists) {
      updates[`${PLAYLIST_ROOT}/${code}`] = null;
    }
    for (const code of expiredSessions) {
      updates[`${CHOIR_ROOT}/${code}`] = null;
    }

    if (Object.keys(updates).length === 0) {
      logger.info('Nothing to purge', {
        playlists: 0,
        sessions: 0,
      });
      return;
    }

    await getDatabase().ref().update(updates);
    logger.info('Purged expired entries', {
      playlists: expiredPlaylists.length,
      sessions: expiredSessions.length,
    });
  },
);

/* ========================================================================== *
 *  cacheCalendarIcs — precacheo de los calendarios ICS
 * ========================================================================== *
 *
 * El problema que resuelve: el `.ics` de Google Calendar se genera en caliente
 * en cada petición. Medido contra el feed real de MCM Europa, el TTFB es de
 * 0,9–1,3 s y la transferencia ~2 ms (21 KB con gzip, 81 KB en crudo). Es
 * decir: el 99,8 % de la espera es Google generando el fichero, y encima manda
 * `Cache-Control: no-store` sin `ETag`, así que no hay ninguna caché HTTP ni
 * revalidación posible. Un móvil con varios calendarios se comía ~1,2 s de
 * espera cada vez que caducaba la ventana de frescura, y no había optimización
 * de cliente capaz de arreglarlo.
 *
 * Aquí se paga esa espera UNA vez cada dos horas, en un servidor, y la app lee
 * el resultado del mismo Firebase con el que ya está hablando.
 *
 * Dos detalles que no son adorno:
 *
 *   1. Se guardan eventos PORTABLES (sin convertir a hora local). Esta función
 *      corre en `us-central1`; si localizara las horas aquí, todo el mundo
 *      vería los eventos en hora de Chicago. La conversión la hace el
 *      dispositivo (`localizeEvents`).
 *   2. `updatedAt` solo cambia si el contenido cambió DE VERDAD (se compara un
 *      hash). Los calendarios se editan a ritmo humano, así que lo normal es
 *      que una ejecución no escriba nada: sin esto, cada 2 h se invalidaría la
 *      caché local de todos los móviles y se re-descargaría el nodo entero para
 *      nada. `checkedAt` sí se escribe siempre, y es lo que la app mira para
 *      saber si el cron sigue vivo.
 */

const CALENDARS_NODE = 'calendars';
const CACHE_NODE = 'calendarEvents';

/** Tope por ICS. El feed real tarda ~1 s; 20 s es "esto no va a contestar". */
const ICS_TIMEOUT_MS = 20_000;

type CalendarConfig = { id: string; url: string; name?: string };

/** Caracteres que Firebase RTDB no admite en una clave. */
const INVALID_KEY = /[.#$/[\]]/;

/**
 * Lee `/calendars/data`, que el panel escribe como array (pero toleramos
 * objeto indexado, que es como RTDB devuelve un array con huecos).
 */
async function readCalendarConfigs(): Promise<CalendarConfig[]> {
  const snap = await getDatabase().ref(`${CALENDARS_NODE}/data`).once('value');
  if (!snap.exists()) return [];
  const raw = snap.val();
  const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});

  const out: CalendarConfig[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const { id, url, name } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof url !== 'string') continue;
    if (!id || !url) continue;
    if (INVALID_KEY.test(id)) {
      logger.warn('Calendar id no válido como clave de RTDB, omitido', { id });
      continue;
    }
    out.push({ id, url, name: typeof name === 'string' ? name : undefined });
  }
  return out;
}

/**
 * Quita las claves `undefined` de un evento: el Admin SDK revienta si le llega
 * `undefined` en cualquier nivel, y `PortableEvent` está lleno de opcionales.
 */
function stripUndefined(event: PortableEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Descarga y parsea UN ICS. Directo a la fuente: aquí no hay CORS. */
async function fetchCalendar(cfg: CalendarConfig): Promise<PortableEvent[]> {
  const res = await fetch(cfg.url, {
    signal: AbortSignal.timeout(ICS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  const events = parseICSPortable(text);
  if (events.length === 0) {
    // Un ICS vacío es sospechoso (el feed real trae ~150 eventos) pero no
    // imposible: un calendario recién creado lo está. No es un error, pero
    // conviene verlo en los logs si pasa de repente.
    logger.warn('ICS sin eventos', { id: cfg.id, url: cfg.url });
  }
  return events;
}

export const cacheCalendarIcs = onSchedule(
  {
    // Cada 2 h. Los calendarios se editan a ritmo humano y la app además
    // tiene su propia ventana de frescura de 5 min, así que bajar de aquí no
    // mejora lo que ve el usuario: solo gasta. Para publicar un evento ya,
    // se lanza a mano desde la consola de Cloud Scheduler.
    schedule: 'every 2 hours',
    timeZone: 'Europe/Madrid',
    region: 'us-central1',
    retryCount: 0,
    timeoutSeconds: 120,
  },
  async () => {
    const calendars = await readCalendarConfigs();
    if (calendars.length === 0) {
      logger.warn('No hay calendarios en /calendars/data, nada que cachear');
      return;
    }

    const db = getDatabase();
    const prevSnap = await db.ref(CACHE_NODE).once('value');
    const prev = (prevSnap.val() ?? {}) as {
      meta?: { updatedAt?: string; hash?: string };
      data?: Record<string, { events?: unknown }>;
    };

    const results = await Promise.allSettled(
      calendars.map((cfg) => fetchCalendar(cfg)),
    );

    const data: Record<string, { events: Record<string, unknown>[] }> = {};
    const failed: string[] = [];
    const reused: string[] = [];

    results.forEach((r, i) => {
      const cfg = calendars[i];
      if (r.status === 'fulfilled') {
        data[cfg.id] = { events: r.value.map(stripUndefined) };
        return;
      }
      failed.push(cfg.id);
      logger.error('Fallo descargando ICS', {
        id: cfg.id,
        url: cfg.url,
        error: String(r.reason),
      });
      // Un feed caído no debe borrar sus eventos: se conserva lo que ya
      // hubiera cacheado. Si nunca hubo nada, ese calendario se queda fuera y
      // la app lo bajará por ICS ella misma (sigue habiendo fallback).
      const previous = prev.data?.[cfg.id]?.events;
      if (Array.isArray(previous)) {
        data[cfg.id] = { events: previous as Record<string, unknown>[] };
        reused.push(cfg.id);
      }
    });

    if (Object.keys(data).length === 0) {
      // Todos caídos y sin nada previo: no escribimos `data` vacío ni tocamos
      // `meta`. Que el nodo se quede "viejo" es justo lo que la app necesita
      // ver para tirar de ICS directos.
      logger.error('Ningún calendario disponible, no se escribe nada', {
        failed,
      });
      return;
    }

    const calendarIds = Object.keys(data).sort();
    const hash = createHash('sha256')
      .update(JSON.stringify(calendarIds.map((id) => [id, data[id]])))
      .digest('hex');

    const now = new Date().toISOString();
    const unchanged = prev.meta?.hash === hash;

    if (unchanged) {
      // Solo señal de vida: ni `data` ni `updatedAt` se tocan, así que la
      // caché local de todos los móviles sigue siendo válida y su próxima
      // apertura no descarga nada más que estos tres campos.
      await db.ref(`${CACHE_NODE}/meta/checkedAt`).set(now);
      logger.info('Calendarios sin cambios', {
        calendars: calendarIds.length,
        failed: failed.length,
        reused: reused.length,
        hash,
      });
      return;
    }

    await db.ref(CACHE_NODE).update({
      data,
      meta: { updatedAt: now, checkedAt: now, hash, calendarIds },
    });

    logger.info('Calendarios actualizados', {
      calendars: calendarIds.length,
      events: calendarIds.reduce((n, id) => n + data[id].events.length, 0),
      failed: failed.length,
      reused: reused.length,
      hash,
    });
  },
);
