/**
 * Guardar desde el editor de canciones (solo administradores).
 *
 * Todo va al **admin del cantoral** (el del NAS), que es quien escribe el
 * `.cho`, hace commit y push; GitHub Actions regenera `songs.json` y lo sube a
 * Firebase, y la app lo baja la próxima vez que se abre:
 *
 *   app ──► NAS (/api/app/*) ──► GitHub ──► Actions ──► Firebase ──► apps
 *
 * - La app no guarda ningún secreto: manda el pase de Firebase de quien ha
 *   entrado y el NAS comprueba `users/<uid>/isAdmin`.
 * - **Si el NAS no contesta**, el cambio se queda en este móvil (una cola en
 *   AsyncStorage) y se envía solo cuando vuelva (`flushOutbox`).
 * - Quien edita ve su cambio al momento en todas las pantallas (se cambia la
 *   caché del catálogo) y, en cuanto el cantoral publica, se baja solo
 *   (`watchPublish`): no hace falta cerrar y abrir la app.
 *
 * La dirección del NAS vive en Firebase (`songs/editor/url`). Contrato en
 * `mcmapp-cantoral/scripts/admin/README.md` («API para la app»).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, getDatabase, ref } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import { logger } from '@/utils/logger';
import { patchCachedNode, revalidateNode } from '@/hooks/useFirebaseData';
import { applyEditToCatalog, type SongSnapshot } from '@/utils/songEditor';

const TIMEOUT_MS = 25_000;
const READ_TIMEOUT_MS = 240_000;
const OUTBOX_KEY = '@song_editor_outbox';

export interface EditorCategory {
  letter: string;
  title: string;
  key: string;
}

export interface EditorStatus {
  ok: boolean;
  ai: boolean;
  categories: EditorCategory[];
}

export class EditorApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
  /** No ha llegado al cantoral (sin red, NAS apagado o sin configurar). */
  get unreachable() {
    return this.status === 0 || this.status >= 500;
  }
}

let cachedBase: { at: number; url: string | null } | null = null;

/** Dirección del admin del cantoral, o null si no está configurada. */
export async function getEditorBaseUrl(): Promise<string | null> {
  if (cachedBase && Date.now() - cachedBase.at < 5 * 60_000)
    return cachedBase.url;
  let url: string | null = null;
  try {
    const snap = await get(
      ref(getDatabase(getFirebaseApp()), 'songs/editor/url'),
    );
    const v = snap.val();
    if (typeof v === 'string' && /^https?:\/\//.test(v)) url = v;
  } catch (e) {
    logger.warn('songEditor: sin songs/editor/url', e);
  }
  url = (url ?? process.env.EXPO_PUBLIC_CANTORAL_ADMIN_URL ?? '').replace(
    /\/+$/,
    '',
  );
  cachedBase = { at: Date.now(), url: url || null };
  return cachedBase.url;
}

async function call<T>(
  path: string,
  init: { method?: string; json?: unknown; form?: FormData; timeout?: number },
): Promise<T> {
  const base = await getEditorBaseUrl();
  if (!base) throw new EditorApiError('El cantoral no está conectado', 0);
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new EditorApiError('Inicia sesión para editar', 401);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeout ?? TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.json !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        init.form ??
        (init.json !== undefined ? JSON.stringify(init.json) : undefined),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      throw new EditorApiError(
        typeof data.error === 'string' ? data.error : `Error ${res.status}`,
        res.status,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof EditorApiError) throw e;
    throw new EditorApiError('El cantoral no contesta', 0);
  } finally {
    clearTimeout(timer);
  }
}

/** ¿Está el admin del cantoral a mano? (y si tiene la IA para leer fotos). */
export async function fetchEditorStatus(): Promise<EditorStatus | null> {
  try {
    return await call<EditorStatus>('/api/app/status', {
      method: 'GET',
      timeout: 8000,
    });
  } catch (e) {
    logger.info('songEditor: status', (e as Error).message);
    return null;
  }
}

// ── Cola en el móvil ──

export type OutboxItem =
  | {
      id: string;
      at: number;
      kind: 'edit';
      title: string;
      body: Record<string, unknown>;
    }
  | {
      id: string;
      at: number;
      kind: 'new';
      title: string;
      body: Record<string, unknown>;
    };

const outboxListeners = new Set<() => void>();
let outbox: OutboxItem[] | null = null;

async function loadOutbox(): Promise<OutboxItem[]> {
  if (outbox) return outbox;
  try {
    outbox = JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]');
  } catch {
    outbox = [];
  }
  return outbox as OutboxItem[];
}

async function storeOutbox(next: OutboxItem[]) {
  outbox = next;
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(next)).catch(() => {});
  outboxListeners.forEach((l) => l());
}

export function subscribeOutbox(listener: () => void): () => void {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
}

export async function getOutbox(): Promise<OutboxItem[]> {
  return [...(await loadOutbox())];
}

const PATHS = { edit: '/api/app/song/save', new: '/api/app/song/new' };
let flushing: Promise<number> | null = null;

/**
 * Envía lo que haya pendiente, en orden. Para en el primero que no llegue.
 * Lo que el cantoral rechaza de verdad (4xx) se descarta: reintentar no lo
 * arregla. Devuelve cuántos quedan.
 */
export function flushOutbox(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let items = await loadOutbox();
    while (items.length) {
      const item = items[0];
      try {
        await call(PATHS[item.kind], { json: item.body });
      } catch (e) {
        if (e instanceof EditorApiError && e.unreachable) break;
        logger.warn('songEditor: descartado de la cola', item.title, e);
      }
      items = items.slice(1);
      await storeOutbox(items);
    }
    return items.length;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function sendOrQueue(
  kind: OutboxItem['kind'],
  title: string,
  body: Record<string, unknown>,
): Promise<SaveResult> {
  // Lo pendiente va primero, para no adelantar un cambio a otro anterior.
  const pending = await flushOutbox();
  if (pending === 0) {
    try {
      const res = await call<{ pushed?: boolean; warning?: string }>(
        PATHS[kind],
        { json: body },
      );
      return { where: 'sent', pushed: res.pushed !== false };
    } catch (e) {
      if (!(e instanceof EditorApiError) || !e.unreachable) throw e;
    }
  }
  const items = await loadOutbox();
  await storeOutbox([
    ...items,
    { id: `${Date.now()}-${items.length}`, at: Date.now(), kind, title, body },
  ]);
  return { where: 'queued', pushed: false };
}

// ── Esperar a que se publique ──

/** Cada cuánto se mira si el cantoral ha publicado, y hasta cuándo. */
const PUBLISH_POLL_MS = 20_000;
const PUBLISH_GIVE_UP_MS = 6 * 60_000;
let publishWatch: ReturnType<typeof setInterval> | null = null;

/**
 * Tras guardar, el cantoral tarda un par de minutos en publicar (GitHub
 * Actions). Mientras, se pregunta a Firebase de vez en cuando —solo el
 * `updatedAt`, que no cuesta nada— y en cuanto cambia se baja el catálogo
 * nuevo: sin cerrar y abrir la app.
 */
export function watchPublish(): void {
  if (publishWatch) clearInterval(publishWatch);
  const started = Date.now();
  publishWatch = setInterval(() => {
    if (Date.now() - started > PUBLISH_GIVE_UP_MS) {
      if (publishWatch) clearInterval(publishWatch);
      publishWatch = null;
      return;
    }
    void revalidateNode('songs', 'songs').then((changed) => {
      if (changed && publishWatch) {
        clearInterval(publishWatch);
        publishWatch = null;
      }
    });
  }, PUBLISH_POLL_MS);
}

export interface SaveResult {
  /** `sent`: lo tiene el cantoral. `queued`: guardado en este móvil. */
  where: 'sent' | 'queued';
  /** El cantoral ya lo ha subido a GitHub. */
  pushed: boolean;
}

/**
 * Guarda una edición de una canción que ya existe.
 * `changes` y `fields` salen de `buildEdition` (`utils/songEditor.ts`).
 */
export async function saveSongEdition(args: {
  filename: string;
  category: string;
  title: string;
  changes: Record<string, unknown>;
  fields: Partial<SongSnapshot>;
}): Promise<SaveResult> {
  const { filename, category, title, changes, fields } = args;
  const result = await sendOrQueue('edit', title, {
    filename,
    category,
    ...changes,
    editedAt: new Date().toISOString(),
    timestamp: Date.now(),
    platform: Platform.OS,
    // La app no ve las directivas multimedia del `.cho`, así que su «antes»
    // nunca coincide al carácter: manda lo nuevo.
    force: true,
  });
  // En este móvil se ve ya, en todas las pantallas; y en cuanto el cantoral
  // publique, se cambia por la versión de verdad.
  await patchCachedNode('songs', (data) =>
    applyEditToCatalog(data, category, filename, fields),
  ).catch((e) => logger.warn('songEditor: caché', e));
  if (result.where === 'sent') watchPublish();
  return result;
}

/** Canción nueva: se crea en el repo del cantoral. */
export async function createSong(args: {
  category: string;
  title: string;
  artist?: string;
  key?: string;
  capo?: number;
  content: string;
}): Promise<SaveResult> {
  const result = await sendOrQueue('new', args.title, args);
  if (result.where === 'sent') watchPublish();
  return result;
}

/** Reordena una categoría (renumera sus canciones). Necesita el cantoral. */
export async function reorderCategory(
  category: string,
  order: string[],
): Promise<{ pushed: boolean }> {
  const res = await call<{ pushed?: boolean }>('/api/app/category/reorder', {
    json: { category, order },
  });
  watchPublish();
  return { pushed: res.pushed !== false };
}

export interface ConvertedSong {
  title: string;
  cho: string;
  category?: string;
  doubts?: string[];
}

function fromImport(raw: any): ConvertedSong {
  return {
    title: raw?.meta?.title || raw?.title || '',
    cho: raw?.cho || '',
    category: raw?.category || undefined,
    doubts: Array.isArray(raw?.doubts) ? raw.doubts.map(String) : undefined,
  };
}

/** Texto pegado (letra con acordes encima, ChordPro…) → ChordPro. */
export async function convertPastedText(text: string): Promise<ConvertedSong> {
  return fromImport(await call('/api/app/song/convert', { json: { text } }));
}

/**
 * Un enlace → canción. Los de doceacordes (`doceacordes.es/cancion/<id>`) los
 * convierte el cantoral con su conversor propio, sin IA; otras webs o fotos,
 * con la IA si la tiene.
 */
export async function fetchSongFromUrl(url: string): Promise<ConvertedSong> {
  const res = await call<{
    title?: string;
    cho?: string;
    category?: string;
  }>('/api/app/song/fetch-url', { json: { url }, timeout: READ_TIMEOUT_MS });
  return {
    title: res.title ?? '',
    cho: res.cho ?? '',
    category: res.category,
  };
}

/** ¿Es el texto pegado solo un enlace? */
export function isSongUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

/** Fotos o PDF de un cancionero → canciones leídas con la IA del cantoral. */
export async function readSongPhotos(
  files: { uri: string; name: string; type: string; file?: Blob }[],
): Promise<ConvertedSong[]> {
  const form = new FormData();
  for (const f of files) {
    if (f.file) form.append('files', f.file, f.name);
    else
      form.append('files', {
        uri: f.uri,
        name: f.name,
        type: f.type,
      } as unknown as Blob);
  }
  const res = await call<{ songs?: unknown[] }>('/api/app/song/read', {
    form,
    timeout: READ_TIMEOUT_MS,
  });
  return (res.songs ?? []).map(fromImport);
}
