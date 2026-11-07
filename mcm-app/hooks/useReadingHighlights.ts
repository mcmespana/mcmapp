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
  selectionHighlight,
  type HighlightColorKey,
  type HighlightRange,
  type SelectionHighlight,
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
  /**
   * Subrayado que YA tiene la selección actual, si lo tiene. Con esto la barra
   * de acciones sabe que no está ante texto nuevo: marca el color puesto y
   * ofrece cambiarlo o quitarlo, en vez de comportarse como si empezara de
   * cero.
   */
  selection: SelectionHighlight | null;
  /**
   * Pinta la selección. Normalmente la actual, pero se puede pasar una
   * explícita (`target`) para subrayar en el mismo gesto en que llega, sin
   * esperar a que el estado de selección se actualice — es lo que hace el ítem
   * "Subrayar" del menú nativo. Con `target`, la selección se CONSERVA marcada
   * para que la barra de colores salga con el color puesto y cambiarlo sea un
   * toque.
   */
  applyColor: (
    color: HighlightColorKey,
    target?: { source: HighlightSource; sel: ReadingSelection },
  ) => void;
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

  // "Pegajosa": nos quedamos con la ÚLTIMA selección no vacía. Dos motivos:
  //  1. Al tocar un chip de color, iOS puede colapsar la selección nativa antes
  //     de que llegue el onPress — si la vaciáramos aquí, el color no tendría a
  //     qué aplicarse.
  //  2. El texto reporta su selección TAMBIÉN fuera del modo lápiz, así que al
  //     tocar el botón de subrayar ya sabemos qué había seleccionado aunque el
  //     propio toque en el botón haya deshecho la selección nativa.
  //
  // Si la selección no ha cambiado devolvemos el MISMO objeto: arrastrar las
  // asas dispara el evento decenas de veces y así no se re-renderiza de más.
  const onSelectionChange = useMemo(
    () =>
      bySource(
        (source) => (sel: ReadingSelection | null) =>
          setActiveSel((prev) => {
            if (!sel) return prev;
            if (
              prev &&
              prev.source === source &&
              prev.sel.start === sel.start &&
              prev.sel.end === sel.end
            ) {
              return prev;
            }
            return { source, sel };
          }),
      ),
    [],
  );

  const clearSelection = useCallback(() => setActiveSel(null), []);

  const selection = useMemo(() => {
    if (!activeSel) return null;
    const { source, sel } = activeSel;
    return selectionHighlight(ranges[source], sel.start, sel.end);
  }, [activeSel, ranges]);

  const applyColor = useCallback(
    (
      color: HighlightColorKey,
      target?: { source: HighlightSource; sel: ReadingSelection },
    ) => {
      const applied = target ?? activeSel;
      if (!applied) return;
      const { source, sel } = applied;
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
      setActiveSel(target ? target : null);
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
    selection,
    applyColor,
    erase,
    clearSelection,
  };
}
