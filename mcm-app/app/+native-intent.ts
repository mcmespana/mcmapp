/**
 * Reescritura de los deep links que entran en la app (expo-router).
 *
 * Se ejecuta FUERA del runtime de la app (no hay contexto, ni sesión, ni
 * navegación todavía), así que aquí solo se traduce una URL en otra ruta; el
 * trabajo de verdad lo hace la pantalla destino.
 *
 * Caso de uso actual: los **enlaces de acceso de Comunica** que llegan por
 * correo (`https://comunica.movimientoconsolacion.com/app/acceso?acceso_magico=…`).
 * Ese dominio está declarado como universal link (iOS) / app link (Android), así
 * que si la persona tiene la app instalada, el sistema la abre a ella en vez del
 * navegador. La ruta `/app/acceso` no existe en la app: hay que mandarla al tab
 * de Comunica y que su WebView cargue la URL real del área privada, para que
 * WordPress valide el token y cree la sesión DENTRO de la app.
 *
 * También se acepta el esquema propio `mcmapp://comunica?acceso_magico=…`, que
 * es la vía de escape para clientes de correo que envuelven los enlaces en un
 * redirector (los universal links no sobreviven a un redirect).
 */
import {
  buildComunicaAuthUrl,
  COMUNICA_AUTH_PARAMS,
  setPendingComunicaAuthUrl,
} from '@/utils/pendingComunicaLink';

const COMUNICA_HOST = 'comunica.movimientoconsolacion.com';
/** Ruta "puente" que sirve WordPress y que reclamamos en iOS/Android. */
const COMUNICA_APP_PATH = '/app/acceso';

/**
 * Query string → objeto. No usamos `URL`/`URLSearchParams` porque el polyfill
 * de React Native va justo de funciones y esto entra antes de que arranque nada.
 */
function parseQuery(url: string): Record<string, string> {
  const start = url.indexOf('?');
  if (start === -1) return {};
  const out: Record<string, string> = {};
  for (const pair of url.slice(start + 1).split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      // Un `%` suelto rompe decodeURIComponent: nos quedamos con el crudo.
      out[key] = value;
    }
  }
  return out;
}

/** ¿Esta URL es un enlace de acceso a Comunica? */
function isComunicaAccessLink(url: string): boolean {
  const withoutQuery = url.split('?')[0];
  return (
    withoutQuery.includes(`${COMUNICA_HOST}${COMUNICA_APP_PATH}`) ||
    withoutQuery.endsWith(COMUNICA_APP_PATH) ||
    /^mcmapp:\/\/comunica\/?$/.test(withoutQuery)
  );
}

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (!isComunicaAccessLink(path)) return path;

    const params = parseQuery(path);
    const hasAuth = COMUNICA_AUTH_PARAMS.some((key) => params[key]);
    // Sin token no hay nada que validar: al tab de Comunica y ya está (cargará
    // la URL normal, que si hay sesión con cookie entra directo).
    if (hasAuth) {
      setPendingComunicaAuthUrl(buildComunicaAuthUrl(params));
    }
    return '/(tabs)/comunica';
  } catch {
    // Nunca reventar por un enlace raro: mejor abrir la app por su inicio.
    return '/';
  }
}
