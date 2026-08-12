/**
 * "Modo Coro": un dispositivo líder publica la canción que está mirando
 * (y su tono) y N dispositivos oyentes la siguen en tiempo real.
 *
 * Desde el rediseño de coros, la sesión **cuelga del coro**: la clave del nodo
 * es el id del coro (`consolacion-castellon-4f2a`), así que unirse es "elijo mi
 * coro y ya" en vez de "que alguien me dicte 4 dígitos". Se siguen aceptando
 * claves de 4 dígitos para las sesiones sueltas por código (opción secundaria,
 * y los enlaces `/coro?c=1234` antiguos siguen funcionando).
 *
 * Estructura en Firebase Realtime Database:
 *
 *   /choirSessions/{choirId | code} = {
 *     v: 1,
 *     master: { deviceId, name?, lastSeen },
 *     choirId?, choirName?,
 *     playlist: SelectedSong[],
 *     current: { filename, transpose, screen?, updatedAt } | null,
 *     createdAt, startedAt, updatedAt, lastActivity, expiresAt
 *   }
 *
 * **La sesión caduca 24 h después de empezar** (`expiresAt = startedAt + 24h`)
 * y ese límite NO se estira al publicar: es un ensayo/celebración, no un canal
 * permanente. Quien quiera seguir, vuelve a tomar el mando y empieza otras 24 h.
 *
 * Sin permisos: cualquiera con la clave puede leer y escribir. Se asume un
 * grupo de confianza pequeño (20 dispositivos máx.) y baja frecuencia.
 */
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
} from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';
import { CODE_LENGTH, isValidCode } from '@/utils/playlistCodes';
import { isChoirId } from '@/utils/choirIds';

const ROOT = 'choirSessions';
/** Una sesión de coro dura como mucho un día desde que arranca. */
export const CHOIR_SESSION_TTL_MS = 1000 * 60 * 60 * 24;

export interface ChoirCurrentSong {
  filename: string;
  /** Semitonos sobre el tono original. */
  transpose: number;
  /** Override de cejilla publicado por el líder para esta canción. */
  capoOverride?: number | null;
  /** Marcador opcional: 'detail' (por defecto) o 'fullscreen'. */
  screen?: 'detail' | 'fullscreen';
  updatedAt: number;
  // Metadatos para que el oyente pueda renderizar la canción sin tener
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
  /** Momento en que el líder actual tomó el mando (base de la caducidad). */
  startedAt: number;
  updatedAt: number;
  lastActivity: number;
  expiresAt: number;
  /** Coro del que cuelga la sesión (ausente en las sesiones sueltas por código). */
  choirId?: string;
  choirName?: string;
}

/** ¿Es una clave válida de sesión? Un id de coro o un código de 4 dígitos. */
export function isSessionKey(key: string): boolean {
  return isValidCode(key) || isChoirId(key);
}

function getRef(key: string) {
  if (!isSessionKey(key)) {
    throw new Error(
      `Código inválido (deben ser ${CODE_LENGTH} dígitos o un id de coro)`,
    );
  }
  const db = getDatabase(getFirebaseApp());
  return ref(db, `${ROOT}/${key}`);
}

/**
 * ¿Sigue viva esta sesión? Una sesión caducada se queda en Firebase hasta que
 * pasa la purga, así que el cliente tiene que ignorarla por su cuenta.
 */
export function isSessionLive(
  session: ChoirSession | null | undefined,
  now = Date.now(),
): boolean {
  if (!session) return false;
  const expires =
    session.expiresAt ??
    (session.startedAt ?? session.createdAt ?? 0) + CHOIR_SESSION_TTL_MS;
  return expires > now;
}

/**
 * ¿Es `deviceId`/`name` la misma persona que lidera la sesión?
 *
 * El mismo dispositivo siempre lo es. Y si el usuario tiene nombre en su
 * perfil, también cuenta como "el mismo" desde otro móvil: es justo el caso de
 * "quiero dirigir desde la tablet", que no debería pedir contraseña.
 */
export function isSameLeader(
  session: ChoirSession | null | undefined,
  who: { deviceId: string; name?: string },
): boolean {
  if (!session) return true;
  if (session.master?.deviceId && session.master.deviceId === who.deviceId) {
    return true;
  }
  const leaderName = (session.master?.name ?? '').trim().toLowerCase();
  const myName = (who.name ?? '').trim().toLowerCase();
  return !!leaderName && leaderName === myName;
}

/** ¿Existe ya una sesión de coro con esa clave? */
export async function choirSessionExists(key: string): Promise<boolean> {
  const snap = await get(getRef(key));
  return snap.exists();
}

/** Lee la sesión asociada a `key` o devuelve null si no existe. */
export async function fetchChoirSession(
  key: string,
): Promise<ChoirSession | null> {
  const snap = await get(getRef(key));
  if (!snap.exists()) return null;
  return snap.val() as ChoirSession;
}

/** Lee la sesión solo si sigue viva (caducadas → null). */
export async function fetchLiveChoirSession(
  key: string,
): Promise<ChoirSession | null> {
  const session = await fetchChoirSession(key);
  return isSessionLive(session) ? session : null;
}

/**
 * Crea o reemplaza la sesión `key` con la playlist y líder dados. Tomar el
 * mando reinicia el contador de 24 h: `startedAt` vuelve a ser ahora.
 */
export async function createChoirSession(
  key: string,
  master: { deviceId: string; name?: string },
  playlist: SelectedSong[],
  opts?: { choirId?: string; choirName?: string; createdAt?: number },
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
    createdAt: opts?.createdAt ?? now,
    startedAt: now,
    updatedAt: now,
    lastActivity: now,
    expiresAt: now + CHOIR_SESSION_TTL_MS,
    choirId: opts?.choirId,
    choirName: opts?.choirName,
  };
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  await set(getRef(key), cleanPayload);
  return payload;
}

/** Cambia la playlist publicada por el líder. */
export async function publishChoirPlaylist(
  key: string,
  playlist: SelectedSong[],
): Promise<void> {
  const now = Date.now();
  const updatePayload = {
    playlist,
    updatedAt: now,
    lastActivity: now,
    'master/lastSeen': now,
  };
  await update(getRef(key), JSON.parse(JSON.stringify(updatePayload)));
}

/** Cambia la "canción actual" que el líder está mostrando. */
export async function publishChoirCurrent(
  key: string,
  current: Omit<ChoirCurrentSong, 'updatedAt'>,
): Promise<void> {
  const now = Date.now();
  const updatePayload = {
    current: { ...current, updatedAt: now },
    updatedAt: now,
    lastActivity: now,
    'master/lastSeen': now,
  };
  await update(getRef(key), JSON.parse(JSON.stringify(updatePayload)));
}

/** Suscripción en tiempo real. Devuelve la función `unsubscribe`. */
export function subscribeChoirSession(
  key: string,
  onChange: (session: ChoirSession | null) => void,
  onError?: (err: Error) => void,
): () => void {
  const r = getRef(key);
  const unsubscribe = onValue(
    r,
    (snap) => {
      const session = snap.exists() ? (snap.val() as ChoirSession) : null;
      // Una sesión caducada equivale a que no la haya: así el oyente sale solo
      // cuando pasan las 24 h, sin que nadie tenga que cerrarla a mano.
      onChange(isSessionLive(session) ? session : null);
    },
    (err) => onError?.(err),
  );
  return unsubscribe;
}

/** Borra la sesión (cierre manual por el líder). */
export async function closeChoirSession(key: string): Promise<void> {
  await remove(getRef(key));
}

/**
 * Mueve la sesión de `oldKey` a `newKey`. Falla si `newKey` está ocupada.
 */
export async function changeChoirSessionCode(
  oldKey: string,
  newKey: string,
): Promise<ChoirSession> {
  if (oldKey === newKey) {
    const cur = await fetchChoirSession(oldKey);
    if (!cur) throw new Error('La sesión ya no existe');
    return cur;
  }
  if (await choirSessionExists(newKey)) {
    throw new Error('El nuevo código ya está en uso');
  }
  const cur = await fetchChoirSession(oldKey);
  if (!cur) throw new Error('La sesión original ya no existe');
  const moved: ChoirSession = { ...cur, updatedAt: Date.now() };
  await set(getRef(newKey), JSON.parse(JSON.stringify(moved)));
  await remove(getRef(oldKey));
  return moved;
}
