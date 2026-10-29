/**
 * Buzón de un solo hueco para abrir una canción en el stack del cantoral
 * desde FUERA de él: la paleta de comandos de la web (⌘K / Ctrl+K) y el
 * enlace `/cancion?f=<fichero>` (`app/cancion.tsx`).
 *
 * El stack del cantoral es un navigator montado a mano dentro de la ruta
 * `/cancionero`, no rutas de expo-router, así que desde fuera no se puede
 * hacer `router.push` a una canción. Quien quiere abrirla deja aquí los
 * parámetros de `SongDetail` y navega al tab; `CancioneroTab` los recoge y
 * hace `navigate('SongDetail', …)` en su stack, igual que ya hacía con la
 * canción del líder en el modo coro.
 *
 * Dos vías, como `pendingComunicaLink`, porque el tab puede estar o no
 * montado:
 *
 *  - **Tab sin montar** (primera visita, o F5 en `/cancion?f=…`): la petición
 *    espera aquí y `consumePendingSongOpen()` la recoge al montar.
 *  - **Tab ya montado** (lo normal con la paleta): se le avisa al momento por
 *    `subscribeSongOpen()`, aunque esté en otra canción o en otra pantalla.
 */
import type { SongOpenParams } from '@/utils/songIndex';

let pending: SongOpenParams | null = null;
let listener: ((params: SongOpenParams) => void) | null = null;

/** Pide abrir una canción (o se la pasa al cantoral si ya escucha). */
export function requestSongOpen(params: SongOpenParams): void {
  if (listener) {
    listener(params);
    return;
  }
  pending = params;
}

/** Recoge la canción pendiente, si la hay. Se consume una sola vez. */
export function consumePendingSongOpen(): SongOpenParams | null {
  const current = pending;
  pending = null;
  return current;
}

/**
 * El cantoral se apunta para recibir las canciones que se pidan mientras está
 * montado. Devuelve la función para darse de baja.
 */
export function subscribeSongOpen(
  fn: (params: SongOpenParams) => void,
): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
