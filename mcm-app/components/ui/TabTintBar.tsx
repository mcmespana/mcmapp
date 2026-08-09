import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface TabTintBarProps {
  /** Color de la pestaña (`TabHeaderColors`). */
  color: string;
}

/**
 * Línea de color pegada al borde superior de la pantalla, con el color de la
 * pestaña. Es el detalle que ya tenía Fotos (la raya roja) y que identifica la
 * sección de un vistazo aunque el header sea transparente y no haya título.
 *
 * Solo iOS, igual que en Fotos: en Android el header es opaco y ya lleva su
 * propio color, así que una raya encima sobraría. Mismas medidas que el
 * `TabScreenWrapper` de Fotos para que las tres secciones se vean iguales.
 */
export default function TabTintBar({ color }: TabTintBarProps) {
  if (Platform.OS !== 'ios' || !color) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.bar, { backgroundColor: color }]}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    zIndex: 1000,
  },
});
