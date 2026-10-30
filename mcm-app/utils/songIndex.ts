/**
 * Índice plano del cantoral para buscar y abrir una canción desde FUERA de su
 * stack: la paleta de comandos de la web (⌘K / Ctrl+K) y el enlace
 * `/cancion?f=<fichero>`.
 *
 * Puro (sin React ni navegación) para poder probarlo. Trabaja sobre el mismo
 * nodo `songs` que pintan las pantallas del cantoral, ya pasado por
 * `filterSongsData` (sin borradores ni pendientes), y busca sin tildes con el
 * mismo `foldForSearch` que el buscador de la lista.
 */
import type { RootStackParamList } from '@/app/(tabs)/cancionero';
import type { SongEntry, SongsData } from '@/utils/filterSongsData';
import { foldForSearch } from '@/utils/songTags';
import {
  cleanSongTitle,
  extractTrailingEmoji,
  stripCategoryPrefix,
} from '@/utils/songUtils';
import { extractSongMedia } from '@/types/songMedia';

/** Parámetros con los que se abre `SongDetail` en el stack del cantoral. */
export type SongOpenParams = RootStackParamList['SongDetail'];

export interface IndexedSong {
  filename: string;
  /** Título sin el número de orden («12. Alzad…» → «Alzad…»). */
  title: string;
  author?: string;
  /** Clave de la categoría en Firebase (`entrada`, `comunion`…). */
  categoryKey: string;
  /** Nombre legible de la categoría, sin prefijo de orden ni emoji. */
  categoryName: string;
  /** Título limpio y sin tildes, para ordenar por coincidencia. */
  foldedTitle: string;
  /** Título (con número), autor y fichero, sin tildes: donde se busca. */
  haystack: string;
  entry: SongEntry;
}

/**
 * Aplana las categorías en una lista de canciones, en el orden del cantoral y
 * sin repetir fichero (si una canción está en dos categorías, cuenta la
 * primera).
 */
export function buildSongIndex(data: SongsData | null): IndexedSong[] {
  if (!data) return [];
  const seen = new Set<string>();
  const out: IndexedSong[] = [];
  for (const categoryKey of Object.keys(data).sort()) {
    const category = data[categoryKey];
    if (!category || !Array.isArray(category.songs)) continue;
    const categoryName = extractTrailingEmoji(
      stripCategoryPrefix(category.categoryTitle || categoryKey),
    ).cleanText;
    for (const entry of category.songs) {
      const filename = entry?.filename;
      if (!filename || seen.has(filename)) continue;
      seen.add(filename);
      const title = cleanSongTitle(entry.title || filename);
      out.push({
        filename,
        title,
        author: entry.author || undefined,
        categoryKey,
        categoryName,
        foldedTitle: foldForSearch(title),
        haystack: foldForSearch(
          `${entry.title || ''} ${entry.author || ''} ${filename}`,
        ),
        entry,
      });
    }
  }
  return out;
}

/** Mínimo de letras para buscar canciones: con una sola salen casi todas. */
export const MIN_SONG_QUERY = 2;

/**
 * Canciones que casan con lo tecleado. Cada palabra de la búsqueda tiene que
 * estar en título, autor o fichero (sin tildes ni mayúsculas). Se ordenan por
 * lo bien que casa el TÍTULO —empieza por la búsqueda, alguna palabra empieza
 * por ella, la contiene, o solo casa el autor— y después alfabéticamente.
 */
export function searchSongIndex(
  index: IndexedSong[],
  query: string,
  limit = 8,
): IndexedSong[] {
  const q = foldForSearch(query).trim().replace(/\s+/g, ' ');
  if (q.length < MIN_SONG_QUERY) return [];
  const tokens = q.split(' ');
  const scored: { song: IndexedSong; score: number }[] = [];
  for (const song of index) {
    if (!tokens.every((t) => song.haystack.includes(t))) continue;
    let score = 3;
    if (song.foldedTitle.startsWith(q)) score = 0;
    else if (song.foldedTitle.split(/\s+/).some((w) => w.startsWith(tokens[0])))
      score = 1;
    else if (song.foldedTitle.includes(q)) score = 2;
    scored.push({ song, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score || a.song.foldedTitle.localeCompare(b.song.foldedTitle),
  );
  return scored.slice(0, limit).map((s) => s.song);
}

/** Busca una canción por su fichero (`/cancion?f=…`). */
export function findSongByFilename(
  index: IndexedSong[],
  filename: string,
): IndexedSong | null {
  const wanted = filename.trim();
  if (!wanted) return null;
  return index.find((s) => s.filename === wanted) ?? null;
}

/**
 * Parámetros de `SongDetail` para una canción abierta desde fuera de una
 * lista: como desde el buscador global (`__ALL__`), sin lista por la que
 * pasar de canción y sin `source`, que es lo que la analítica cuenta como
 * «búsqueda».
 */
export function songOpenParams(song: IndexedSong): SongOpenParams {
  const { entry } = song;
  return {
    filename: song.filename,
    title: song.title,
    author: entry.author,
    key: entry.key,
    capo: entry.capo,
    content: entry.content || '',
    media: extractSongMedia(entry) ?? undefined,
    firebaseCategory: song.categoryKey,
  };
}

/** Ruta web que abre una canción. La sirve `app/cancion.tsx`. */
export function songWebPath(filename: string): string {
  return `/cancion?f=${encodeURIComponent(filename)}`;
}
