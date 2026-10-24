// Barra pegada abajo con la acción principal («Guardar lista»): por encima de
// la barra de pestañas flotante y del teclado. El contenido de la pantalla
// tiene que dejarle hueco, y la barra MIDE lo que ocupa (`onLayout`): con
// aviso + recuentos + botón + estado y la letra grande pasa de 170 pt, y una
// altura fija tapaba las últimas filas. Dentro de `AreaScreen` (como su
// `footer`) se lo dice sola por contexto; fuera, con `onHeightChange`.

import React, { createContext, useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useComunicaTheme } from './useComunicaTheme';

/**
 * Hueco MÍNIMO que se reserva encima de la barra de pestañas para la barra
 * (también antes de medirla). Si mide más, se reserva lo que mide.
 */
export const BOTTOM_ACTION_BAR_SPACE = 120;

/** Por aquí `AreaScreen` se entera de la altura medida de su `footer`. */
export const BottomActionBarHeightContext = createContext<
  ((height: number) => void) | null
>(null);

export default function BottomActionBar({
  children,
  onHeightChange,
}: {
  children: React.ReactNode;
  /** Altura total medida (incluido el hueco de la barra de pestañas). */
  onHeightChange?: (height: number) => void;
}) {
  const t = useComunicaTheme();
  const report = useContext(BottomActionBarHeightContext);
  // La barra de pestañas flota: se apoya justo encima (sin el respiro de
  // final de scroll que ya mete `useTabBarClearance`).
  const clearance = useTabBarClearance();
  const onLayout = (e: LayoutChangeEvent) => {
    const height = Math.ceil(e.nativeEvent.layout.height);
    report?.(height);
    onHeightChange?.(height);
  };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'position' : undefined}
      style={styles.wrap}
      pointerEvents="box-none"
    >
      <View
        testID="bottom-action-bar"
        onLayout={onLayout}
        style={[
          styles.bar,
          {
            backgroundColor: t.background,
            borderTopColor: t.separator,
            paddingBottom: clearance > 0 ? clearance - 12 : 12,
          },
        ]}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
