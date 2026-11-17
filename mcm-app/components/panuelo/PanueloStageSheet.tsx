import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';

import BottomSheet from '@/components/BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { PanueloColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { PanueloColor } from '@/types/panuelo';
import { contrastRatio, onColor } from '@/utils/colorUtils';
import { COLOR_LABEL } from '@/utils/panuelo';

const TOUCH = 48;

type Props = {
  visible: boolean;
  isDark: boolean;
  /** El que se ha tocado. */
  to: PanueloColor;
  /** Cuántas piezas lleva cosidas el de ahora. Sin ninguna no hay recuerdo. */
  placedCount: number;
  /** El cambio lo ha detectado la app (cuenta de Comunica): «Tienes pañuelo nuevo». */
  detected?: boolean;
  onClose: () => void;
  /** `keepPieces`: las piezas siguen cosidas (true) o quedan sin poner. */
  onConfirm: (keepPieces: boolean) => void;
};

/** Las dos salidas son la decisión, no relleno: su explicación se ve y se lee. */
const KEEP = {
  title: 'Mantener mis chapas y pines',
  hint: 'Siguen cosidas donde están.',
};
const FRESH = {
  title: 'Empezar de cero la nueva etapa',
  hint: 'Las conservas, pero quedan sin poner.',
};
const FOOT =
  'En cualquier caso, tu pañuelo de ahora se guarda en Mis pañuelos.';

/**
 * La hoja de cambio de pañuelo (de etapa): un cambio que pasa una vez cada
 * varios años y que no se hace a la ligera. Quien cambia decide si mantiene
 * sus piezas cosidas o empieza de cero (las conserva, sin poner); en los dos
 * casos el pañuelo de ahora queda en «Mis pañuelos».
 */
export function PanueloStageSheet({
  visible,
  isDark,
  to,
  placedCount,
  detected = false,
  onClose,
  onConfirm,
}: Props) {
  const t = themeColors(isDark);
  const next = COLOR_LABEL[to];
  const cloth = PanueloColors.cloth[to];
  const goes = detected
    ? `Has cambiado de etapa: ahora es el pañuelo ${next.name.toLowerCase()} (${next.stage}).`
    : `Pasas al pañuelo ${next.name.toLowerCase()} (${next.stage}).`;
  const hasMemory = placedCount > 0;
  // Sobre el color de la tela manda el contraste, como en el botón principal.
  const ink = contrastRatio('#FFFFFF', cloth) >= 3 ? '#fff' : onColor(cloth);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={detected ? 'Tienes pañuelo nuevo' : '¿Cambias de pañuelo?'}
    >
      <View style={styles.body}>
        <Text style={[styles.text, { color: t.text }]}>{goes}</Text>
        {hasMemory ? (
          <>
            <PressableFeedback
              onPress={() => onConfirm(true)}
              accessibilityRole="button"
              accessibilityLabel={`${KEEP.title}. ${KEEP.hint}`}
              style={[styles.option, { backgroundColor: cloth }]}
            >
              <PressableFeedback.Scale />
              <Text style={[styles.optionTitle, { color: ink }]}>
                {KEEP.title}
              </Text>
              <Text style={[styles.optionHint, { color: ink }]}>
                {KEEP.hint}
              </Text>
            </PressableFeedback>
            <PressableFeedback
              onPress={() => onConfirm(false)}
              accessibilityRole="button"
              accessibilityLabel={`${FRESH.title}. ${FRESH.hint}`}
              style={[styles.option, { backgroundColor: t.backgroundSunken }]}
            >
              <PressableFeedback.Highlight />
              <Text style={[styles.optionTitle, { color: t.link }]}>
                {FRESH.title}
              </Text>
              <Text style={[styles.optionHint, { color: t.textSecondary }]}>
                {FRESH.hint}
              </Text>
            </PressableFeedback>
          </>
        ) : (
          <AppPrimaryButton
            label="Cambiar de pañuelo"
            icon="check"
            color={cloth}
            onPress={() => onConfirm(true)}
          />
        )}
        <PressableFeedback
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={detected ? 'Luego' : 'Cancelar'}
          style={styles.cancel}
        >
          <Text style={[styles.cancelLabel, { color: t.link }]}>
            {detected ? 'Luego' : 'Cancelar'}
          </Text>
        </PressableFeedback>
        {hasMemory ? (
          <Text style={[styles.foot, { color: t.textSecondary }]}>{FOOT}</Text>
        ) : null}
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
  option: {
    minHeight: TOUCH,
    gap: spacing.xs,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  optionTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  optionHint: {
    ...typography.caption,
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH,
  },
  cancelLabel: {
    ...typography.button,
    textAlign: 'center',
  },
  foot: {
    ...typography.caption,
    textAlign: 'center',
  },
});
