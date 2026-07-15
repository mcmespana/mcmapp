import { logger } from '@/utils/logger';
import { getDatabase, ref, update, get, set, remove } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import type { DayRecord } from '@/hooks/useContigoHabits';
import type { StoredBookmark } from '@/utils/contigoBookmarks';

function db() {
  return getDatabase(getFirebaseApp());
}

/** RTDB rechaza valores `undefined`. Elimina recursivamente las claves cuyo
 *  valor sea `undefined` antes de escribir. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export interface UserMCMData {
  profileType: string | null;
  delegationId: string | null;
  onboardingCompleted: boolean;
}

/** Crea o actualiza el nodo del usuario en RTDB tras login. */
export async function writeUserOnLogin(
  uid: string,
  displayName: string | null,
  email: string | null,
  photoURL: string | null,
  provider: 'google' | 'apple',
  mcm: UserMCMData,
): Promise<void> {
  try {
    const userRef = ref(db(), `users/${uid}`);
    const now = Date.now();

    await update(userRef, {
      displayName: displayName ?? null,
      email: email ?? null,
      photoURL: photoURL ?? null,
      provider,
      'mcm/profileType': mcm.profileType ?? null,
      'mcm/delegationId': mcm.delegationId ?? null,
      'mcm/onboardingCompleted': mcm.onboardingCompleted,
      'meta/lastSeenAt': now,
    });

    // Poner createdAt solo si aún no existe
    const createdAtRef = ref(db(), `users/${uid}/meta/createdAt`);
    const snap = await get(createdAtRef);
    if (!snap.exists()) {
      await set(createdAtRef, now);
    }
  } catch (err) {
    logger.error('[authHelpers] writeUserOnLogin:', err);
  }
}

/** Actualiza solo los datos MCM (perfil / delegación) del usuario en RTDB. */
export async function updateUserMCMData(
  uid: string,
  mcm: UserMCMData,
): Promise<void> {
  try {
    const userRef = ref(db(), `users/${uid}`);
    await update(userRef, {
      'mcm/profileType': mcm.profileType ?? null,
      'mcm/delegationId': mcm.delegationId ?? null,
      'mcm/onboardingCompleted': mcm.onboardingCompleted,
    });
  } catch (err) {
    logger.error('[authHelpers] updateUserMCMData:', err);
  }
}

/** Elimina por completo el nodo del usuario en RTDB (`users/{uid}`), lo que
 *  incluye perfil, delegación y todos los datos de CONTIGO (hábitos,
 *  revisiones, bookmarks). Se usa al eliminar la cuenta. Lanza si falla para
 *  que el llamador pueda decidir cómo actuar. */
export async function deleteUserData(uid: string): Promise<void> {
  const userRef = ref(db(), `users/${uid}`);
  await remove(userRef);
}

/** Sincroniza un registro de hábito de CONTIGO con RTDB. */
export async function syncContigoHabit(
  uid: string,
  date: string,
  record: DayRecord,
): Promise<void> {
  try {
    const habitRef = ref(db(), `users/${uid}/contigo/habits/${date}`);
    await set(habitRef, stripUndefined(record));
  } catch (err) {
    logger.error('[authHelpers] syncContigoHabit:', err);
  }
}

/** Sincroniza un bookmark de evangelio con RTDB.
 *
 *  A diferencia del nodo global `seccion_oracion/lecturas/*` (que un Job limpia
 *  pasados 30 días), este bookmark guarda el TEXTO COMPLETO de las lecturas bajo
 *  el subárbol del propio usuario. El crecimiento es acotado (solo los días que
 *  el usuario guarda, y por usuario), así que se conserva para siempre sin
 *  hinchar la base común: el bookmark sobrevive al borrado a 30 días y se puede
 *  restaurar en otro dispositivo. Pasa `null` para eliminarlo. */
export async function syncContigoBookmark(
  uid: string,
  date: string,
  bookmark: StoredBookmark | null,
): Promise<void> {
  try {
    const bookmarkRef = ref(db(), `users/${uid}/contigo/bookmarks/${date}`);
    if (bookmark === null) {
      await remove(bookmarkRef);
    } else {
      await set(bookmarkRef, stripUndefined(bookmark));
    }
  } catch (err) {
    logger.error('[authHelpers] syncContigoBookmark:', err);
  }
}

/** Descarga todos los bookmarks de CONTIGO del usuario desde RTDB (con texto
 *  completo). Se usa para hidratar el almacenamiento local tras iniciar sesión
 *  o cambiar de dispositivo, de forma que los guardados no se pierdan aunque el
 *  nodo global de lecturas ya se haya limpiado. */
export async function fetchContigoBookmarks(
  uid: string,
): Promise<StoredBookmark[]> {
  try {
    const bookmarksRef = ref(db(), `users/${uid}/contigo/bookmarks`);
    const snap = await get(bookmarksRef);
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, StoredBookmark>;
    return Object.values(val).filter(
      (b): b is StoredBookmark => !!b && typeof b === 'object' && !!b.date,
    );
  } catch (err) {
    logger.error('[authHelpers] fetchContigoBookmarks:', err);
    return [];
  }
}

/** Sincroniza una revisión diaria de CONTIGO con RTDB. */
export async function syncContigoRevision(
  uid: string,
  date: string,
  data: {
    type: string;
    grateful: { mode: string; items: string[]; revision: string };
  },
): Promise<void> {
  try {
    const revisionRef = ref(db(), `users/${uid}/contigo/revisions/${date}`);
    await set(revisionRef, stripUndefined(data));
  } catch (err) {
    logger.error('[authHelpers] syncContigoRevision:', err);
  }
}
