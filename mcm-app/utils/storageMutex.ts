// Mutex por clave para ciclos read-modify-write de AsyncStorage
// (getItem → mutar → setItem). Sin esto, dos ciclos concurrentes sobre la
// misma clave (dos pushes casi simultáneos, un merge remoto corriendo
// mientras el usuario interactúa…) pueden intercalarse: el segundo setItem
// escribe sobre un snapshot obsoleto y el cambio del primero desaparece en
// silencio.
const tails = new Map<string, Promise<unknown>>();

/** Serializa por clave: cada `fn` espera a que termine la anterior sobre la
 *  misma clave. Un fallo no rompe la cadena — la siguiente `fn` corre igual,
 *  y el rechazo se propaga solo a SU propio caller. */
export function withStorageLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}
