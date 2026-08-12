/**
 * Utilidades puras del "estado de sincronización" de la playlist: saber si lo
 * que tienes en el móvil es exactamente lo que hay subido, ordenar las
 * playlists de un coro y escribir fechas que se lean de un vistazo.
 *
 * Vive aparte de la pantalla porque es lógica sin UI (y con tests).
 */
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

/**
 * Huella de una playlist: cambia si cambian las canciones, su orden, su
 * transporte o su cejilla. Sirve para decidir si mostrar «guardada» o
 * «cambios sin guardar» sin tener que guardar una copia entera de la lista.
 *
 * No es criptográfica ni pretende serlo: solo tiene que ser estable y barata.
 */
export function playlistSignature(songs: SelectedSong[]): string {
  // Se deduplica por `filename` igual que hace `SelectedSongsContext` al
  // guardar: si no, una lista importada con un duplicado daría una firma
  // distinta a la que acaba en el móvil y la pantalla diría "cambios sin
  // guardar" nada más importarla.
  const seen = new Set<string>();
  const unique = [...songs]
    .sort((a, b) => a.order - b.order)
    .filter((s) => {
      if (seen.has(s.filename)) return false;
      seen.add(s.filename);
      return true;
    });
  const canonical = unique
    .map(
      (s) =>
        `${s.filename}:${s.transpose ?? 0}:${
          s.capoOverride === null || s.capoOverride === undefined
            ? '-'
            : s.capoOverride
        }`,
    )
    .join('|');

  // Hash djb2 → base36. Añadimos la longitud para que dos listas distintas con
  // el mismo hash (improbable) sigan distinguiéndose por tamaño.
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) | 0;
  }
  return `${unique.length}-${(hash >>> 0).toString(36)}`;
}

/** Entrada del índice de playlists de un coro (lo mínimo para pintar la lista). */
export interface ChoirPlaylistEntry {
  /** Código de 4 dígitos con el que se puede importar/compartir suelta. */
  code: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  songCount: number;
  /** Nombre de quien la subió por última vez, si lo tenía puesto. */
  by?: string;
  /** Dispositivo que la subió: "la mía" se actualiza sin contraseña. */
  ownerDeviceId?: string;
}

/**
 * Orden en el que se enseñan las playlists de un coro: la más recientemente
 * modificada arriba. El panel puede retocar `updatedAt` justamente para
 * reordenarlas a mano.
 */
export function sortChoirPlaylists(
  entries: ChoirPlaylistEntry[],
): ChoirPlaylistEntry[] {
  return [...entries].sort(
    (a, b) =>
      (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.name.localeCompare(b.name),
  );
}

/** La más reciente de un coro, o null si el coro aún no tiene ninguna. */
export function latestChoirPlaylist(
  entries: ChoirPlaylistEntry[],
): ChoirPlaylistEntry | null {
  return sortChoirPlaylists(entries)[0] ?? null;
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Fecha corta y humana: «ahora mismo», «hace 12 min», «hace 3 h», «ayer»,
 * «7 ago», «7 ago 2025». Pensada para caber en una línea pequeña bajo el
 * nombre de la playlist.
 */
export function formatRelativeDate(ts: number, now = Date.now()): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const diff = now - ts;
  if (diff < 0) return formatAbsolute(ts, now);
  if (diff < 2 * MINUTE) return 'ahora mismo';
  if (diff < HOUR) return `hace ${Math.round(diff / MINUTE)} min`;
  if (diff < 24 * HOUR) {
    const hours = Math.floor(diff / HOUR);
    return `hace ${hours} h`;
  }
  if (diff < 48 * HOUR) return 'ayer';
  return formatAbsolute(ts, now);
}

function formatAbsolute(ts: number, now: number): string {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return sameYear ? base : `${base} ${d.getFullYear()}`;
}
