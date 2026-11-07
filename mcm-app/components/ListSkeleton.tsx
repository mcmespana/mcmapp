import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Skeleton } from 'heroui-native';
import { themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';

/**
 * Carga de una lista con la FORMA de la lista, sobre su mismo fondo.
 *
 * El cantoral pintaba un spinner sobre `background` (blanco) que al terminar
 * saltaba al gris de la lista (`backgroundSunken`) y la lista aparecía de
 * golpe. Las pantallas hermanas (Contactos, Grupos, Materiales…) ya cargan con
 * `Skeleton`; esto es lo mismo para una lista de filas.
 *
 * Va dentro de un `ScrollView` con `contentInsetAdjustmentBehavior` para que en
 * iOS, con la cabecera transparente, las filas empiecen debajo de ella igual
 * que lo hará la lista de verdad.
 */
export default function ListSkeleton({
  isDark,
  rows = 8,
  rowHeight = 52,
  label = 'Cargando',
  maxWidth,
}: {
  isDark: boolean;
  /** Ancho máximo de la lista real en pantalla ancha (se centra igual). */
  maxWidth?: number;
  rows?: number;
  /** Alto de una fila real, para que el contenido no salte al llegar. */
  rowHeight?: number;
  /** Lo que anuncia el lector de pantalla mientras carga. */
  label?: string;
}) {
  return (
    <ScrollView
      style={{ backgroundColor: themeColors(isDark).backgroundSunken }}
      contentContainerStyle={[
        styles.content,
        maxWidth !== undefined && {
          maxWidth,
          width: '100%',
          alignSelf: 'center',
        },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      scrollEnabled={false}
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        style={styles.rows}
      >
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} style={[styles.row, { height: rowHeight }]} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    borderRadius: radii.sm,
  },
});
