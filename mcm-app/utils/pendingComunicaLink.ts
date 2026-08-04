/**
 * Cola de un solo hueco para el enlace de acceso de Comunica que llega por
 * deep link (universal link / app link desde el correo).
 *
 * El enlace del email apunta a `https://comunica.…/app/acceso?acceso_magico=…`.
 * Cuando iOS/Android reconocen el dominio, abren la app en vez del navegador y
 * `app/+native-intent.ts` deja aquí la URL ya traducida a la del área privada,
 * antes de mandar al tab de Comunica. La pantalla la consume y hace que su
 * WebView cargue ESA url, con lo que WordPress valida el token y crea la sesión
 * dentro de la app.
 *
 * Dos vías porque el deep link puede llegar en dos momentos muy distintos:
 *
 *  - **App cerrada**: `+native-intent` corre antes de que exista la pantalla →
 *    la URL espera aquí y `consume…()` la recoge al montar el WebView.
 *  - **App abierta** (lo normal si vienes del Mail y ya tenías la app detrás):
 *    la pantalla ya está montada, así que hay que avisarla → `subscribe…()`.
 */

/** Base del área privada, sin query. */
export const COMUNICA_BASE_URL =
  'https://comunica.movimientoconsolacion.com/aptest/';

/**
 * Parámetros de acceso que la app sabe reenviar a la web. Cualquier otro se
 * descarta: el WebView solo debe cargar URLs que construimos nosotros.
 *
 * - `acceso_magico` — enlace firmado y caducable (flujo "mándame acceso").
 * - `token` — token permanente del contacto (botón del pie de los emails).
 */
export const COMUNICA_AUTH_PARAMS = ['acceso_magico', 'token'] as const;

let pendingUrl: string | null = null;
let listener: ((url: string) => void) | null = null;

/**
 * Monta la URL del área privada a partir de los parámetros de acceso.
 * Siempre lleva `app=1` (modo app de la web: sin header ni footer del tema).
 */
export function buildComunicaAuthUrl(params: Record<string, string>): string {
  const query = COMUNICA_AUTH_PARAMS.filter((key) => params[key]).map(
    (key) => `${key}=${encodeURIComponent(params[key])}`,
  );
  return `${COMUNICA_BASE_URL}?${[...query, 'app=1'].join('&')}`;
}

/** Deja una URL de acceso pendiente (o se la pasa a la pantalla si ya escucha). */
export function setPendingComunicaAuthUrl(url: string) {
  if (listener) {
    listener(url);
    return;
  }
  pendingUrl = url;
}

/** Recoge la URL pendiente, si la hay. Se consume una sola vez. */
export function consumePendingComunicaAuthUrl(): string | null {
  const url = pendingUrl;
  pendingUrl = null;
  return url;
}

/**
 * La pantalla de Comunica se apunta para recibir los enlaces que lleguen
 * mientras está montada. Devuelve la función para darse de baja.
 */
export function subscribeComunicaAuthUrl(
  fn: (url: string) => void,
): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
