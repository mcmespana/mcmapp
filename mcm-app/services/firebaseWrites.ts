/**
 * Costura común para las escrituras de UI a Firebase (feedback, bugs,
 * sugerencias, evaluaciones, encuestas, reflexiones…). Antes cada pantalla
 * repetía el ritual `getDatabase(getFirebaseApp())` → `ref` → `push`/`set` a
 * mano, sin ningún reintento — una evaluación enviada con wifi flojo se
 * perdía con un toast de error, mientras que `useFirebaseData` (lecturas)
 * llevaba tiempo con `withRetry`. Estas dos primitivas dan reintento con
 * backoff a las escrituras también, sin lógica de dominio: cada caller sigue
 * decidiendo su ruta y forma de payload.
 */
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { withRetry } from '@/hooks/useFirebaseData';
import { isPermissionDenied } from '@/utils/firebaseErrors';
import { logger } from '@/utils/logger';

/** RTDB rechaza `undefined`; lo quitamos igual que ya hacían los servicios
 *  existentes (`cloudPlaylistService.ts`, `choirSessionService.ts`). No-op
 *  para valores escalares (string/number/boolean) — RTDB también acepta
 *  escribir un escalar directamente en una ruta, no solo objetos. */
function cleanPayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload));
}

/**
 * `push` + `set` con retry SEGURO: la key se genera UNA sola vez (antes de
 * cualquier reintento) y solo se reintenta el `set` — eso sí es idempotente
 * (misma key, mismo valor). Regenerar la key en cada intento crearía
 * entradas duplicadas si un intento anterior en realidad sí había llegado.
 *
 * Devuelve la key generada.
 */
export async function pushWithRetry(
  path: string,
  payload: unknown,
): Promise<string> {
  const db = getDatabase(getFirebaseApp());
  const newRef = push(ref(db, path));
  if (!newRef.key) throw new Error(`push() sin key en ${path}`);
  const clean = cleanPayload(payload);

  try {
    await withRetry(() => set(newRef, clean), { op: 'write', path });
  } catch (err) {
    // `withRetry` ya reportó la denegación de reglas con su path; aquí solo
    // registramos los fallos que NO son de permisos, para no duplicar evento.
    if (!isPermissionDenied(err)) {
      logger.error(`[firebaseWrites] pushWithRetry falló en ${path}:`, err);
    }
    throw err;
  }
  return newRef.key;
}

/** `set` con retry sobre una ruta concreta (sobrescribe lo que hubiera). */
export async function setWithRetry(
  path: string,
  payload: unknown,
): Promise<void> {
  const db = getDatabase(getFirebaseApp());
  const targetRef = ref(db, path);
  const clean = cleanPayload(payload);

  try {
    await withRetry(() => set(targetRef, clean), { op: 'write', path });
  } catch (err) {
    if (!isPermissionDenied(err)) {
      logger.error(`[firebaseWrites] setWithRetry falló en ${path}:`, err);
    }
    throw err;
  }
}
