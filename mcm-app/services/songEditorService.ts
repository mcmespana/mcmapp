/**
 * Guardar los cambios del editor de canciones (solo administradores).
 *
 * Dos destinos, en este orden:
 *
 * 1. **Firebase** (`songs/data/<categoría>/songs/<i>/<campo>` + `updatedAt`):
 *    el cambio se ve en todos los móviles al momento. Es lo que hacía el panel
 *    secreto.
 * 2. **El repo del cantoral**, que es la fuente de verdad. Si el admin del
 *    cantoral (el del NAS) está configurado y contesta, se le manda la edición
 *    y él la escribe en el `.cho`, hace commit y push (`/api/app/song/save`).
 *    Si no contesta, la edición se deja en la cola `songs/ediciones`, que el
 *    cantoral aplica solo cada pocas horas. De una forma u otra, no se pierde.
 *
 * La app no guarda ningún secreto: al NAS se le manda el pase de Firebase de
 * quien ha entrado, y él comprueba `users/<uid>/isAdmin`.
 *
 * La dirección del NAS vive en Firebase (`songs/editor/url`), para poder
 * cambiarla sin publicar la app. Contrato: `mcmapp-cantoral`,
 * `scripts/admin/README.md` («API para la app»).
 */
import { Platform } from 'react-native';
import { get, getDatabase, ref, set } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import { pushWithRetry } from '@/services/firebaseWrites';
import { logger } from '@/utils/logger';
import type { SongSnapshot } from '@/utils/songEditor';

const TIMEOUT_MS = 20_000;
const READ_TIMEOUT_MS = 240_000;

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
  conflict: boolean;
  constructor(message: string, status: number, conflict = false) {
    super(message);
    this.status = status;
    this.conflict = conflict;
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
        data.conflict === true,
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

export interface SaveResult {
  /** `repo`: ya está en el cantoral. `queue`: se aplicará solo en unas horas. */
  where: 'repo' | 'queue';
  warning?: string;
}

/**
 * Guarda una edición de una canción que ya existe.
 * `changes` y `fields` salen de `buildEdition` (`utils/songEditor.ts`).
 */
export async function saveSongEdition(args: {
  filename: string;
  category: string;
  changes: Record<string, unknown>;
  fields: Partial<SongSnapshot>;
}): Promise<SaveResult> {
  const { filename, category, changes, fields } = args;
  const db = getDatabase(getFirebaseApp());

  // 1) Firebase: se ve ya.
  const snap = await get(ref(db, `songs/data/${category}/songs`));
  const songs = snap.val();
  const index = Array.isArray(songs)
    ? songs.findIndex((s: any) => s && s.filename === filename)
    : -1;
  if (index < 0) throw new Error('No encuentro la canción en el cantoral');
  await Promise.all(
    Object.entries(fields).map(([field, value]) =>
      set(ref(db, `songs/data/${category}/songs/${index}/${field}`), value),
    ),
  );
  await set(ref(db, 'songs/updatedAt'), Date.now().toString());

  const edition = {
    filename,
    category,
    songIndex: index,
    ...changes,
    editedAt: new Date().toISOString(),
    timestamp: Date.now(),
    platform: Platform.OS,
  };

  // 2) El repo, por el admin del cantoral; si no, a la cola.
  try {
    const res = await call<{ pushed?: boolean; warning?: string }>(
      '/api/app/song/save',
      // El contenido que había puede no coincidir al carácter con el `.cho`
      // (la app no ve las directivas multimedia): manda lo nuevo.
      { json: { ...edition, force: true } },
    );
    return { where: 'repo', warning: res.warning };
  } catch (e) {
    logger.info('songEditor: a la cola', (e as Error).message);
    await pushWithRetry('songs/ediciones', { ...edition, status: 'applied' });
    return { where: 'queue' };
  }
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

/** Canción nueva: se crea en el repo; aparece en la app en un par de minutos. */
export async function createSong(args: {
  category: string;
  title: string;
  artist?: string;
  key?: string;
  capo?: number;
  content: string;
}): Promise<{ filename: string; pushed: boolean; warning?: string }> {
  return call('/api/app/song/new', { json: args });
}
