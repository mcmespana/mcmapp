import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';

import { piecesLabel } from '@/components/panuelo/PanueloHistorySheet';
import { PanueloCollectionStrip } from '@/components/panuelo/PanueloCollectionStrip';
import EmptyState from '@/components/ui/EmptyState';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import type { PanueloMemory } from '@/types/panuelo';
import {
  COLOR_LABEL,
  formatMonthYear,
  type PanueloCollectionEntry,
} from '@/utils/panuelo';

const TOUCH = 44;

/** «pañuelo verde de 2026». */
export function memoryName(memory: PanueloMemory): string {
  return `pañuelo ${COLOR_LABEL[memory.color].name.toLowerCase()} de ${new Date(memory.at).getFullYear()}`;
}

type BarProps = {
  isDark: boolean;
  memory: PanueloMemory;
  onBack: () => void;
};

/**
 * El aviso de que se está viendo un pañuelo anterior (solo para mirar), con
 * la salida a la vista. Ocupa el sitio de los colores y de «Decorar».
 */
export function PanueloMemoryBar({ isDark, memory, onBack }: BarProps) {
  const t = themeColors(isDark);
  return (
    <View style={[styles.bar, { backgroundColor: t.card }]}>
      <Text style={[styles.barText, { color: t.text }]}>
        Estás viendo tu {memoryName(memory)}
      </Text>
      <PressableFeedback
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Volver a mi pañuelo"
        style={[styles.back, { backgroundColor: t.backgroundSunken }]}
      >
        <PressableFeedback.Highlight />
        <MaterialIcons name="undo" size={18} color={t.link} />
        <Text style={[styles.backLabel, { color: t.link }]}>Volver</Text>
      </PressableFeedback>
    </View>
  );
}

type PanelProps = {
  isDark: boolean;
  memory: PanueloMemory;
  entries: PanueloCollectionEntry[];
  activeId: string | null;
  grid: boolean;
  titleRef: React.Ref<React.ComponentRef<typeof Text>>;
  onSelect: (entry: PanueloCollectionEntry) => void;
};

/** Lo que lleva el panel de abajo al ver un pañuelo anterior: sus piezas. */
export function PanueloMemoryPanel({
  isDark,
  memory,
  entries,
  activeId,
  grid,
  titleRef,
  onSelect,
}: PanelProps) {
  const t = themeColors(isDark);
  return (
    <>
      <View style={styles.head}>
        <Text
          ref={titleRef}
          style={[styles.title, { color: t.text }]}
          accessibilityRole="header"
        >
          {memoryName(memory).replace(/^./, (c) => c.toUpperCase())}
        </Text>
        <Text style={[styles.meta, { color: t.textSecondary }]}>
          Hasta {formatMonthYear(memory.at)} · {piecesLabel(entries.length)}
        </Text>
      </View>
      {entries.length === 0 ? (
        <EmptyState compact title="Sin piezas que enseñar" />
      ) : (
        <PanueloCollectionStrip
          entries={entries}
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
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.xl,
    ...shadows.card,
  },
  barText: {
    ...typography.subhead,
    fontWeight: '600',
    flex: 1,
    flexBasis: '60%',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pillFull,
    overflow: 'hidden',
  },
  backLabel: {
    ...typography.button,
  },
  head: {
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.h3,
  },
  meta: {
    ...typography.caption,
  },
});
