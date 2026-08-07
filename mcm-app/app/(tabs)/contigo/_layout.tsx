import React from 'react';
import { Stack } from 'expo-router';
import { ContigoHabitsProvider } from '@/contexts/ContigoHabitsContext';

export default function ContigoLayout() {
  // El provider va aquí y no en el root: los únicos consumidores de
  // `useContigoHabits` son las pantallas de este stack (index, evangelio,
  // oración, revisión). Fuera de Contigo solo se importa el TIPO `DayRecord`,
  // que no necesita provider.
  return (
    <ContigoHabitsProvider>
      <Stack initialRouteName="index">
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
