// app/notifications/_layout.tsx
//
// La bandeja de notificaciones: UNA lista (`index`) y el detalle de cada
// notificación (`[id]`) como pantalla propia, con la cabecera nativa del
// sistema. Antes eran dos implementaciones (una hoja desde la campana y una
// pantalla desde la push) que no hacían lo mismo.
//
// `anchor: 'index'` hace que un enlace directo al detalle (tocar una push) deje
// la lista debajo, y «volver» lleve a ella.
import React from 'react';
import { Stack } from 'expo-router';
import { Colors, themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export const unstable_settings = { anchor: 'index' };

export default function NotificationsLayout() {
  const scheme = useColorScheme();
  const roles = themeColors(scheme === 'dark');
  return (
    <Stack
      screenOptions={{
        headerTintColor: roles.link,
        headerTitleStyle: { color: Colors[scheme].text },
        headerStyle: { backgroundColor: Colors[scheme].background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors[scheme].background },
        headerTitleAlign: 'center',
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {/* Título pequeño y centrado en la misma línea que «volver» y el doble tick:
          sin título grande, que se comía media pantalla. */}
      <Stack.Screen
        name="index"
        options={{ title: 'Notificaciones', headerLargeTitle: false }}
      />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
