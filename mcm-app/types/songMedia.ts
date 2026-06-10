/**
 * Modelo multimedia de una canción del cantoral.
 *
 * Los datos los rellena el administrador desde `components/SecretPanelModal.tsx`
 * y viven en Firebase (`songs/data/<categoria>/songs[i]`). `extractSongMedia`
 * normaliza un objeto de canción crudo en una `SongMedia` lista para mostrar al
 * usuario final (cajón multimedia + indicadores de lista).
 */
import { toYouTubeEmbedUrl } from '@/utils/youtube';

export interface MediaLink {
  label: string;
  url: string;
}

export interface SongMedia {
  /** Álbum / disco al que pertenece la canción. */
  album?: string;
  /** Tiempo litúrgico (Adviento, Cuaresma, Pascua…). */
  liturgicalTime?: string;
  /** Fuente / atribución (puede ser una URL). */
  source?: string;
  /** Ritmo / compás (ej: "4x4"). */
  rhythm?: string;
  /** Comentario libre sobre la canción. */
  info?: string;
  /** Vídeo principal — URL de embed de YouTube ya normalizada. */
  videoEmbed?: string;
  /** Vídeos alternativos de YouTube. */
  youtubeLinks?: MediaLink[];
  /** Audios (normalmente enlaces de Google Drive). */
  audioLinks?: MediaLink[];
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Normaliza un array de enlaces, descartando los vacíos (sin url). */
function cleanLinks(raw: unknown): MediaLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is { label?: unknown; url?: unknown } =>
        !!x && typeof x === 'object',
    )
    .map((x) => ({
      label: typeof x.label === 'string' ? x.label.trim() : '',
      url: typeof x.url === 'string' ? x.url.trim() : '',
    }))
    .filter((link) => link.url.length > 0);
}

/**
 * Extrae y normaliza los campos multimedia de un objeto de canción crudo.
 * Devuelve `null` si la canción no tiene NADA de multimedia ni ficha, para
 * que quien consume pueda decidir no mostrar el botón/indicador.
 */
export function extractSongMedia(raw: unknown): SongMedia | null {
  if (!raw || typeof raw !== 'object') return null;
  const song = raw as Record<string, unknown>;

  const videoEmbedRaw = cleanString(song.videoEmbed);
  const media: SongMedia = {
    album: cleanString(song.album),
    liturgicalTime: cleanString(song.liturgicalTime),
    source: cleanString(song.source),
    rhythm: cleanString(song.rhythm),
    info: cleanString(song.info),
    videoEmbed: videoEmbedRaw ? toYouTubeEmbedUrl(videoEmbedRaw) : undefined,
    youtubeLinks: cleanLinks(song.youtubeLinks).map((link) => ({
      label: link.label,
      url: toYouTubeEmbedUrl(link.url),
    })),
    audioLinks: cleanLinks(song.audioLinks),
  };

  return hasSongMedia(media) ? media : null;
}

/** ¿La canción tiene algún contenido multimedia o de ficha que mostrar? */
export function hasSongMedia(media: SongMedia | null | undefined): boolean {
  if (!media) return false;
  return Boolean(
    media.album ||
    media.liturgicalTime ||
    media.source ||
    media.rhythm ||
    media.info ||
    media.videoEmbed ||
    (media.youtubeLinks && media.youtubeLinks.length > 0) ||
    (media.audioLinks && media.audioLinks.length > 0),
  );
}

/** Tipos de media presentes — para el indicador sutil de la lista. */
export function mediaKinds(media: SongMedia | null | undefined): {
  video: boolean;
  audio: boolean;
} {
  return {
    video: Boolean(
      media?.videoEmbed ||
      (media?.youtubeLinks && media.youtubeLinks.length > 0),
    ),
    audio: Boolean(media?.audioLinks && media.audioLinks.length > 0),
  };
}
