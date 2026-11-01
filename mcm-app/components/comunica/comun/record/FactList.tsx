// Los datos de una ficha de registro (plan 14, `stic-record-view`): filas con icono, la etiqueta en `caption` y el dato en `body`, en UNA tarjeta y
// separadas por un hairline. Nunca «ETIQUETA: valor». Una fila con `onPress` es entera pulsable (44 pt) con flecha.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export interface Fact {
  icon: IconName;
  label: string;
  value: string;
  /** Con él, la fila es un botón (y se lee con `actionLabel`). */
  onPress?: () => void;
  actionLabel?: string;
}

export default function FactList({ facts }: { facts: readonly Fact[] }) {
  const t = useComunicaTheme();
  if (facts.length === 0) return null;
  return (
    <View style={[styles.card, shadows.card, { backgroundColor: t.card }]}>
      {facts.map((f, i) => {
        const edge =
          i === 0
            ? null
            : {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: t.separator,
              };
        const body = (
          <>
            <IconSymbol name={f.icon} size={20} color={t.textSecondary} />
            <View style={styles.text}>
              <Text style={[styles.label, { color: t.textSecondary }]}>
                {f.label}
              </Text>
              <Text style={[styles.value, { color: t.text }]}>{f.value}</Text>
            </View>
            {f.onPress ? (
              <IconSymbol
                name="chevron.right"
                size={16}
                color={t.textSecondary}
              />
            ) : null}
          </>
        );
        return f.onPress ? (
          <PressableFeedback
            key={`${f.label}-${i}`}
            onPress={() => {
              h.tap();
              f.onPress?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={f.actionLabel ?? `${f.label}: ${f.value}`}
            style={[styles.row, edge]}
          >
            {body}
          </PressableFeedback>
        ) : (
          <View
            key={`${f.label}-${i}`}
            accessible
            accessibilityLabel={`${f.label}: ${f.value}`}
            style={[styles.row, edge]}
          >
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: { flex: 1 },
  label: { ...typography.caption },
  value: { ...typography.body },
});
