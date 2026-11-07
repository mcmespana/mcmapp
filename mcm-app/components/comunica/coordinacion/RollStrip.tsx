// La TIRA de un grupo (plan 06, regla 10; el idioma del Resumen del plugin):
// una celda por sesión celebrada, de la más antigua a la más reciente.
// Pasada = verde, «sin registro» = gris, falta = hueco con borde ámbar.
//
// Las celdas de 14 × 7 no se tocan con un dedo (plan 042 del plugin, PL-6):
// la tira entera es UN toque, que abre el historial del grupo.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { radii } from '@/constants/uiStyles';
import type { RollCell } from '@/services/comunica/contract';
import { cellMark } from '@/utils/comunica/summary';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

const CELL_W = 14;
const CELL_H = 7;

export default function RollStrip({
  cells,
  label,
  onPress,
}: {
  cells: readonly RollCell[];
  /** Lo que dice el lector («C1: 10 de 12 pasadas, 2 sin pasar»). */
  label: string;
  onPress?: () => void;
}) {
  const t = useComunicaTheme();
  const strip = (
    <View style={styles.strip}>
      {cells.map((c, i) => {
        const m = cellMark(c);
        return (
          <View
            key={i}
            style={[
              styles.cell,
              m === 'ok'
                ? { backgroundColor: MARK_FILL.yes }
                : m === 'skip'
                  ? { backgroundColor: t.separator }
                  : {
                      borderColor: t.warningIcon,
                      borderWidth: StyleSheet.hairlineWidth * 2,
                    },
            ]}
          />
        );
      })}
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label}>
        {strip}
      </View>
    );
  }
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre el historial del grupo"
      style={styles.target}
    >
      {strip}
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: 44, justifyContent: 'center' },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: { width: CELL_W, height: CELL_H, borderRadius: radii.xs },
});
