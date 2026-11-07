// La marca de asistencia: el círculo de la fila (`MarkIcon`) y el selector de
// las cuatro (`MarkPicker`), para la pulsación larga y para quien no puede
// hacerla (accesibilidad: la misma opción en un menú visible).
//
// Mismos iconos y significado que el plugin (`PASAR-LISTA.md` §6): Vino ✓,
// Parcial ◐, Justificada −, No vino ✕. «Sin marcar» es un aro vacío: un quinto
// estado, no una falta. Los colores, de `theme.ts`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { Mark, SetMark } from '@/services/comunica/contract';
import { onColor } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import { MARK_ICON, MARK_LABEL, MARK_ORDER } from '@/utils/comunica/marks';
import { MARK_FILL } from './theme';
import { useComunicaTheme } from './useComunicaTheme';

const SIZE = 28;

export function MarkIcon({ mark, size = SIZE }: { mark: Mark; size?: number }) {
  const t = useComunicaTheme();
  if (!mark) {
    return (
      <View
        accessible
        accessibilityLabel="Sin marcar"
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderColor: t.textMuted,
            borderWidth: StyleSheet.hairlineWidth * 3,
          },
        ]}
      />
    );
  }
  const fill = MARK_FILL[mark];
  return (
    <View
      accessible
      accessibilityLabel={MARK_LABEL[mark]}
      style={[styles.dot, { width: size, height: size, backgroundColor: fill }]}
    >
      <IconSymbol
        name={MARK_ICON[mark]}
        size={size * 0.6}
        color={onColor(fill)}
        weight="bold"
      />
    </View>
  );
}

interface PickerProps {
  value: Mark;
  onChange: (mark: SetMark) => void;
  disabled?: boolean;
}

/** Las cuatro marcas en fila, con su nombre. La elegida, rellena. */
export function MarkPicker({ value, onChange, disabled }: PickerProps) {
  const t = useComunicaTheme();
  return (
    <View style={styles.picker} accessibilityRole="radiogroup">
      {MARK_ORDER.map((m) => {
        const selected = value === m;
        return (
          <PressableFeedback
            key={m}
            isDisabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={MARK_LABEL[m]}
            accessibilityState={{ selected, disabled }}
            onPress={() => {
              h.select();
              onChange(m);
            }}
            style={[
              styles.option,
              {
                backgroundColor: selected ? t.backgroundSunken : 'transparent',
                borderColor: selected ? MARK_FILL[m] : t.separator,
              },
            ]}
          >
            <PressableFeedback.Scale />
            <MarkIcon mark={m} size={SIZE} />
            <Text
              style={[styles.optionLabel, { color: t.text }]}
              numberOfLines={1}
            >
              {MARK_LABEL[m]}
            </Text>
          </PressableFeedback>
        );
      })}
    </View>
  );
}

/** La leyenda de la pantalla de marcar. */
export function MarkLegend() {
  const t = useComunicaTheme();
  return (
    <View style={styles.legend}>
      {MARK_ORDER.map((m) => (
        <View key={m} style={styles.legendItem}>
          <MarkIcon mark={m} size={20} />
          <Text style={[styles.legendLabel, { color: t.textSecondary }]}>
            {MARK_LABEL[m]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 4,
  },
  optionLabel: { ...typography.footnote, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { ...typography.caption },
});
