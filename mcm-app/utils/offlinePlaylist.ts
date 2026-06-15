/**
 * Codificación compacta de una playlist para compartirla por **QR offline**.
 *
 * A diferencia del QR "en la nube" (que solo lleva un código de 4 dígitos y
 * requiere descargar la playlist de Firebase), el QR offline lleva la playlist
 * entera embebida en la URL `mcmapp://playlist?d=<payload>`. Así, un iPad con
 * la app cacheada puede escanearla con la cámara normal y abrir la playlist
 * sin conexión a internet.
 *
 * El objetivo es que el `payload` sea lo más pequeño posible, porque un QR con
 * muchos caracteres se vuelve denso y difícil de escanear. Por eso NO guardamos
 * el `filename` completo de cada canción, sino su **categoría (1 letra) + número
 * de canción**, que el dispositivo receptor resuelve contra su catálogo
 * cacheado. El orden se deduce de la posición en la cadena (0 bytes extra).
 *
 * Formato del payload (separador de entradas: `~`):
 *
 *   1~D5~A42t2~C1t-1c3~_otra-cancion_07.html~_rara_03.html't1
 *   │  │   │     │       │                     └ entrada "cruda" con tono +1
 *   │  │   │     │       └ entrada "cruda" (categoría desconocida o sin número)
 *   │  │   │     └ comunión nº1, tono -1 semitono, cejilla 3
 *   │  │   └ adoración nº42, tono +2 semitonos
 *   │  └ entrada (catDentrada) nº5, sin modificadores
 *   └ versión del formato (1)
 *
 * - Categoría → 1 letra mayúscula (ver CATEGORY_CODES, alineado con songUtils).
 * - Número → dígitos.
 * - Tono → `t<±n>` (solo si el transpose ≠ 0).
 * - Cejilla → `c<n>` (solo si hay capoOverride).
 * - Entrada "cruda" (`_<filename>`): respaldo sin pérdida para canciones cuya
 *   categoría no esté en el mapa o que no tengan número detectable. Los
 *   modificadores van tras un `'`.
 */
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

/** Versión actual del formato de payload. */
const FORMAT_VERSION = '1';
/** Separador de entradas dentro del payload. */
const SEP = '~';
/** Prefijo de una entrada "cruda" (filename completo). */
const RAW_PREFIX = '_';
/** Separador entre el filename crudo y sus modificadores. */
const RAW_MODS_SEP = "'";

/**
 * Mapa categoría Firebase → 1 letra. Alineado con
 * `getCategoryFromFirebaseCategory` (utils/songUtils.ts) para mantener
 * coherencia visual con el resto de la app.
 */
export const CATEGORY_CODES: Record<string, string> = {
  adoracion: 'A',
  aleluya: 'B',
  comunion: 'C',
  entrada: 'D',
  himnos: 'E',
  ofertorio: 'F',
  salida: 'G',
  salmos: 'H',
  santo: 'I',
};

/** Mapa inverso letra → categoría Firebase. */
export const CODE_CATEGORIES: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CODES).map(([k, v]) => [v, k]),
);

/**
 * Extrae el número de canción a partir del título ("12. Algo" → 12) o, como
 * respaldo, del filename (`algo_07.html` → 7). Devuelve null si no hay número.
 */
export function parseSongNumber(
  title: string | undefined,
  filename: string,
): number | null {
  const titleMatch = title?.match(/^(\d{1,3})\.\s*/);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  const fileMatch = filename.match(/_(\d+)\.html$/);
  if (fileMatch) return parseInt(fileMatch[1], 10);
  return null;
}

/** Serializa los modificadores (tono / cejilla) comunes a ambos tipos de entrada. */
function encodeMods(transpose: number, capoOverride?: number | null): string {
  let s = '';
  if (transpose) s += `t${transpose}`;
  if (capoOverride != null) s += `c${capoOverride}`;
  return s;
}

/**
 * Resuelve los datos necesarios para codificar una canción de forma compacta.
 * Devuelve la clave de categoría Firebase y el número de canción, o null si no
 * se conoce (en cuyo caso la canción se codifica "cruda" por filename).
 */
export interface SongInfoResolver {
  (filename: string): { categoryKey: string; number: number | null } | null;
}

/**
 * Codifica una playlist en el payload compacto para el QR offline.
 * `resolve` mapea cada filename a su categoría y número (normalmente derivado
 * del catálogo de canciones cargado en memoria).
 */
export function encodeOfflinePlaylist(
  songs: SelectedSong[],
  resolve: SongInfoResolver,
): string {
  const entries = [...songs]
    .sort((a, b) => a.order - b.order)
    .map((song) => {
      const info = resolve(song.filename);
      const mods = encodeMods(song.transpose, song.capoOverride);
      const code = info ? CATEGORY_CODES[info.categoryKey] : undefined;
      if (code && info?.number != null) {
        return `${code}${info.number}${mods}`;
      }
      // Respaldo sin pérdida: filename completo.
      return mods
        ? `${RAW_PREFIX}${song.filename}${RAW_MODS_SEP}${mods}`
        : `${RAW_PREFIX}${song.filename}`;
    });
  return [FORMAT_VERSION, ...entries].join(SEP);
}

/** Parsea los modificadores `t<±n>c<n>` de una cadena. */
function parseMods(mods: string): {
  transpose: number;
  capoOverride: number | null;
} {
  const m = mods.match(/^(?:t(-?\d+))?(?:c(\d+))?$/);
  return {
    transpose: m && m[1] != null ? parseInt(m[1], 10) : 0,
    capoOverride: m && m[2] != null ? parseInt(m[2], 10) : null,
  };
}

/** Resuelve (categoría, número) → filename contra el catálogo del receptor. */
export interface FilenameResolver {
  resolveCategory: (categoryKey: string, number: number) => string | null;
  hasFilename: (filename: string) => boolean;
}

/**
 * Decodifica un payload del QR offline en una lista de canciones lista para
 * `replaceAll`. Las canciones que no se puedan resolver contra el catálogo del
 * receptor se omiten (se devuelven en `missing` para avisar al usuario).
 */
export function decodeOfflinePlaylist(
  payload: string,
  resolver: FilenameResolver,
): { songs: SelectedSong[]; missing: number } {
  const tokens = payload.split(SEP);
  // Quitamos el prefijo de versión si está presente.
  if (tokens[0] === FORMAT_VERSION) tokens.shift();

  const songs: SelectedSong[] = [];
  let missing = 0;
  const now = Date.now();

  tokens.forEach((token, i) => {
    if (!token) return;
    let filename: string | null = null;
    let categoryHint: string | undefined;
    let transpose = 0;
    let capoOverride: number | null = null;

    if (token.startsWith(RAW_PREFIX)) {
      // Entrada cruda: `_<filename>['<mods>]`
      const rest = token.slice(RAW_PREFIX.length);
      const sepIdx = rest.indexOf(RAW_MODS_SEP);
      const fname = sepIdx >= 0 ? rest.slice(0, sepIdx) : rest;
      if (sepIdx >= 0) {
        ({ transpose, capoOverride } = parseMods(rest.slice(sepIdx + 1)));
      }
      if (resolver.hasFilename(fname)) filename = fname;
    } else {
      // Entrada por categoría: `<L><num>[mods]`
      const m = token.match(/^([A-Z])(\d+)(.*)$/);
      if (m) {
        const categoryKey = CODE_CATEGORIES[m[1]];
        const number = parseInt(m[2], 10);
        ({ transpose, capoOverride } = parseMods(m[3]));
        if (categoryKey) {
          filename = resolver.resolveCategory(categoryKey, number);
          categoryHint = categoryKey;
        }
      }
    }

    if (filename) {
      songs.push({
        filename,
        transpose,
        capoOverride,
        order: songs.length,
        categoryHint,
        addedAt: now + i,
      });
    } else {
      missing += 1;
    }
  });

  return { songs, missing };
}
