/**
 * Subida / descarga de playlists a Firebase Realtime Database bajo un código
 * corto de 4 dígitos. Sin permisos: cualquiera con el código puede leerla,
 * sobrescribirla o borrarla.
 *
 * Las playlists incluyen `expiresAt` con +6 meses sobre el momento de
 * creación; la purga real se hace por backend más adelante.
 */
import { getDatabase, ref, get, set, remove } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';
import { CODE_LENGTH, isValidCode } from '@/utils/playlistCodes';

const ROOT = 'playlistShares';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export interface CloudPlaylist {
  v: 2;
  songs: SelectedSong[];
  name?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

function getRef(code: string) {
  if (!isValidCode(code)) {
    throw new Error(`Código inválido (deben ser ${CODE_LENGTH} dígitos)`);
  }
  const db = getDatabase(getFirebaseApp());
  return ref(db, `${ROOT}/${code}`);
}

/** ¿Existe ya una playlist con ese código? */
export async function cloudPlaylistExists(code: string): Promise<boolean> {
  const snap = await get(getRef(code));
  return snap.exists();
}

/** Lee la playlist asociada a `code` o devuelve null si no existe. */
export async function fetchCloudPlaylist(
  code: string,
): Promise<CloudPlaylist | null> {
  const snap = await get(getRef(code));
  if (!snap.exists()) return null;
  const val = snap.val() as CloudPlaylist;
  // Limpieza "perezosa": si está caducada, la borramos y simulamos no existir.
  if (val.expiresAt && Date.now() > val.expiresAt) {
    try {
      await remove(getRef(code));
    } catch {
      // ignore
    }
    return null;
  }
  return val;
}

/**
 * Sube `songs` bajo `code`. Si `code` ya existe, sobrescribe.
 * Si quieres prevenir colisiones, llama antes a {@link cloudPlaylistExists}.
 */
export async function uploadCloudPlaylist(
  code: string,
  songs: SelectedSong[],
  opts?: { name?: string; createdAt?: number },
): Promise<CloudPlaylist> {
  const now = Date.now();
  const payload: CloudPlaylist = {
    v: 2,
    songs,
    name: opts?.name,
    createdAt: opts?.createdAt ?? now,
    updatedAt: now,
    expiresAt: now + SIX_MONTHS_MS,
  };
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  await set(getRef(code), cleanPayload);
  return payload;
}

/** Borra la playlist asociada a `code`. */
export async function deleteCloudPlaylist(code: string): Promise<void> {
  await remove(getRef(code));
}

/**
 * Mueve la playlist de `oldCode` a `newCode`. Preserva createdAt.
 * Si `newCode` ya existe, lanza error (el caller decide qué hacer).
 */
export async function changeCloudPlaylistCode(
  oldCode: string,
  newCode: string,
): Promise<CloudPlaylist> {
  if (oldCode === newCode) {
    const cur = await fetchCloudPlaylist(oldCode);
    if (!cur) throw new Error('La playlist ya no existe');
    return cur;
  }
  if (await cloudPlaylistExists(newCode)) {
    throw new Error('El nuevo código ya está en uso');
  }
  const cur = await fetchCloudPlaylist(oldCode);
  if (!cur) throw new Error('La playlist original ya no existe');
  const moved = await uploadCloudPlaylist(newCode, cur.songs, {
    name: cur.name,
    createdAt: cur.createdAt,
  });
  await deleteCloudPlaylist(oldCode);
  return moved;
}
