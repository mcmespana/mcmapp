/**
 * Las canciones que se abren en el cantoral y la lista por la que se pasa de
 * una a otra (anterior / siguiente).
 *
 * Con expo-router 58 cada pantalla del cantoral es una ruta de fichero
 * (`app/(tabs)/cancionero/`) y sus parámetros viajan como TEXTO: la canción
 * entera (letra, multimedia) y la lista de la categoría, etiqueta o playlist
 * ya no caben en la ruta. Lo que viaja:
 *
 *   · `filename` — qué canción. La pantalla la lee del catálogo (`songs`, la
 *     misma caché de `useFirebaseData` que pintan las listas).
 *   · `list` + `currentIndex` — la lista por la que se navega, guardada AQUÍ,
 *     en memoria, con un id corto. Es también donde viaja una canción que no
 *     está en el catálogo propio (la que publica el líder del coro) o la letra
 *     viva con un arreglo recién añadido.
 *   · `source`, `firebaseCategory` — analítica y reportes.
 *
 * Si la lista ya no está (la app se reinició, una recarga en web) la canción
 * se abre igual desde el catálogo, solo que sin anterior / siguiente.
 */
import { extractSongMedia, type SongMedia } from '@/types/songMedia';
import type { SongEntry, SongsData } from '@/utils/filterSongsData';

export interface SongNavItem {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  content?: string;
  media?: SongMedia;
}

export type SongSource = 'category' | 'selection';

/** Params de la ruta del detalle de canción (texto, como toda ruta). */
export interface SongRouteParams {
  [key: string]: string | undefined;
  filename: string;
  /** Id de la lista en este almacén. */
  list?: string;
  currentIndex?: string;
  source?: SongSource;
  firebaseCategory?: string;
}

/** Params de la pantalla completa: los del detalle + el tono con que se veía. */
export interface SongFullscreenRouteParams extends SongRouteParams {
  transpose?: string;
  /** Cejilla cambiada; sin valor = la de la canción. */
  capoOverride?: string;
}

/**
 * Cuántas listas se recuerdan. Cada vez que se abre una canción desde una
 * lista distinta se guarda una; con este tope, una pantalla muy al fondo del
 * historial puede perder la suya (se sigue viendo la canción, sin pasar).
 */
const MAX_LISTS = 40;

const lists = new Map<string, SongNavItem[]>();
let seq = 0;

function sameList(a: SongNavItem[], b: SongNavItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].filename !== b[i].filename || a[i].content !== b[i].content)
      return false;
  }
  return true;
}

/** Guarda una lista y devuelve su id (el mismo si ya estaba igual). */
export function putSongNavList(list: SongNavItem[]): string {
  for (const [id, existing] of lists) {
    if (sameList(existing, list)) {
      // Se refresca su antigüedad para que el tope no la tire la primera.
      lists.delete(id);
      lists.set(id, existing);
      return id;
    }
  }
  seq += 1;
  const id = String(seq);
  lists.set(id, list);
  while (lists.size > MAX_LISTS) {
    const oldest = lists.keys().next().value as string;
    lists.delete(oldest);
  }
  return id;
}

export function getSongNavList(id: string | undefined): SongNavItem[] | null {
  if (!id) return null;
  return lists.get(id) ?? null;
}

/** Solo tests. */
export function __resetSongNavLists(): void {
  lists.clear();
  seq = 0;
}

/** Número de una ruta (`'3'` → 3); `undefined` si no lo es. */
export function routeIndex(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/**
 * Params de ruta para abrir una canción. Con `list`, la guarda aquí y la
 * referencia por su id; `currentIndex` es la posición en ella.
 */
export function songRouteParams(o: {
  filename: string;
  list?: SongNavItem[];
  currentIndex?: number;
  source?: SongSource;
  firebaseCategory?: string;
}): SongRouteParams {
  const params: SongRouteParams = { filename: o.filename };
  if (o.list && o.list.length) {
    params.list = putSongNavList(o.list);
    if (typeof o.currentIndex === 'number' && o.currentIndex >= 0)
      params.currentIndex = String(o.currentIndex);
  }
  if (o.source) params.source = o.source;
  if (o.firebaseCategory) params.firebaseCategory = o.firebaseCategory;
  return params;
}

/**
 * La canción de la ruta dentro de su lista: la de `currentIndex` si es ESA
 * canción y, si no, la primera con ese fichero.
 */
export function songFromList(
  list: SongNavItem[] | null,
  filename: string,
  index: number | undefined,
): { song: SongNavItem; index: number } | null {
  if (!list) return null;
  if (index !== undefined && list[index]?.filename === filename)
    return { song: list[index], index };
  const at = list.findIndex((s) => s.filename === filename);
  return at >= 0 ? { song: list[at], index: at } : null;
}

/** Una canción del catálogo como elemento de navegación. */
export function songNavItemFromEntry(
  entry: SongEntry & { filename: string },
): SongNavItem {
  return {
    title: entry.title,
    filename: entry.filename,
    author: entry.author,
    key: entry.key,
    capo: entry.capo,
    content: entry.content,
    media: extractSongMedia(entry) ?? undefined,
  };
}

/**
 * Busca una canción del catálogo por su fichero: primero en su categoría (si
 * se sabe) y si no, en todas. Devuelve también la categoría en la que está.
 */
export function findCatalogSong(
  data: SongsData | null | undefined,
  filename: string,
  category?: string,
): { song: SongNavItem; category: string } | null {
  if (!data || !filename) return null;
  const inCategory = (key: string) => {
    const songs = data[key]?.songs;
    if (!Array.isArray(songs)) return null;
    const entry = songs.find((s) => s?.filename === filename);
    return entry
      ? {
          song: songNavItemFromEntry(entry as SongEntry & { filename: string }),
          category: key,
        }
      : null;
  };
  if (category) {
    const found = inCategory(category);
    if (found) return found;
  }
  for (const key of Object.keys(data).sort()) {
    const found = inCategory(key);
    if (found) return found;
  }
  return null;
}
