/**
 * Abrir una pantalla del cantoral por su nombre de siempre (`'SongsList'`,
 * `'SongDetail'`…). La ruta la da `cantoralHref` (`utils/eventRoutes.ts`);
 * los params de una canción se arman con `songRouteParams`
 * (`utils/songNavList.ts`). Siempre apila, como hacía el `navigate` del stack
 * montado a mano (React Navigation 7 ya no volvía atrás con `navigate`).
 *
 * `fromOutside`: desde FUERA del cantoral (la paleta ⌘K, un enlace). Se entra
 * con `withAnchor`, que pone las categorías debajo: sin él, entrar en una ruta
 * anidada desde otra pestaña deja la pila con esa pantalla sola y «atrás» no
 * tiene adónde ir. Desde DENTRO del cantoral, no: `withAnchor` reinicia la
 * pila a categorías + destino y se perdería el camino recorrido.
 */
import { router } from 'expo-router';
import {
  cantoralHref,
  type CantoralScreenName,
  type RouteParams,
} from '@/utils/eventRoutes';

export function openCantoral(
  screen: CantoralScreenName,
  params?: RouteParams,
  { fromOutside = false }: { fromOutside?: boolean } = {},
): void {
  router.push(
    cantoralHref(screen, params) as never,
    fromOutside ? { withAnchor: true } : undefined,
  );
}
