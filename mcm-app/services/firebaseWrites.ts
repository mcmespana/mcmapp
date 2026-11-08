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
 * Tiempo máximo que esperamos al servidor antes de rendirnos.
 *
 * `set()` de RTDB solo se resuelve cuando el SERVIDOR confirma la escritura.
 * Sin red (o con una conexión medio muerta) no se resuelve NI se rechaza: la
 * promesa se queda colgada para siempre y la escritura queda en la cola del
 * SDK. `withRetry` solo reintenta cuando algo se rechaza, así que nunca
 * llegaba a actuar y el botón se quedaba en «Enviando…» hasta el infinito sin
 * haber enviado nada. Con este tope, la UI recibe un error y puede avisar.
 */
export const WRITE_TIMEOUT_MS = 12_000;

export class WriteTimeoutError extends Error {
  constructor(path: string) {
    super(`Sin respuesta del servidor al escribir en ${path}`);
    this.name = 'WriteTimeoutError';
  }
}

function withWriteTimeout<T>(promise: Promise<T>, path: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new WriteTimeoutError(path)),
      WRITE_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
    await withWriteTimeout(
      withRetry(() => set(newRef, clean), { op: 'write', path }),
      path,
    );
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
    await withWriteTimeout(
      withRetry(() => set(targetRef, clean), { op: 'write', path }),
      path,
    );
  } catch (err) {
    if (!isPermissionDenied(err)) {
      logger.error(`[firebaseWrites] setWithRetry falló en ${path}:`, err);
    }
    throw err;
  }
}
