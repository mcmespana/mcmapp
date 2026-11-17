/**
 * «Cantos con las lecturas del domingo»: la entrada a las sugerencias para la
 * misa, al final de «Tu selección» vacía. Va discreta y debajo de lo de traer
 * la playlist del coro, que es lo que hace casi todo el mundo; esto es para
 * quien elige los cantos. Abre «Cantos para el domingo» (lecturas, fiesta y
 * cantos que encajan). Doc: `docs/funcionalidades/CANTOS_DOMINGO.md`.
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
import { h } from '@/utils/haptics';
import {
  isoDateLocal,
  liturgicalDayOf,
  shortDateEs,
  targetSunday,
} from '@/utils/liturgicalDay';

/** El círculo del icono, teñido con el color litúrgico. */
const BADGE = 40;
/** Área táctil mínima (design.md §1). */
const MIN_HEIGHT = 64;

export default function SundaySongsButton() {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const large = useLargeText();
  // Sin memo: la pestaña puede quedarse montada días y el domingo cambia.
  const fecha = targetSunday(isoDateLocal());
  const day = liturgicalDayOf(fecha);
  const what = day.feastName ?? day.name;

  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        openCantoral('SundaySongs', { fecha });
      }}
      style={[
        styles.row,
        { backgroundColor: roles.background, borderColor: roles.separator },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Cantos con las lecturas del domingo, ${shortDateEs(fecha)}, ${what}`}
    >
      <PressableFeedback.Highlight />
      <View style={[styles.badge, { backgroundColor: roles.backgroundSunken }]}>
        <MaterialIcons name="auto-stories" size={20} color={roles.link} />
        <View
          style={[
            styles.dot,
            {
              backgroundColor: day.colorHex,
              borderColor: roles.background,
            },
          ]}
        />
      </View>
      <View style={styles.text}>
        <Text
          style={[typography.title, { color: roles.text }]}
          numberOfLines={large ? 3 : 2}
        >
          Cantos con las lecturas del domingo
        </Text>
        <Text
          style={[typography.caption, { color: roles.textSecondary }]}
          numberOfLines={large ? 3 : 2}
        >
          {shortDateEs(fecha)} · {what}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={roles.textMuted} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_HEIGHT,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El color del día, como una gota en la esquina del icono.
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: radii.pillFull,
    borderWidth: 2,
  },
  text: { flex: 1, gap: 2 },
});
