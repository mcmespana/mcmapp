// app/(tabs)/comunica/_layout.tsx
//
// Pestaña Comunica. Era un fichero suelto con la WebView; desde el plan 01 del
// área nativa (`docs/planes/area-nativa/01-cimientos.md`) es una carpeta con
// su `Stack`, como `contigo/`:
//
//   index    → la puerta: área nativa o la WebView de siempre (el legado).
//   pasar-lista/grupos, pasar-lista/[groupId], …/historial → Pasar Lista.
//   grupos, grupos/[groupId], grupos/sin-grupo, grupos/persona/[personId]
//            → Grupos y fichas y la ficha del participante (plan 05).
//   acceso-codigo, acceso-elegir → entrar (plan 02; «Entra en tu área» es la
//              propia puerta cuando no hay sesión).
//   yo       → tu cuenta y salir.
//   web      → el legado abierto a propósito (comparar, o lo que no es nativo).
//   muestra  → los componentes del área de un vistazo (solo desarrollo/preview).
//
// El motor del área (consultas, sesión, caché por persona y cola) vive aquí y
// no en la raíz: no toca al resto de la app y se va con el interruptor.

import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import { TabHeaderColors, themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ComunicaLayout() {
  const isDark = useColorScheme() === 'dark';
  const ios = Platform.OS === 'ios';
  const tint = ios ? themeColors(isDark).headerTint : '#fff';
  return (
    <ComunicaAreaProvider>
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
        <Stack.Screen
          name="pasar-lista/grupos"
          options={{ title: 'Pasar lista' }}
        />
        <Stack.Screen
          name="pasar-lista/[groupId]/index"
          options={{ title: 'Lista' }}
        />
        <Stack.Screen
          name="pasar-lista/[groupId]/historial"
          options={{ title: 'Historial de listas' }}
        />
        <Stack.Screen
          name="grupos/index"
          options={{ title: 'Grupos y fichas' }}
        />
        <Stack.Screen name="grupos/[groupId]" options={{ title: 'Grupo' }} />
        <Stack.Screen
          name="grupos/sin-grupo"
          options={{ title: 'Sin grupo' }}
        />
        <Stack.Screen
          name="grupos/persona/[personId]"
          options={{ title: 'Ficha' }}
        />
        <Stack.Screen name="acceso-codigo" options={{ title: 'Código' }} />
        <Stack.Screen name="acceso-elegir" options={{ title: 'Elegir' }} />
        <Stack.Screen name="yo" options={{ title: 'Tu cuenta' }} />
        <Stack.Screen name="web" options={{ headerShown: false }} />
        <Stack.Screen name="muestra" options={{ title: 'Muestra' }} />
      </Stack>
    </ComunicaAreaProvider>
  );
}
