import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Pestaña del calendario: stack para tener header nativo con el título
 * «Calendario» centrado y los botones que `CalendarScreen` añade a la derecha. Es la misma
 * pantalla que el stack de «Más», donde sí lleva título porque allí es una
 * pantalla apilada.
 */
export default function CalendarioLayout() {
  const isDark = useColorScheme() === 'dark';
  return (
    <>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTintColor: themeColors(isDark).headerTint,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
            color: themeColors(isDark).headerTint,
          },
          // Header transparente (como el cantoral): glass del sistema en iOS.
          headerTransparent: Platform.OS === 'ios',
          ...(Platform.OS === 'ios' &&
          parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
        }}
      >
        {/* «Calendario» centrado; los botones de la derecha (suscribirse y
            calendarios activos) los pone `CalendarScreen`. */}
        <Stack.Screen name="index" options={{ headerTitle: 'Calendario' }} />
      </Stack>
    </>
  );
}
