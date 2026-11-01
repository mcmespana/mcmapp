// El resultado de un pago con tarjeta (plan 15, regla 11), en la misma pantalla «Pagar»: icono grande, título, texto y dos botones. Sin confeti: es dinero,
// no un logro. Los textos salen de `cardAttempt.ts` (`resultCopy`).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import type { ResultCopy } from '@/utils/comunica/cardAttempt';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function PaymentResult({
  copy,
  onPrimary,
  onSecondary,
}: {
  copy: ResultCopy;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const t = useComunicaTheme();
  const icon =
    copy.tone === 'success'
      ? 'checkmark.circle.fill'
      : copy.tone === 'wait'
        ? 'clock'
        : 'xmark.circle.fill';
  const color =
    copy.tone === 'success'
      ? t.accentText
      : copy.tone === 'wait'
        ? t.textSecondary
        : t.dangerText;
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <IconSymbol name={icon} size={64} color={color} />
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.text }]}
      >
        {copy.title}
      </Text>
      {copy.body ? (
        <Text style={[styles.body, { color: t.textSecondary }]}>
          {copy.body}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        <AreaPrimaryButton label={copy.primary} onPress={onPrimary} haptic />
        {copy.secondary ? (
          <PressableFeedback
            onPress={onSecondary}
            accessibilityRole="button"
            accessibilityLabel={copy.secondary}
            style={styles.secondary}
          >
            <Text style={[styles.secondaryLabel, { color: t.accentText }]}>
              {copy.secondary}
            </Text>
          </PressableFeedback>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  title: { ...typography.h2, textAlign: 'center' },
  body: { ...typography.body, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', gap: 8, marginTop: 16 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { ...typography.button },
});
