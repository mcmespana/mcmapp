/**
 * La entrada a «Cantos para el domingo» en la home del cantoral: una fila, con
 * el estilo de las del cantoral, debajo de «Tu selección». Lleva el domingo que
 * toca y su fiesta o tiempo, con un punto del color litúrgico.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import useLargeText from '@/hooks/useLargeText';
import { openCantoral } from '@/utils/cantoralNavigation';
import {
  isoDateLocal,
  liturgicalDayOf,
  shortDateEs,
  targetSunday,
} from '@/utils/liturgicalDay';

/** Tamaño del punto del color litúrgico. */
const DOT = 10;
/** Área táctil mínima (design.md §1). */
const MIN_HEIGHT = 56;

export default function SundaySongsRow() {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const large = useLargeText();
  // Sin memo: la pestaña puede quedarse montada días y el domingo que toca
  // cambia; calcularlo es barato.
  const fecha = targetSunday(isoDateLocal());
  const day = liturgicalDayOf(fecha);
  const what = day.feastName ?? day.name;

  return (
    <PressableFeedback
      onPress={() => openCantoral('SundaySongs', { fecha })}
      style={[styles.row, { backgroundColor: roles.background }]}
      accessibilityRole="button"
      accessibilityLabel={`Cantos para el domingo, ${shortDateEs(fecha)}, ${what}`}
    >
      <PressableFeedback.Highlight />
      <MaterialIcons name="event" size={22} color={roles.link} />
      <View style={styles.text}>
        <Text
          style={[typography.title, { color: roles.text }]}
          numberOfLines={large ? 3 : 1}
        >
          Cantos para el domingo
        </Text>
        <View style={styles.subtitleRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: day.colorHex, borderColor: roles.textMuted },
            ]}
          />
          <Text
            style={[
              typography.caption,
              styles.subtitle,
              { color: roles.textSecondary },
            ]}
            numberOfLines={large ? 3 : 1}
          >
            {shortDateEs(fecha)} · {what}
          </Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={roles.link} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_HEIGHT,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  text: { flex: 1, gap: spacing.xs },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subtitle: { flex: 1 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pillFull,
    borderWidth: 1,
  },
});
