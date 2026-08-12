/**
 * Directorio de **coros** en Firebase Realtime Database.
 *
 * Un coro es la entidad de la que cuelga todo lo demás: sus playlists
 * históricas y su sesión en vivo. La idea es que nadie tenga que acordarse de
 * códigos: eliges tu coro una vez y a partir de ahí importas «la última» o
 * subes la de hoy.
 *
 *   /choirs/{choirId} = {
 *     v: 1,
 *     name: "Coro Consolación Castellón",
 *     nameKey: "coro-consolacion-castellon",     ← para detectar duplicados
 *     createdAt, updatedAt,
 *     createdBy: { deviceId, name? },            ← quién lo creó (para el panel)
 *     playlists: {
 *       "1234": { name, createdAt, updatedAt, songCount, by?, ownerDeviceId? }
 *     }
 *   }
 *
 * El **contenido** de cada playlist NO se duplica aquí: sigue viviendo en
 * `/playlistShares/{code}` (ver `cloudPlaylistService`). Este nodo es solo el
 * índice, para poder pintar la lista de un coro con una sola lectura ligera.
 *
 * Sin permisos: cualquiera puede crear un coro y subirle playlists. Borrar un
 * coro se hace desde el panel de admin (por eso guardamos `createdBy`).
 */
import { getDatabase, ref, get, set, update, remove } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import {
  choirNameKey,
  isChoirId,
  makeChoirId,
  normalizeChoirName,
} from '@/utils/choirIds';
import {
  latestChoirPlaylist,
  sortChoirPlaylists,
  type ChoirPlaylistEntry,
} from '@/utils/playlistSync';

const ROOT = 'choirs';

export type { ChoirPlaylistEntry };

export interface ChoirAuthor {
  deviceId: string;
  name?: string;
}

export interface Choir {
  id: string;
  v: 1;
  name: string;
  nameKey: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: ChoirAuthor;
  /** Índice de playlists, indexado por código de 4 dígitos. */
  playlists: Record<string, ChoirPlaylistEntry>;
}

function choirRef(choirId: string) {
  if (!isChoirId(choirId)) {
    throw new Error('Identificador de coro inválido');
  }
  return ref(getDatabase(getFirebaseApp()), `${ROOT}/${choirId}`);
}

/** Normaliza lo que viene de Firebase (puede faltar `playlists`, venir sin id…). */
function hydrate(id: string, raw: any): Choir {
  const playlists: Record<string, ChoirPlaylistEntry> = {};
  for (const [code, entry] of Object.entries(raw?.playlists ?? {})) {
    const e = entry as Partial<ChoirPlaylistEntry>;
    playlists[code] = {
      code,
      name: e?.name || `Playlist ${code}`,
      createdAt: e?.createdAt ?? 0,
      updatedAt: e?.updatedAt ?? e?.createdAt ?? 0,
      songCount: e?.songCount ?? 0,
      ...(e?.by ? { by: e.by } : {}),
      ...(e?.ownerDeviceId ? { ownerDeviceId: e.ownerDeviceId } : {}),
    };
  }
  return {
    id,
    v: 1,
    name: raw?.name || id,
    nameKey: raw?.nameKey || choirNameKey(raw?.name || id),
    createdAt: raw?.createdAt ?? 0,
    updatedAt: raw?.updatedAt ?? raw?.createdAt ?? 0,
    ...(raw?.createdBy ? { createdBy: raw.createdBy as ChoirAuthor } : {}),
    playlists,
  };
}

/**
 * Todos los coros, ordenados por nombre. Se espera un puñado (5-10), así que
 * traerlos de golpe es más barato que cualquier paginación.
 */
export async function listChoirs(): Promise<Choir[]> {
  const snap = await get(ref(getDatabase(getFirebaseApp()), ROOT));
  if (!snap.exists()) return [];
  const raw = snap.val() as Record<string, unknown>;
  return Object.entries(raw)
    .map(([id, value]) => hydrate(id, value))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Un coro concreto, o null si ya no existe (lo borró el panel). */
export async function fetchChoir(choirId: string): Promise<Choir | null> {
  const snap = await get(choirRef(choirId));
  if (!snap.exists()) return null;
  return hydrate(choirId, snap.val());
}

/**
 * Crea un coro nuevo. Si ya hay uno con el mismo nombre (ignorando mayúsculas
 * y acentos) lanza error con el nombre existente: es casi siempre lo que el
 * usuario quería usar, no uno nuevo.
 */
export async function createChoir(
  rawName: string,
  createdBy: ChoirAuthor,
): Promise<Choir> {
  const name = normalizeChoirName(rawName);
  if (name.length < 3) {
    throw new Error('El nombre del coro es demasiado corto');
  }
  const nameKey = choirNameKey(name);
  const existing = await listChoirs();
  const clash = existing.find((c) => c.nameKey === nameKey);
  if (clash) {
    throw new Error(`Ya existe «${clash.name}». Elígelo en la lista.`);
  }

  const now = Date.now();
  const id = makeChoirId(name);
  const payload = {
    v: 1 as const,
    name,
    nameKey,
    createdAt: now,
    updatedAt: now,
    createdBy: {
      deviceId: createdBy.deviceId,
      ...(createdBy.name ? { name: createdBy.name } : {}),
    },
  };
  await set(choirRef(id), payload);
  return { ...payload, id, playlists: {} };
}

/** Renombra un coro (lo usa sobre todo el panel; la app lo deja a mano). */
export async function renameChoir(
  choirId: string,
  rawName: string,
): Promise<void> {
  const name = normalizeChoirName(rawName);
  if (name.length < 3) throw new Error('El nombre del coro es demasiado corto');
  await update(choirRef(choirId), {
    name,
    nameKey: choirNameKey(name),
    updatedAt: Date.now(),
  });
}

/** Borra el coro entero (panel de admin). No toca `/playlistShares`. */
export async function deleteChoir(choirId: string): Promise<void> {
  await remove(choirRef(choirId));
}

/**
 * Da de alta (o actualiza) una playlist en el índice del coro. Se llama justo
 * después de subir el contenido a `/playlistShares/{code}`.
 */
export async function upsertChoirPlaylist(
  choirId: string,
  entry: ChoirPlaylistEntry,
): Promise<void> {
  const now = Date.now();
  const value = {
    name: entry.name,
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || now,
    songCount: entry.songCount,
    ...(entry.by ? { by: entry.by } : {}),
    ...(entry.ownerDeviceId ? { ownerDeviceId: entry.ownerDeviceId } : {}),
  };
  // Una sola escritura multi-path: la entrada y el `updatedAt` del coro (que
  // es lo que ordena la lista de coros por actividad en el panel).
  await update(choirRef(choirId), {
    [`playlists/${entry.code}`]: value,
    updatedAt: now,
  });
}

/** Quita una playlist del índice del coro (no borra el contenido compartido). */
export async function removeChoirPlaylist(
  choirId: string,
  code: string,
): Promise<void> {
  await update(choirRef(choirId), {
    [`playlists/${code}`]: null,
    updatedAt: Date.now(),
  });
}

/** Las playlists de un coro, ya ordenadas (la más reciente primero). */
export function choirPlaylists(choir: Choir): ChoirPlaylistEntry[] {
  return sortChoirPlaylists(Object.values(choir.playlists));
}

/** La playlist más reciente de un coro — lo que importa «importar la última». */
export function choirLatestPlaylist(choir: Choir): ChoirPlaylistEntry | null {
  return latestChoirPlaylist(Object.values(choir.playlists));
}
