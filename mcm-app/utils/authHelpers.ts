import { getDatabase, ref, update, get, set, remove } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import type { DayRecord } from '@/hooks/useContigoHabits';

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
    console.error('[authHelpers] writeUserOnLogin:', err);
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
    console.error('[authHelpers] updateUserMCMData:', err);
  }
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
    console.error('[authHelpers] syncContigoHabit:', err);
  }
}

/** Sincroniza los metadatos de un bookmark de evangelio con RTDB. Solo guarda
 *  la cita y la fecha, NO el texto completo del evangelio. */
export async function syncContigoBookmark(
  uid: string,
  date: string,
  bookmark: {
    bookmarkedAt: number;
    cita: string;
    diaLiturgico?: string;
  } | null,
): Promise<void> {
  try {
    const bookmarkRef = ref(db(), `users/${uid}/contigo/bookmarks/${date}`);
    if (bookmark === null) {
      await remove(bookmarkRef);
    } else {
      await set(bookmarkRef, stripUndefined(bookmark));
    }
  } catch (err) {
    console.error('[authHelpers] syncContigoBookmark:', err);
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
    console.error('[authHelpers] syncContigoRevision:', err);
  }
}
