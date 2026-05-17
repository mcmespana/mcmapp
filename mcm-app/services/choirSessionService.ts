/**
 * "Modo Coro": un dispositivo maestro publica la canción que está mirando
 * (y su tono) y N dispositivos esclavos la siguen en tiempo real.
 *
 * Estructura en Firebase Realtime Database:
 *
 *   /choirSessions/{code} = {
 *     v: 1,
 *     master: { deviceId, name?, lastSeen },
 *     playlist: SelectedSong[],
 *     current: { filename, transpose, screen?, updatedAt } | null,
 *     createdAt, updatedAt, lastActivity, expiresAt
 *   }
 *
 * Sin permisos: cualquiera con el código puede leer y escribir. Se asume
 * un grupo de confianza pequeño (20 dispositivos máx.) y baja frecuencia.
 */
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  off,
} from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';
import { CODE_LENGTH, isValidCode } from '@/utils/playlistCodes';

const ROOT = 'choirSessions';
const TWO_WEEKS_MS = 1000 * 60 * 60 * 24 * 14;

export interface ChoirCurrentSong {
  filename: string;
  /** Semitonos sobre el tono original. */
  transpose: number;
  /** Marcador opcional: 'detail' (por defecto) o 'fullscreen'. */
  screen?: 'detail' | 'fullscreen';
  updatedAt: number;
  // Metadatos para que el esclavo pueda renderizar la canción sin tener
  // que buscarla en su cantoral local (puede ser una canción que ni
  // siquiera está en su selección).
  title?: string;
  author?: string;
  songKey?: string;
  capo?: number;
  content?: string;
  firebaseCategory?: string;
}

export interface ChoirSessionMaster {
  deviceId: string;
  name?: string;
  lastSeen: number;
}

export interface ChoirSession {
  v: 1;
  master: ChoirSessionMaster;
  playlist: SelectedSong[];
  current: ChoirCurrentSong | null;
  createdAt: number;
  updatedAt: number;
  lastActivity: number;
  expiresAt: number;
}

function getRef(code: string) {
  if (!isValidCode(code)) {
    throw new Error(`Código inválido (deben ser ${CODE_LENGTH} dígitos)`);
  }
  const db = getDatabase(getFirebaseApp());
  return ref(db, `${ROOT}/${code}`);
}

/** ¿Existe ya una sesión de coro con ese código? */
export async function choirSessionExists(code: string): Promise<boolean> {
  const snap = await get(getRef(code));
  return snap.exists();
}

/** Lee la sesión asociada a `code` o devuelve null si no existe. */
export async function fetchChoirSession(
  code: string,
): Promise<ChoirSession | null> {
  const snap = await get(getRef(code));
  if (!snap.exists()) return null;
  return snap.val() as ChoirSession;
}

/**
 * Crea o reemplaza la sesión de coro `code` con la playlist y maestro dados.
 * Si ya existe, se sobrescribe (caller debe haber confirmado).
 */
export async function createChoirSession(
  code: string,
  master: { deviceId: string; name?: string },
  playlist: SelectedSong[],
): Promise<ChoirSession> {
  const now = Date.now();
  const payload: ChoirSession = {
    v: 1,
    master: {
      deviceId: master.deviceId,
      name: master.name,
      lastSeen: now,
    },
    playlist,
    current: null,
    createdAt: now,
    updatedAt: now,
    lastActivity: now,
    expiresAt: now + TWO_WEEKS_MS,
  };
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  await set(getRef(code), cleanPayload);
  return payload;
}

/** Cambia la playlist publicada por el maestro. */
export async function publishChoirPlaylist(
  code: string,
  playlist: SelectedSong[],
): Promise<void> {
  const now = Date.now();
  const updatePayload = {
    playlist,
    updatedAt: now,
    lastActivity: now,
    expiresAt: now + TWO_WEEKS_MS,
    'master/lastSeen': now,
  };
  await update(getRef(code), JSON.parse(JSON.stringify(updatePayload)));
}

/** Cambia la "canción actual" que el maestro está mostrando. */
export async function publishChoirCurrent(
  code: string,
  current: Omit<ChoirCurrentSong, 'updatedAt'>,
): Promise<void> {
  const now = Date.now();
  const updatePayload = {
    current: { ...current, updatedAt: now },
    updatedAt: now,
    lastActivity: now,
    expiresAt: now + TWO_WEEKS_MS,
    'master/lastSeen': now,
  };
  await update(getRef(code), JSON.parse(JSON.stringify(updatePayload)));
}

/** Suscripción en tiempo real. Devuelve la función `unsubscribe`. */
export function subscribeChoirSession(
  code: string,
  onChange: (session: ChoirSession | null) => void,
  onError?: (err: Error) => void,
): () => void {
  const r = getRef(code);
  const handler = onValue(
    r,
    (snap) => {
      onChange(snap.exists() ? (snap.val() as ChoirSession) : null);
    },
    (err) => onError?.(err),
  );
  return () => off(r, 'value', handler);
}

/** Borra la sesión (cierre manual por el maestro). */
export async function closeChoirSession(code: string): Promise<void> {
  await remove(getRef(code));
}

/**
 * Mueve la sesión de `oldCode` a `newCode`. Falla si `newCode` está ocupado.
 */
export async function changeChoirSessionCode(
  oldCode: string,
  newCode: string,
): Promise<ChoirSession> {
  if (oldCode === newCode) {
    const cur = await fetchChoirSession(oldCode);
    if (!cur) throw new Error('La sesión ya no existe');
    return cur;
  }
  if (await choirSessionExists(newCode)) {
    throw new Error('El nuevo código ya está en uso');
  }
  const cur = await fetchChoirSession(oldCode);
  if (!cur) throw new Error('La sesión original ya no existe');
  const moved: ChoirSession = { ...cur, updatedAt: Date.now() };
  await set(getRef(newCode), JSON.parse(JSON.stringify(moved)));
  await remove(getRef(oldCode));
  return moved;
}
