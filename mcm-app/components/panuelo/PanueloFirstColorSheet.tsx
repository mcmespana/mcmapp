import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';

import BottomSheet from '@/components/BottomSheet';
import { PanueloColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { PANUELO_COLORS, type PanueloColor } from '@/types/panuelo';
import { COLOR_LABEL } from '@/utils/panuelo';

type Props = {
  visible: boolean;
  isDark: boolean;
  onPick: (color: PanueloColor) => void;
  onClose: () => void;
};

/**
 * La primera vez, sin color de Comunica ni guardado: «¿De qué color es tu
 * pañuelo?». No es un cambio de etapa: no hay recuerdo ni confeti.
 */
export function PanueloFirstColorSheet({
  visible,
  isDark,
  onPick,
  onClose,
}: Props) {
  const t = themeColors(isDark);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="¿De qué color es tu pañuelo?"
    >
      <View style={styles.body}>
        <Text style={[styles.text, { color: t.text }]}>
          Elige el de tu etapa. Podrás cambiarlo cuando cambies de pañuelo.
        </Text>
        {PANUELO_COLORS.map((c) => (
          <PressableFeedback
            key={c}
            onPress={() => onPick(c)}
            accessibilityRole="button"
            accessibilityLabel={`Pañuelo ${COLOR_LABEL[c].name.toLowerCase()}: ${COLOR_LABEL[c].stage}`}
            style={[styles.option, { backgroundColor: t.backgroundSunken }]}
          >
            <PressableFeedback.Highlight />
            <View
              style={[styles.dot, { backgroundColor: PanueloColors.cloth[c] }]}
            />
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: t.text }]}>
                {COLOR_LABEL[c].name}
              </Text>
              <Text style={[styles.optionHint, { color: t.textSecondary }]}>
                {COLOR_LABEL[c].stage}
              </Text>
            </View>
          </PressableFeedback>
        ))}
        <PressableFeedback
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Luego"
          style={styles.later}
        >
          <Text style={[styles.laterLabel, { color: t.link }]}>Luego</Text>
        </PressableFeedback>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm, paddingBottom: spacing.md },
  text: { ...typography.body, marginBottom: spacing.xs },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  dot: { width: 28, height: 28, borderRadius: 14 },
  optionText: { flex: 1 },
  optionTitle: { ...typography.body, fontWeight: '700' },
  optionHint: { ...typography.caption },
  later: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterLabel: { ...typography.body, fontWeight: '600' },
});
