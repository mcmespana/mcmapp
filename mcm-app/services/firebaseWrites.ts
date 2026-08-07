/**
 * Costura única de las escrituras de UI a Firebase RTDB.
 *
 * Antes, cada formulario repetía el ritual completo —
 * `getDatabase(getFirebaseApp())` → `ref` → `push`/`set` — repartido por ~10
 * archivos, y cada uno re-decidía por su cuenta el manejo de error. Mientras
 * `useFirebaseData` ganaba reintentos con espera creciente (`withRetry`),
 * **ninguna escritura se beneficiaba**: una evaluación o un reporte de bug
 * enviados con el wifi flojo se perdían con un toast de error y sin reintento.
 *
 * Estas dos primitivas no tienen lógica de dominio: cada caller sigue
 * decidiendo su ruta y su payload (el panel los lee, así que ni un byte cambia).
 * Lo que centralizan es el mecanismo.
 *
 * **Idempotencia del retry**: reintentar un `push` + `set` sería incorrecto si
 * la key se regenerara en cada intento (crearía duplicados). Por eso
 * `pushWithRetry` genera la key UNA vez y reintenta solo el `set`, que sí es
 * idempotente: misma key, mismo valor.
 */
import { getDatabase, ref, push, set, update } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { withRetry } from '@/hooks/useFirebaseData';
import { logger } from '@/utils/logger';

/**
 * RTDB rechaza `undefined`. Se limpia igual que en `cloudPlaylistService`, con
 * el viaje por JSON (que además congela el payload: los reintentos escriben
 * exactamente el mismo valor).
 */
function clean<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload));
}

/**
 * `push` + `set` con reintentos. Devuelve la key generada.
 *
 * La key se genera antes del primer intento y no cambia: si el `set` falla por
 * red, se reintenta sobre la MISMA key, así que no puede duplicar la entrada.
 */
export async function pushWithRetry(
  path: string,
  payload: unknown,
): Promise<string> {
  const db = getDatabase(getFirebaseApp());
  const childRef = push(ref(db, path));
  const value = clean(payload);
  try {
    await withRetry(async () => {
      await set(childRef, value);
    });
  } catch (error) {
    // Sin el payload en el log: puede llevar texto escrito por el usuario.
    logger.error(`[firebaseWrites] fallo escribiendo en ${path}`, error);
    throw error;
  }
  return childRef.key as string;
}

/**
 * `set` con reintentos sobre una ruta concreta. Acepta escalares además de
 * objetos: hay rutas que guardan un valor suelto (p. ej. `songs/updatedAt`).
 */
export async function setWithRetry(
  path: string,
  payload: unknown,
): Promise<void> {
  const db = getDatabase(getFirebaseApp());
  const target = ref(db, path);
  const value = clean(payload);
  try {
    await withRetry(async () => {
      await set(target, value);
    });
  } catch (error) {
    logger.error(`[firebaseWrites] fallo escribiendo en ${path}`, error);
    throw error;
  }
}

/**
 * Genera una key nueva bajo `path` SIN escribir nada.
 *
 * La necesitan las escrituras multi-path: hay que conocer la key antes de
 * construir el payload de `update`. Sacarla de aquí es lo que permite que los
 * callers no importen nada de `firebase/database`.
 */
export function pushKey(path: string): string {
  const db = getDatabase(getFirebaseApp());
  const key = push(ref(db, path)).key;
  if (!key) throw new Error(`push() no devolvió key para ${path}`);
  return key;
}

/**
 * `update` multi-path con reintentos. Es la primitiva de las escrituras
 * ATÓMICAS: un solo `update` con claves con `/` escribe (y borra, con `null`)
 * varias rutas a la vez, que es lo que evita, por ejemplo, que una reflexión
 * quede escrita pero invisible porque el `updatedAt` no llegó a cambiar.
 *
 * Reintentar es seguro porque el payload es fijo: las keys se generan antes
 * (ver `pushKey`), así que el segundo intento escribe exactamente lo mismo.
 */
export async function updateWithRetry(
  path: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getDatabase(getFirebaseApp());
  const target = ref(db, path);
  const value = clean(payload);
  try {
    await withRetry(async () => {
      await update(target, value);
    });
  } catch (error) {
    logger.error(`[firebaseWrites] fallo actualizando ${path}`, error);
    throw error;
  }
}
