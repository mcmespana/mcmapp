import React from 'react';
import { Stack } from 'expo-router';
import { ContigoHabitsProvider } from '@/contexts/ContigoHabitsContext';
import { useTabReselectToRoot } from '@/components/tabs/tabBarController';

// SDK 58: `initialRouteName` ya no es prop del navegador; el ancla da el
// destino al que se vuelve al entrar por enlace.
export const unstable_settings = { anchor: 'index' };

export default function ContigoLayout() {
  // Re-tap del tab: vuelve a la portada de Contigo.
  useTabReselectToRoot('contigo');
  return (
    <ContigoHabitsProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            title: 'Contigo',
          }}
        />
        <Stack.Screen
          name="bookmarks"
          options={{
            headerShown: false,
            title: 'Favoritos',
          }}
        />
        <Stack.Screen
          name="evangelio"
          options={{
            headerShown: false,
            title: 'Evangelio',
          }}
        />
        <Stack.Screen
          name="oracion"
          options={{
            headerShown: false,
            title: 'Oración',
          }}
        />
        <Stack.Screen
          name="revision"
          options={{
            headerShown: false,
            title: 'Revisión del día',
          }}
        />
      </Stack>
    </ContigoHabitsProvider>
  );
}
