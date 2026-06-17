import { getDatabase, get, ref, set } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';

/**
 * Identidad real en encuestas (mejora 11.6).
 *
 * Las respuestas se siguen guardando por `deviceId` (escritura pública sin
 * login). Cuando el usuario ha iniciado sesión añadimos `userId` (uid) a la
 * respuesta y, además, escribimos un marcador en su propio nodo
 * `users/<uid>/surveysAnswered/<scope>`. Ese marcador permite:
 *
 *   - **Dedup entre dispositivos**: si la misma persona abre la encuesta en otro
 *     móvil, `hasUserAnswered` la detecta y se bloquea el reenvío.
 *   - **Analítica por persona** en el panel (atribuir respuestas a un `userId`).
 *
 * El `scope` es una clave estable y única por encuesta (reutilizamos la misma
 * clave anti-duplicado local, p. ej. `survey_done_<id>` / `evaluacion_done_app`).
 * Las reglas RTDB ya permiten al dueño (`auth.uid === uid`) leer/escribir bajo
 * `users/<uid>`, así que no hace falta tocar `database.rules.json`.
 */

export const userAnsweredPath = (uid: string, scope: string): string =>
  `users/${uid}/surveysAnswered/${scope}`;

/** ¿Este usuario autenticado ya respondió esta encuesta (en cualquier dispositivo)? */
export async function hasUserAnswered(
  uid: string,
  scope: string,
): Promise<boolean> {
  try {
    const db = getDatabase(getFirebaseApp());
    const snap = await get(ref(db, userAnsweredPath(uid, scope)));
    return snap.exists();
  } catch {
    return false;
  }
}

/** Marca que este usuario respondió la encuesta (para dedup entre dispositivos). */
export async function markUserAnswered(
  uid: string,
  scope: string,
  surveyId?: string,
): Promise<void> {
  const db = getDatabase(getFirebaseApp());
  await set(ref(db, userAnsweredPath(uid, scope)), {
    at: Date.now(),
    ...(surveyId ? { surveyId } : {}),
  });
}

/**
 * Construye los campos de identidad que se adjuntan a la respuesta. Devuelve
 * `{}` si la encuesta es anónima. Incluye `userId` solo si hay sesión.
 */
export function buildIdentityFields(opts: {
  anonymous?: boolean;
  authUid?: string | null;
  name: string;
  profileType?: string | null;
  delegationLabel?: string;
}): Record<string, string> {
  if (opts.anonymous) return {};
  const fields: Record<string, string> = {
    userName: opts.name || 'Anónimo',
    userProfileType: opts.profileType ?? 'sin-perfil',
    userDelegation: opts.delegationLabel || 'Sin delegación',
  };
  if (opts.authUid) fields.userId = opts.authUid;
  return fields;
}
