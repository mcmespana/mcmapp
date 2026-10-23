// app/(tabs)/comunica/_layout.tsx
//
// Pestaña Comunica. Era un fichero suelto con la WebView; desde el plan 01 del
// área nativa (`docs/planes/area-nativa/01-cimientos.md`) es una carpeta con
// su `Stack`, como `contigo/`:
//
//   index    → la puerta: área nativa o la WebView de siempre (el legado).
//   lista    → marcar la lista de un grupo en una sesión (Pasar Lista).
//   web      → el legado abierto a propósito (comparar, o lo que no es nativo).
//   muestra  → los componentes del área de un vistazo (solo desarrollo/preview).
//
// El `QueryClient` del área vive aquí y no en la raíz: no toca al resto de la
// app y se va con el interruptor.

import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import ComunicaQueryProvider from '@/components/comunica/comun/ComunicaQueryProvider';
import { TabHeaderColors, themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ComunicaLayout() {
  const isDark = useColorScheme() === 'dark';
  const ios = Platform.OS === 'ios';
  const tint = ios ? themeColors(isDark).headerTint : '#fff';
  return (
    <ComunicaQueryProvider>
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: tint,
          headerShadowVisible: false,
          // iOS: cabecera del sistema, transparente arriba y cristal al hacer
          // scroll (como el cantoral). Android y web: la barra del color de la
          // pestaña con el texto en blanco, como el resto de pestañas.
          headerTransparent: ios,
          headerStyle: ios
            ? { backgroundColor: 'transparent' }
            : { backgroundColor: TabHeaderColors.comunica },
          headerTitleStyle: { color: tint },
          ...(ios && parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Comunica' }} />
        <Stack.Screen name="lista" options={{ title: 'Lista' }} />
        <Stack.Screen name="web" options={{ headerShown: false }} />
        <Stack.Screen name="muestra" options={{ title: 'Muestra' }} />
      </Stack>
    </ComunicaQueryProvider>
  );
}
