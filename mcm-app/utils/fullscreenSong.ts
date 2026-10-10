/**
 * Pantalla completa de una canción: qué canción se ve y con qué tono.
 *
 * Puro (sin React) para poder probarlo: `SongFullscreenScreen` solo le pasa
 * su estado. Ver `docs/funcionalidades/HOJA_CANCION.md` («Pantalla completa»).
 */
import type { SongNavItem } from '@/app/(tabs)/cancionero';
import type { ChoirCurrentSong } from '@/services/choirSessionService';

export interface FullscreenInput {
  /** La canción con la que se abrió y el tono con el que se estaba viendo. */
  initial: SongNavItem & {
    transpose?: number;
    capoOverride?: number | null;
  };
  /** Lista por la que se pasa de canción (categoría, etiqueta, playlist). */
  list?: SongNavItem[];
  index: number | null;
  /** En el coro, quien escucha ve la canción del líder. */
  choirSong?: ChoirCurrentSong | null;
  choirOverrideTranspose?: number | null;
  /** La canción en la playlist, si está (su tono manda). */
  selected?: { transpose: number; capoOverride?: number | null };
}

export interface FullscreenSong {
  song: SongNavItem;
  following: boolean;
  transpose: number;
  capoOverride: number | null;
  /** Cejilla que se ve: la cambiada o la de la canción. */
  capo: number | undefined;
}

export function resolveFullscreenSong(i: FullscreenInput): FullscreenSong {
  const remote = i.choirSong;
  const following = !!remote?.filename && !!remote.content;
  if (following) {
    const capoOverride = remote!.capoOverride ?? null;
    return {
      song: {
        filename: remote!.filename,
        title: remote!.title ?? remote!.filename,
        author: remote!.author,
        key: remote!.songKey,
        capo: remote!.capo,
        content: remote!.content,
      },
      following: true,
      transpose: i.choirOverrideTranspose ?? remote!.transpose ?? 0,
      capoOverride,
      capo: capoOverride ?? remote!.capo,
    };
  }
  const fromList = i.list && i.index !== null ? i.list[i.index] : undefined;
  // La de la lista solo si es OTRA: la inicial trae la letra viva del
  // detalle (con los arreglos recién añadidos).
  const song =
    fromList && fromList.filename !== i.initial.filename ? fromList : i.initial;
  const isInitial = song.filename === i.initial.filename;
  // El tono: el de la playlist, el que traía el detalle o el original.
  const transpose = i.selected
    ? i.selected.transpose
    : isInitial
      ? (i.initial.transpose ?? 0)
      : 0;
  const capoOverride =
    i.selected?.capoOverride !== undefined
      ? (i.selected.capoOverride ?? null)
      : isInitial
        ? (i.initial.capoOverride ?? null)
        : null;
  return {
    song,
    following: false,
    transpose,
    capoOverride,
    capo: capoOverride ?? song.capo,
  };
}
