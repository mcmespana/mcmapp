import React from 'react';
import { Stack } from 'expo-router';
import { fotosHeaderOptions } from '@/app/screens/FotosScreen';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Pestaña de Fotos: stack propio para tener el header nativo transparente, SIN
 * texto de título (la pestaña ya se llama Fotos).
 */
export default function FotosLayout() {
  const isDark = useColorScheme() === 'dark';
  return (
    <Stack screenOptions={{ title: '', ...fotosHeaderOptions(isDark) }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
