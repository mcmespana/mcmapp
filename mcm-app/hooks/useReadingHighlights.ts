import { useCallback, useMemo, useState } from 'react';
import type { ReadingSelection } from '@/components/contigo/HighlightableReading';
import type { DailyReadings } from '@/hooks/useDailyReadings';
import {
  HIGHLIGHT_SOURCES,
  type HighlightSource,
  type StoredBookmark,
} from '@/utils/contigoBookmarks';
import {
  addHighlight,
  normalizeHighlights,
  removeHighlight,
  type HighlightColorKey,
  type HighlightRange,
} from '@/utils/highlightRanges';
import { normalizeReadingText } from '@/utils/readingSegments';

type BySource<T> = Record<HighlightSource, T>;

export interface ReadingHighlights {
  /** Texto canónico por fuente (los offsets van sobre ESTA cadena). */
  canonical: BySource<string>;
  /** Rangos subrayados por fuente. */
  ranges: BySource<HighlightRange[]>;
  /** Handler estable de selección nativa por fuente. */
  onSelectionChange: BySource<(sel: ReadingSelection | null) => void>;
  /** Hay una selección viva a la que aplicar color/goma. */
  hasSelection: boolean;
  applyColor: (color: HighlightColorKey) => void;
  erase: () => void;
  clearSelection: () => void;
}

const bySource = <T>(make: (s: HighlightSource) => T): BySource<T> =>
  Object.fromEntries(HIGHLIGHT_SOURCES.map((s) => [s, make(s)])) as BySource<T>;

/**
 * Estado de subrayado de TODAS las lecturas del día (evangelio, comentario,
 * primera lectura, salmo y segunda lectura).
 *
 * Vive fuera de la pantalla para que añadir una fuente nueva sea añadir una
 * entrada a `HIGHLIGHT_SOURCES`, no repetir memos y handlers a mano — que es
 * justo lo que hacía que la primera y la segunda lectura se quedaran sin
 * subrayado.
 */
export function useReadingHighlights(
  date: string,
  readings: DailyReadings | null,
  bookmark: StoredBookmark | undefined,
  setHighlights: (
    date: string,
    source: HighlightSource,
    ranges: HighlightRange[],
    readings: DailyReadings | null,
  ) => void,
): ReadingHighlights {
  const rawTexts: BySource<string> = useMemo(
    () => ({
      evangelio: readings?.evangelio?.texto ?? '',
      comentario: readings?.evangelio?.comentario ?? '',
      lectura1: readings?.lectura1?.texto ?? '',
      salmo: readings?.salmo?.texto ?? '',
      lectura2: readings?.lectura2?.texto ?? '',
    }),
    [readings],
  );

  const canonical = useMemo(
    () =>
      bySource((s) => (rawTexts[s] ? normalizeReadingText(rawTexts[s]) : '')),
    [rawTexts],
  );

  const stored = bookmark?.highlights;
  const ranges = useMemo(
    () => bySource((s) => normalizeHighlights(canonical[s], stored?.[s])),
    [canonical, stored],
  );

  const [activeSel, setActiveSel] = useState<{
    source: HighlightSource;
    sel: ReadingSelection;
  } | null>(null);

  // "Pegajosa": nos quedamos con la ÚLTIMA selección no vacía. Al tocar un chip
  // de color, iOS puede colapsar la selección nativa antes de que llegue el
  // onPress — si la vaciáramos aquí, el color no tendría a qué aplicarse.
  const onSelectionChange = useMemo(
    () =>
      bySource(
        (source) => (sel: ReadingSelection | null) =>
          setActiveSel((prev) => (sel ? { source, sel } : prev)),
      ),
    [],
  );

  const clearSelection = useCallback(() => setActiveSel(null), []);

  const applyColor = useCallback(
    (color: HighlightColorKey) => {
      if (!activeSel) return;
      const { source, sel } = activeSel;
      setHighlights(
        date,
        source,
        addHighlight(
          canonical[source],
          ranges[source],
          sel.start,
          sel.end,
          color,
        ),
        readings,
      );
      setActiveSel(null);
    },
    [activeSel, canonical, ranges, date, readings, setHighlights],
  );

  const erase = useCallback(() => {
    if (!activeSel) return;
    const { source, sel } = activeSel;
    setHighlights(
      date,
      source,
      removeHighlight(canonical[source], ranges[source], sel.start, sel.end),
      readings,
    );
    setActiveSel(null);
  }, [activeSel, canonical, ranges, date, readings, setHighlights]);

  return {
    canonical,
    ranges,
    onSelectionChange,
    hasSelection: !!activeSel,
    applyColor,
    erase,
    clearSelection,
  };
}
