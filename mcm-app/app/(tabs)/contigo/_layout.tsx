import React from 'react';
import { Stack } from 'expo-router';

export default function ContigoLayout() {
  return (
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
    </Stack>
  );
}
