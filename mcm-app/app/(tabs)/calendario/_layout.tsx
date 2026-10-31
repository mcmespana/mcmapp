import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import TabTintBar from '@/components/ui/TabTintBar';
import { TabHeaderColors, themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Pestaña del calendario: stack para tener header nativo (SIN título — solo el
 * botón de calendarios, que `CalendarScreen` añade como bar item). Es la misma
 * pantalla que el stack de «Más», donde sí lleva título porque allí es una
 * pantalla apilada.
 */
export default function CalendarioLayout() {
  const isDark = useColorScheme() === 'dark';
  return (
    <>
      {/* Raya celeste del calendario pegada arriba, como la roja de Fotos. */}
      <TabTintBar color={TabHeaderColors.calendario} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
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
        {/* Sin título: la pestaña ya se llama Calendario. `headerTitle: ''`
            deja la barra vacía (transparente en iOS) para que el botón de
            suscribirse conviva con el conmutador Mes/Agenda de debajo. */}
        <Stack.Screen name="index" options={{ headerTitle: '' }} />
      </Stack>
    </>
  );
}
