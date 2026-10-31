/**
 * Abrir una pantalla del cantoral por su nombre de siempre (`'SongsList'`,
 * `'SongDetail'`…). La ruta la da `cantoralHref` (`utils/eventRoutes.ts`);
 * los params de una canción se arman con `songRouteParams`
 * (`utils/songNavList.ts`). Siempre apila, como hacía el `navigate` del stack
 * montado a mano (React Navigation 7 ya no volvía atrás con `navigate`).
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
): void {
  router.push(cantoralHref(screen, params) as never);
}
