/**
 * Mutex por clave para los ciclos `getItem → parse → mutar → setItem` de
 * AsyncStorage.
 *
 * Sin serializar, dos ciclos que se intercalan hacen que el segundo `setItem`
 * escriba una copia obsoleta y el cambio del primero desaparezca: dos pushes
 * casi simultáneos, un push llegando mientras el usuario toca otro, o el merge
 * remoto de subrayados al iniciar sesión mientras el usuario guarda uno. Todos
 * los fallos son silenciosos (cada `catch` loguea y sigue), así que se
 * manifiestan como notificaciones que se esfuman del historial, notificaciones
 * que reaparecen como no leídas, o subrayados perdidos.
 *
 * El lock vive DENTRO de los helpers de escritura, no en los callers: así no hay
 * forma de olvidarse de cogerlo en un sitio nuevo.
 *
 * Regla para el futuro: todo ciclo `getItem → mutar → setItem` sobre una clave
 * compartida pasa por aquí.
 */

/** Última operación encolada por clave. */
const tails = new Map<string, Promise<unknown>>();

/**
 * Serializa por clave: cada `fn` espera a que termine la anterior sobre la
 * MISMA clave. Claves distintas no se bloquean entre sí.
 *
 * Un fallo no rompe la cadena — la siguiente operación corre igual — pero sí se
 * propaga al caller que lo provocó.
 */
export function withStorageLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  // `then(fn, fn)`: si la anterior falló, esta corre igualmente.
  const run = prev.then(fn, fn);
  // El tail se guarda "domado" para que el rechazo de una operación no se
  // propague a la siguiente ni quede sin manejar.
  tails.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}

/** Solo para tests: olvida las cadenas pendientes. */
export function __resetStorageLocksForTests() {
  tails.clear();
}
