// Barra pegada abajo con la acción principal («Guardar lista»): por encima de
// la barra de pestañas flotante y del teclado. El contenido de la pantalla
// tiene que dejarle hueco: `BOTTOM_ACTION_BAR_SPACE`.

import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useComunicaTheme } from './useComunicaTheme';

/** Lo que ocupa la barra, para el `paddingBottom` del scroll de encima. */
export const BOTTOM_ACTION_BAR_SPACE = 120;

export default function BottomActionBar({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  // La barra de pestañas flota: se apoya justo encima (sin el respiro de
  // final de scroll que ya mete `useTabBarClearance`).
  const clearance = useTabBarClearance();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'position' : undefined}
      style={styles.wrap}
      pointerEvents="box-none"
    >
      <View
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
