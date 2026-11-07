// El círculo del estado de una lista (árbol e historial, plan 04): ✓ pasada,
// hueco ámbar pendiente, «No hubo» (sin registro), «Subiendo» si está en la
// cola. Con su leyenda.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { onColor } from '@/utils/colorUtils';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export type DotState = 'taken' | 'skipped' | 'missing' | 'queued';

export const DOT_LABEL: Record<DotState, string> = {
  taken: 'Pasada',
  skipped: 'No hubo',
  missing: 'Pendiente',
  queued: 'Pendiente de subir',
};

const SIZE = 22;

export default function RollStateDot({ state }: { state: DotState }) {
  const t = useComunicaTheme();
  if (state === 'skipped') {
    return (
      <Text
        style={[styles.skipped, { color: t.textSecondary }]}
        accessibilityLabel="Sin registro"
      >
        No hubo
      </Text>
    );
  }
  if (state === 'taken') {
    return (
      <View
        accessible
        accessibilityLabel="Pasada"
        style={[styles.dot, { backgroundColor: MARK_FILL.yes }]}
      >
        <IconSymbol
          name="checkmark"
          size={13}
          color={onColor(MARK_FILL.yes)}
          weight="bold"
        />
      </View>
    );
  }
  if (state === 'queued') {
    return (
      <View
        accessible
        accessibilityLabel="Pendiente de subir"
        style={[styles.dot, { backgroundColor: t.backgroundSunken }]}
      >
        <IconSymbol name="iphone" size={13} color={t.textSecondary} />
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel="Pendiente"
      style={[styles.dot, styles.ring, { borderColor: t.warningIcon }]}
    />
  );
}

export function RollStateLegend() {
  const t = useComunicaTheme();
  return (
    <View style={styles.legend}>
      {(['taken', 'missing', 'skipped'] as const).map((s) => (
        <View key={s} style={styles.item}>
          {s === 'skipped' ? null : <RollStateDot state={s} />}
          <Text style={[styles.legendText, { color: t.textSecondary }]}>
            {s === 'skipped' ? '«No hubo» = sin registro' : DOT_LABEL[s]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { borderWidth: 2, borderStyle: 'dashed' },
  skipped: { ...typography.footnote, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { ...typography.caption },
});
