import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Colors, themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { transparentHeaderOptions } from '@/components/tabs/transparentHeader';

// SDK 58: el ancla da el destino al que se vuelve al entrar por enlace.
export const unstable_settings = { anchor: 'index' };

/**
 * Pestaña de Inicio: una pila propia, como las demás pestañas, para tener la
 * cabecera NATIVA (logo y «MCM App» a la izquierda; campana y perfil como
 * botones de cristal a la derecha, que pone `index.tsx`).
 *
 * La carpeta se llama `(inicio)` y no `index` a propósito: un grupo no añade
 * nada a la URL, así que la pantalla sigue siendo `/`. Su nombre de ruta
 * (`(inicio)`) lo traduce `routeNameForTab` (`utils/tabRoutes.ts`).
 */
export default function InicioLayout() {
  const scheme = useColorScheme() ?? 'light';
  const roles = themeColors(scheme === 'dark');
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: roles.headerTint,
        // iOS: transparente (el contenido pasa por debajo y el sistema pone el
        // cristal al hacer scroll), como el Cantoral y Contigo. Android y web:
        // opaca y del color de la pantalla.
        ...transparentHeaderOptions(),
        ...(Platform.OS === 'ios'
          ? {}
          : { headerStyle: { backgroundColor: Colors[scheme].background } }),
        contentStyle: { backgroundColor: Colors[scheme].background },
        ...(Platform.OS === 'android'
          ? { headerTitleAlign: 'left' as const }
          : {}),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Inicio' }} />
    </Stack>
  );
}
