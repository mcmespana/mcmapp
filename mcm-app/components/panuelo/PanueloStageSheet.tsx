import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';

import BottomSheet from '@/components/BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { MaterialIcons } from '@/components/ui/icons';
import { PanueloColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { PanueloColor } from '@/types/panuelo';
import { COLOR_LABEL } from '@/utils/panuelo';

const TOUCH = 48;

type Props = {
  visible: boolean;
  isDark: boolean;
  /** El pañuelo de ahora. */
  from: PanueloColor;
  /** El que se ha tocado. */
  to: PanueloColor;
  /** Cuántas piezas lleva cosidas el de ahora. Sin ninguna no hay recuerdo. */
  placedCount: number;
  onClose: () => void;
  /** `keepPieces`: las piezas siguen cosidas (true) o vuelven a la colección. */
  onConfirm: (keepPieces: boolean) => void;
};

/**
 * La hoja de cambio de pañuelo (de etapa): un cambio que pasa una vez cada
 * varios años y que no se hace a la ligera. El pañuelo de ahora se guarda como
 * recuerdo, y quien cambia decide qué hace con sus piezas.
 */
export function PanueloStageSheet({
  visible,
  isDark,
  from,
  to,
  placedCount,
  onClose,
  onConfirm,
}: Props) {
  const t = themeColors(isDark);
  const next = COLOR_LABEL[to];
  const goes = `Pasas al pañuelo ${next.name.toLowerCase()} (${next.stage}).`;
  const hasMemory = placedCount > 0;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="¿Cambias de pañuelo?"
    >
      <View style={styles.body}>
        <Text style={[styles.text, { color: t.text }]}>
          {hasMemory
            ? `Tu pañuelo ${COLOR_LABEL[from].name.toLowerCase()} se guarda como recuerdo. ${goes}`
            : goes}
        </Text>
        {hasMemory ? (
          <>
            <Text style={[styles.text, { color: t.textSecondary }]}>
              Si empiezas con el pañuelo limpio, las piezas vuelven a tu
              colección: no se pierden.
            </Text>
            <AppPrimaryButton
              label="Llevarme las piezas"
              icon="push-pin"
              color={PanueloColors.cloth[to]}
              onPress={() => onConfirm(true)}
            />
            <PressableFeedback
              onPress={() => onConfirm(false)}
              accessibilityRole="button"
              accessibilityLabel="Empezar con el pañuelo limpio"
              style={[
                styles.secondary,
                { backgroundColor: t.backgroundSunken },
              ]}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons name="inventory-2" size={18} color={t.link} />
              <Text style={[styles.secondaryLabel, { color: t.link }]}>
                Empezar con el pañuelo limpio
              </Text>
            </PressableFeedback>
          </>
        ) : (
          <AppPrimaryButton
            label="Cambiar de pañuelo"
            icon="check"
            color={PanueloColors.cloth[to]}
            onPress={() => onConfirm(true)}
          />
        )}
        <PressableFeedback
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
          style={styles.cancel}
        >
          <Text style={[styles.secondaryLabel, { color: t.link }]}>
            Cancelar
          </Text>
        </PressableFeedback>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  text: {
    ...typography.body,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  secondaryLabel: {
    ...typography.button,
    textAlign: 'center',
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH,
  },
});
