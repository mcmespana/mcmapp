import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import useLargeText from '@/hooks/useLargeText';

/**
 * Columna fija y centrada que, con la letra del sistema grande
 * (`useLargeText`), pasa a hacer scroll (y sigue centrada si cabe), para que
 * nada quede cortado ni fuera de la pantalla. Con la letra normal es la misma
 * `View` de siempre: no cambia nada.
 *
 * `large` se puede forzar (p. ej. para que el padre decida con su propio hook);
 * si no se pasa, se lee de `useLargeText()`.
 */
export default function ScrollWhenLarge({
  large: largeProp,
  style,
  largeStyle,
  children,
}: {
  large?: boolean;
  style: StyleProp<ViewStyle>;
  /** Estilo extra del contenido SOLO con letra grande. */
  largeStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const largeHook = useLargeText();
  const large = largeProp ?? largeHook;
  if (!large) return <View style={style}>{children}</View>;
  // `flex: 1` en el contenido de un ScrollView le impide crecer y hacer
  // scroll: se cambia por `flexGrow: 1` (centra si cabe, crece si no).
  const content = { ...StyleSheet.flatten(style), flex: undefined };
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[content, { flexGrow: 1 }, largeStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
