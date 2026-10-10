/**
 * Las preferencias de etiquetas aplicadas a una lista de canciones:
 *
 * - «Esconder también sus canciones» (`hideHiddenTagSongs`): en una categoría
 *   no salen las de las etiquetas ocultas (p. ej. las de otro carisma). En el
 *   buscador y en la pantalla de una etiqueta, sí. Siempre se dice cuántas y
 *   se pueden ver (`revealHidden`).
 * - Las etiquetas «a mano» (`featuredTags`) de cada canción, para verlas
 *   discretas en su fila.
 */
import { useCallback, useMemo, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import {
  featuredTagsOf,
  withoutHiddenTagSongs,
  type SongTagIndex,
} from '@/utils/songTags';

export function useSongListTags<T extends { tags?: unknown }>(
  songs: T[],
  opts: {
    tagIndex: SongTagIndex;
    hiddenSlugs: ReadonlySet<string>;
    /** Lista de una categoría (no el buscador ni una etiqueta). */
    inCategory: boolean;
  },
) {
  const { tagIndex, hiddenSlugs, inCategory } = opts;
  const { settings } = useSettings();
  const [revealed, setRevealed] = useState(false);
  const hide =
    settings.hideHiddenTagSongs && inCategory && hiddenSlugs.size > 0;
  const { visible, hiddenCount } = useMemo(
    () =>
      hide && !revealed
        ? withoutHiddenTagSongs(songs, hiddenSlugs, tagIndex.aliases)
        : { visible: songs, hiddenCount: 0 },
    [hide, revealed, songs, hiddenSlugs, tagIndex.aliases],
  );
  const featured = settings.featuredTags;
  const featuredFor = useCallback(
    (song: T) => featuredTagsOf(song, featured, tagIndex),
    [featured, tagIndex],
  );
  const revealHidden = useCallback(() => setRevealed(true), []);
  return { visibleSongs: visible, hiddenCount, revealHidden, featuredFor };
}
