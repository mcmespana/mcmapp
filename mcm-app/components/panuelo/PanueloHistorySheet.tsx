import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';

import BottomSheet from '@/components/BottomSheet';
import { MaterialIcons } from '@/components/ui/icons';
import { PanueloColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { PanueloCatalog, PanueloMemory } from '@/types/panuelo';
import {
  COLOR_LABEL,
  formatMonthYear,
  memoryPieceCount,
} from '@/utils/panuelo';

/** Lo más alto que llega la lista: el resto de la hoja es título y aire. */
const LIST_MAX_SHARE = 0.55;
const DOT = 40;
const TOUCH = 56;

type Props = {
  visible: boolean;
  isDark: boolean;
  catalog: PanueloCatalog;
  history: PanueloMemory[];
  onClose: () => void;
  onSelect: (memory: PanueloMemory) => void;
};

/** «1 pieza» / «3 piezas». */
export const piecesLabel = (n: number) =>
  `${n} ${n === 1 ? 'pieza' : 'piezas'}`;

/**
 * «Mis pañuelos»: los que fuiste dejando al cambiar de etapa. Cada uno se ve
 * en el visor, solo para mirar.
 */
export function PanueloHistorySheet({
  visible,
  isDark,
  catalog,
  history,
  onClose,
  onSelect,
}: Props) {
  const t = themeColors(isDark);
  const { height } = useWindowDimensions();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Mis pañuelos">
      <ScrollView
        style={{ maxHeight: height * LIST_MAX_SHARE }}
        contentContainerStyle={styles.list}
      >
        {history.map((memory) => {
          const label = COLOR_LABEL[memory.color];
          const until = `Hasta ${formatMonthYear(memory.at)}`;
          const count = piecesLabel(memoryPieceCount(catalog, memory));
          return (
            <PressableFeedback
              key={memory.at}
              onPress={() => onSelect(memory)}
              accessibilityRole="button"
              accessibilityLabel={`Pañuelo ${label.name.toLowerCase()}, ${label.stage}. ${until}. ${count}.`}
              accessibilityHint="Lo enseña en el visor, solo para verlo"
              style={styles.row}
            >
              <PressableFeedback.Highlight />
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: PanueloColors.cloth[memory.color],
                    borderColor: t.separator,
                  },
                ]}
              />
              <View style={styles.texts}>
                <Text style={[styles.name, { color: t.text }]}>
                  Pañuelo {label.name.toLowerCase()} · {label.stage}
                </Text>
                <Text style={[styles.meta, { color: t.textSecondary }]}>
                  {until} · {count}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={t.icon} />
            </PressableFeedback>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TOUCH,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pillFull,
    borderWidth: StyleSheet.hairlineWidth,
  },
  texts: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
  },
  meta: {
    ...typography.caption,
  },
});
