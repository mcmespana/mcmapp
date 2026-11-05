// La tarjeta del área privada (`stic-rec-card` del plugin): fondo de card,
// borde de 1 px, radio lg y la sombra suave de la app. Es la superficie de
// todo lo que sea «un registro»; las tarjetas hechas a mano (`radii.lg` +
// `shadows.card` + `t.card`) pasan por aquí.
//
//   · Claro: card blanca + borde gris suave + sombra.
//   · Oscuro: `separator` y `card` son el mismo gris, así que la tarjeta la
//     dibuja el BORDE (`t.cardBorder`), no la sombra (regla 11 de
//     `AREA_NATIVA_DISENO.md`).
//   · `clip`: recorta el contenido al radio (degradado, `Highlight`, filas con
//     separadores). En iOS `overflow: 'hidden'` recorta también la sombra de la
//     misma vista, así que con `clip` van DOS capas: fuera la sombra, el borde y
//     el fondo; dentro el recorte.
//   · Android: la sombra es `elevation` y solo existe con `backgroundColor` en
//     la misma vista; por eso el fondo va en la capa de fuera.
//   · `elevated`: la sombra de las destacadas (`shadows.raised`).

import React from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { radii, shadows } from '@/constants/uiStyles';
import { useComunicaTheme } from './useComunicaTheme';

interface Props extends ViewProps {
  children?: React.ReactNode;
  /** Recorta el contenido al radio de la tarjeta. */
  clip?: boolean;
  /** Sombra de tarjeta destacada. */
  elevated?: boolean;
  /** Fondo propio (la «advertencia» ámbar de `Section`). */
  background?: string;
  style?: StyleProp<ViewStyle>;
}

export default function CardSurface({
  children,
  clip = false,
  elevated = false,
  background,
  style,
  ...rest
}: Props) {
  const t = useComunicaTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        elevated ? shadows.raised : shadows.card,
        { backgroundColor: background ?? t.card, borderColor: t.cardBorder },
        style,
      ]}
    >
      {clip ? <View style={styles.clip}>{children}</View> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1 },
  clip: { borderRadius: radii.lg, overflow: 'hidden' },
});
