/**
 * Reescritura de los deep links que entran en la app (expo-router).
 *
 * Se ejecuta FUERA del runtime de la app (no hay contexto, ni sesión, ni
 * navegación todavía), así que aquí solo se traduce una URL en otra ruta; el
 * trabajo de verdad lo hace la pantalla destino.
 *
 * Los enlaces de **Comunica** (`https://comunica.movimientoconsolacion.com/…`)
 * van a la pestaña Comunica (plan 10 de `docs/planes/area-nativa/`). Qué es
 * cada enlace lo decide `services/comunica/links.ts`, y se deja para los dos
 * modos de la pestaña, que recogen cada uno el suyo:
 *
 *   · el LEGADO (la WebView): la URL del área privada con el token y el
 *     destino, para que WordPress valide el token y cree la sesión DENTRO de
 *     la app — lo de siempre con `/app/acceso?acceso_magico=…`;
 *   · el área NATIVA: el enlace clasificado (entrar, canjear el token, abrir
 *     la pantalla que toca o el legado en esa página).
 *
 * También se acepta el esquema propio `mcmapp://comunica?acceso_magico=…`, que
 * es la vía de escape para clientes de correo que envuelven los enlaces en un
 * redirector (los universal links no sobreviven a un redirect).
 */
import {
  classifyComunicaLink,
  destinationQuery,
} from '@/services/comunica/links';
import { setPendingNativeLink } from '@/services/comunica/pendingLink';
import {
  buildComunicaLegacyUrl,
  setPendingComunicaAuthUrl,
} from '@/utils/pendingComunicaLink';

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const link = classifyComunicaLink(path);
    if (!link) return path;

    setPendingNativeLink(link);
    // El legado solo sabe de tokens y destinos del área. Sin ninguno de los
    // dos, al tab y ya está (si hay sesión con cookie, entra directo).
    if (link.kind === 'page') {
      const dq = link.destination ? destinationQuery(link.destination) : '';
      if (link.auth || dq) {
        setPendingComunicaAuthUrl(
          buildComunicaLegacyUrl(
            link.auth
              ? { acceso_magico: link.auth.magic, token: link.auth.token }
              : null,
            dq,
          ),
        );
      }
    }
    return '/(tabs)/comunica';
  } catch {
    // Nunca reventar por un enlace raro: mejor abrir la app por su inicio.
    return '/';
  }
}
