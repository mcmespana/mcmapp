// Estado de una escritura de la cola (plan 01 §4): «Guardada en el móvil»,
// «Subiendo…», «Subida», «No se ha podido subir · Reintentar», «Atascada».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { useComunicaTheme } from './useComunicaTheme';

export type UploadState =
  'pending' | 'sending' | 'applied' | 'failed' | 'stuck';

const COPY: Record<UploadState, string> = {
  pending: 'Guardada en el móvil',
  sending: 'Subiendo…',
  applied: 'Subida',
  failed: 'No se ha podido subir',
  stuck: 'Atascada: no se ha podido subir',
};

const ICON = {
  pending: 'iphone',
  sending: 'icloud.and.arrow.up',
  applied: 'checkmark.icloud',
  failed: 'xmark.icloud',
  stuck: 'exclamationmark.triangle.fill',
} as const;

export default function UploadStatus({
  state,
  onRetry,
}: {
  state: UploadState;
  onRetry?: () => void;
}) {
  const t = useComunicaTheme();
  const bad = state === 'failed' || state === 'stuck';
  const color = bad ? t.warningText : t.textSecondary;
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <IconSymbol
        name={ICON[state]}
        size={16}
        color={bad ? t.warningIcon : t.textSecondary}
      />
      <Text style={[styles.text, { color }]}>{COPY[state]}</Text>
      {bad && onRetry ? (
        <PressableFeedback
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          hitSlop={12}
        >
          <Text style={[styles.text, styles.retry, { color: t.accentText }]}>
            · Reintentar
          </Text>
        </PressableFeedback>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { ...typography.caption },
  retry: { fontWeight: '600' },
});
