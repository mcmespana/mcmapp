/**
 * Detección y reporte de fallos de REGLAS de la Realtime Database.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * Un error de reglas no se parece en nada a un error de red, aunque llegue por
 * el mismo sitio:
 *
 *   - **No se arregla solo.** Reintentar un `PERMISSION_DENIED` es tirar 1,6 s
 *     de espera y tres peticiones para volver a fallar. `withRetry` lo hacía.
 *   - **No lo ve nadie.** Si las reglas se despliegan mal un martes por la
 *     tarde, la app no casca: se queda con la caché y calla. El usuario ve
 *     "no carga" y nosotros no vemos nada. Justo el caso que Sentry tiene que
 *     cazar, y por eso este módulo reporta con nivel `error` y con el path.
 *   - **Se repite mucho.** Un nodo denegado falla en cada pantalla que lo mira,
 *     cada vez que se monta. Sin deduplicar, un despliegue malo son miles de
 *     eventos idénticos y la cuota de Sentry por los suelos. Aquí cada
 *     `path + operación` se reporta UNA vez por sesión.
 *
 * ── Cómo se usa ─────────────────────────────────────────────────────────────
 *
 *   try { ... } catch (err) {
 *     if (reportIfPermissionDenied(err, 'read', path)) return;  // ya reportado
 *     throw err;                                                // otro fallo
 *   }
 *
 * El reporte va por `logger.error`, que es lo que `utils/sentry.ts` engancha.
 * Sin DSN configurado no se manda nada a ningún sitio y solo queda la consola,
 * igual que el resto del logging de la app.
 */

import { logger } from '@/utils/logger';

export type FirebaseOp = 'read' | 'write';

/**
 * ¿Este error es una denegación de las reglas?
 *
 * El SDK de RTDB no expone un tipo para esto: en web/RN llega como un `Error`
 * con `code === 'PERMISSION_DENIED'` unas veces y con el código solo dentro del
 * mensaje otras (`"permission_denied at /x: Client doesn't have permission…"`).
 * Miramos las dos cosas y en minúsculas, que la caja varía según la plataforma.
 */
export function isPermissionDenied(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: unknown }).code;
  if (
    typeof code === 'string' &&
    code.toLowerCase().includes('permission_denied')
  ) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return message.toLowerCase().includes('permission_denied');
}

/** `path + op` ya reportados en esta sesión. Se vacía al reiniciar el proceso JS. */
const reported = new Set<string>();

/** Solo para tests. */
export function __resetPermissionReportsForTests(): void {
  reported.clear();
}

/**
 * Si `error` es una denegación de reglas, la reporta (una vez por `path+op`) y
 * devuelve `true`. Si es cualquier otra cosa devuelve `false` y no toca nada:
 * el llamante sigue con su manejo normal (reintento de red, etc.).
 */
export function reportIfPermissionDenied(
  error: unknown,
  op: FirebaseOp,
  path: string,
): boolean {
  if (!isPermissionDenied(error)) return false;

  const key = `${op}:${path}`;
  if (reported.has(key)) return true;
  reported.add(key);

  // El mensaje empieza por una marca fija y buscable: en Sentry se agrupa solo
  // y en la consola se distingue de un fallo de red de un vistazo.
  logger.error(
    `[firebase-rules] PERMISSION_DENIED al hacer ${op} en "${path}". ` +
      'Las reglas de la Realtime Database no permiten esta operación. ' +
      'Revisa mcm-app/database.rules.json y el nodo /_config.',
    error instanceof Error ? error : new Error(String(error)),
  );
  return true;
}

/**
 * Envuelve una operación de Firebase para que las denegaciones de reglas se
 * reporten y NO se reintenten. Devuelve `null` si la operación fue denegada,
 * para que el llamante pueda seguir con lo que tuviera en caché.
 *
 * Cualquier otro error se relanza tal cual: los fallos de red los sigue
 * gestionando quien corresponda (`withRetry`).
 */
export async function guardPermission<T>(
  op: FirebaseOp,
  path: string,
  run: () => Promise<T>,
): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (reportIfPermissionDenied(error, op, path)) return null;
    throw error;
  }
}
