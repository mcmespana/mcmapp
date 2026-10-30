// Una celda de lista agrupada (la superficie de `Section`, pero fila a fila,
// para listas largas en `FlatList`): las esquinas y el hairline según su
// sitio en el bloque.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radii } from '@/constants/uiStyles';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export type CellPosition = 'first' | 'middle' | 'last' | 'only';

export const cellPosition = (i: number, n: number): CellPosition =>
  n === 1 ? 'only' : i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle';

export default function ListCell({
  position,
  children,
  tint,
}: {
  position: CellPosition;
  children: React.ReactNode;
  /** Fondo distinto del de la tarjeta (la tarjeta ámbar de los sueltos). */
  tint?: string;
}) {
  const t = useComunicaTheme();
  const top = position === 'first' || position === 'only';
  const bottom = position === 'last' || position === 'only';
  return (
    <View
      style={[
        styles.cell,
        {
          backgroundColor: tint ?? t.card,
          borderTopLeftRadius: top ? radii.lg : 0,
          borderTopRightRadius: top ? radii.lg : 0,
          borderBottomLeftRadius: bottom ? radii.lg : 0,
          borderBottomRightRadius: bottom ? radii.lg : 0,
        },
      ]}
    >
      {!top ? (
        <View style={[styles.separator, { backgroundColor: t.separator }]} />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { marginHorizontal: 16, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
