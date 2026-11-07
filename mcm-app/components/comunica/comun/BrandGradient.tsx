// El degradado de marca del área privada (azul → violeta → magenta, a 135°
// como en el plugin). Es la ÚNICA pieza del área que importa
// `expo-linear-gradient` y `BRAND_GRADIENT`: quien quiera degradado pone esto
// dentro de su superficie (con `overflow: 'hidden'` y su radio), y un test
// (`__tests__/comunica/territorio.test.ts`) vigila quién puede hacerlo.
//
// Dos clases (reglas en `theme.ts`):
//   · `block`: acción principal, hero de portada, tarjeta destacada. Con
//     `sheen` lleva el brillo del `::after` del hero del plugin (dos
//     degradados lineales encima: un velo blanco arriba a la derecha y una
//     sombra abajo a la izquierda; sin radiales, para que sea idéntico en iOS,
//     Android y web).
//   · `mark`: cápsula de fecha, avatar, barrita del título (≤ 72 pt).
//
// Es decoración: no recibe toques ni lo lee el lector de pantalla.

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_DIAGONAL,
  BRAND_GRADIENT,
  BRAND_SHADE,
  BRAND_SHEEN,
} from './theme';

interface Props {
  variant: 'block' | 'mark';
  /** Brillo del hero (solo tiene sentido en un `block` grande). */
  sheen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function BrandGradient({
  variant,
  sheen = false,
  style,
}: Props) {
  return (
    <View
      testID={`brand-gradient-${variant}`}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, style]}
    >
      <LinearGradient
        colors={BRAND_GRADIENT}
        start={BRAND_DIAGONAL.start}
        end={BRAND_DIAGONAL.end}
        style={StyleSheet.absoluteFill}
      />
      {sheen ? (
        <>
          <LinearGradient
            colors={BRAND_SHEEN}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.45, y: 0.55 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={BRAND_SHADE}
            start={{ x: 0.55, y: 0.45 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}
    </View>
  );
}
