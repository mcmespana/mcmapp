import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TabScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
}

/**
 * Contenedor de pantalla de pestaña con el área segura. Antes pintaba en iOS
 * una raya de 8 px con el color de la pestaña arriba del todo; se quitó (es un
 * adorno que no dice nada y la pestaña activa ya se ve en la barra).
 */
export default function TabScreenWrapper({
  children,
  style,
  edges = ['top'],
}: TabScreenWrapperProps) {
  return (
    <SafeAreaView style={style} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
