import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PanueloCollectionStrip } from '@/components/panuelo/PanueloCollectionStrip';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl, {
  type SegmentedOption,
} from '@/components/ui/SegmentedControl';
import spacing from '@/constants/spacing';
import {
  filterCollection,
  type CollectionFilter,
  type PanueloCollectionEntry,
} from '@/utils/panuelo';

const TOUCH = 44;
/** El carril del segmentado deja 2 pt de aire a cada lado de cada segmento. */
const TRACK_PADDING = 4;

const OPTIONS: SegmentedOption<CollectionFilter>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'placed', label: 'Puestas' },
  { value: 'boxed', label: 'Sin poner' },
];

/** Lo que se dice cuando el filtro no deja ninguna pieza. */
function emptyCopy(filter: CollectionFilter, owned: number) {
  if (filter === 'placed') {
    return {
      title: 'Ninguna pieza puesta',
      subtitle: 'Las que cosas en el pañuelo salen aquí.',
    };
  }
  return owned === 0
    ? {
        title: 'Todavía no tienes piezas',
        subtitle: 'Las que consigas saldrán aquí.',
      }
    : {
        title: 'Todo lo que tienes está puesto',
        subtitle: 'Las que quites del pañuelo salen aquí.',
      };
}

type Props = {
  /** La colección entera: el filtro se aplica aquí. */
  entries: PanueloCollectionEntry[];
  filter: CollectionFilter;
  onFilterChange: (filter: CollectionFilter) => void;
  activeId: string | null;
  isDark: boolean;
  onSelect: (entry: PanueloCollectionEntry) => void;
  grid: boolean;
};

/**
 * El cajón de la colección con su filtro encima: Todas · Puestas · Sin poner.
 * «Sin poner» son las que tienes y no están cosidas, lo útil al decorar.
 */
export function PanueloCollectionFilter({
  entries,
  filter,
  onFilterChange,
  activeId,
  isDark,
  onSelect,
  grid,
}: Props) {
  const shown = filterCollection(entries, filter);
  return (
    <>
      <View style={styles.filter}>
        <SegmentedControl
          options={OPTIONS}
          value={filter}
          onChange={onFilterChange}
          accessibilityLabel="Filtrar la colección"
          style={{ minHeight: TOUCH + TRACK_PADDING }}
        />
      </View>
      {shown.length === 0 ? (
        <EmptyState
          compact
          {...emptyCopy(filter, entries.filter((e) => e.owned).length)}
        />
      ) : (
        <PanueloCollectionStrip
          entries={shown}
          activeId={activeId}
          isDark={isDark}
          onSelect={onSelect}
          grid={grid}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  filter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
});
