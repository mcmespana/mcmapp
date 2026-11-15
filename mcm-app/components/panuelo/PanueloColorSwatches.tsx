import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';

import { PanueloColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { PANUELO_COLORS, type PanueloColor } from '@/types/panuelo';
import { COLOR_LABEL } from '@/utils/panuelo';

const TOUCH = 44;
const SWATCH = 24;
/** Cada color mide `TOUCH - sm` de ancho: se completa hasta 44 pt con hitSlop. */
const SWATCH_HIT_SLOP = { left: spacing.xs, right: spacing.xs };

type Props = {
  isDark: boolean;
  /** El pañuelo de ahora. */
  color: PanueloColor;
  /** Tocar otro color NO lo cambia: pide cambiar de etapa (la pantalla abre
   *  la hoja que pregunta qué hacer con las piezas). */
  onPick: (color: PanueloColor) => void;
};

/** Los cuatro pañuelos, uno por etapa, como un grupo de radio. */
export function PanueloColorSwatches({ isDark, color, onPick }: Props) {
  const t = themeColors(isDark);
  return (
    <View
      style={[styles.swatches, { backgroundColor: t.card }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Color del pañuelo"
    >
      {PANUELO_COLORS.map((c) => (
        <PressableFeedback
          key={c}
          onPress={() => onPick(c)}
          accessibilityRole="radio"
          accessibilityState={{ selected: c === color, checked: c === color }}
          hitSlop={SWATCH_HIT_SLOP}
          accessibilityLabel={`Pañuelo ${COLOR_LABEL[c].name.toLowerCase()}: ${COLOR_LABEL[c].stage}`}
          accessibilityHint={
            c === color
              ? undefined
              : 'Pregunta qué hacer con tus piezas antes de cambiar'
          }
          style={styles.swatchTarget}
        >
          <View
            style={[
              styles.swatch,
              { backgroundColor: PanueloColors.cloth[c] },
              c === color && [styles.swatchSelected, { borderColor: t.text }],
            ]}
          />
        </PressableFeedback>
      ))}
    </View>
  );
}

type PillProps = {
  isDark: boolean;
  /** El pañuelo que lleva. */
  color: PanueloColor;
  /** Comunica dice otro color y aún no se ha cambiado: el aviso se pulsa. */
  pending: PanueloColor | null;
  onPending: () => void;
};

/**
 * Con el color dado por Comunica no hay colores que elegir: en su sitio, la
 * etapa en texto. Si hay un cambio de etapa sin atender, es el aviso para
 * retomarlo.
 */
export function PanueloStagePill({
  isDark,
  color,
  pending,
  onPending,
}: PillProps) {
  const t = themeColors(isDark);
  const label = COLOR_LABEL[color];
  if (pending) {
    return (
      <PressableFeedback
        onPress={onPending}
        accessibilityRole="button"
        accessibilityLabel="Tienes pañuelo nuevo"
        accessibilityHint="Abre el cambio de pañuelo"
        style={[styles.pill, styles.pillButton, { backgroundColor: t.card }]}
      >
        <PressableFeedback.Highlight />
        <View
          style={[
            styles.dot,
            { backgroundColor: PanueloColors.cloth[pending] },
          ]}
        />
        <Text style={[styles.pillText, { color: t.link }]}>
          Tienes pañuelo nuevo
        </Text>
      </PressableFeedback>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: t.card }]}>
      <View
        style={[styles.dot, { backgroundColor: PanueloColors.cloth[color] }]}
      />
      <Text style={[styles.pillText, { color: t.text }]}>
        {label.name} · {label.stage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pillFull,
    ...shadows.card,
  },
  pillButton: {
    overflow: 'hidden',
  },
  pillText: {
    ...typography.button,
    flexShrink: 1,
  },
  dot: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: radii.pillFull,
  },
  swatches: {
    flexDirection: 'row',
    borderRadius: radii.pillFull,
    paddingHorizontal: spacing.xs,
    ...shadows.card,
  },
  swatchTarget: {
    width: TOUCH - spacing.sm,
    height: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: radii.pillFull,
  },
  swatchSelected: {
    borderWidth: 3,
  },
});
