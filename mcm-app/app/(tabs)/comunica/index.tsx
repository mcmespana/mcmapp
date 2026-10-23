// app/(tabs)/comunica/index.tsx
//
// La puerta de la pestaña Comunica (planes 01 §1 y 10 §1): con el modo alpha
// encendido (o el interruptor en `all`) se ve el área nativa; si no, la
// WebView de siempre, que pasa a ser el legado y no cambia en nada.
//
// Mientras no haya acceso nativo (plan 02), el área nativa solo se enciende
// con el servidor falso, que ya «entra» con una persona de prueba.

import React from 'react';
import { Stack } from 'expo-router';
import ComunicaScreen from '@/app/screens/ComunicaScreen';
import ComunicaHome from '@/components/comunica/pasar-lista/ComunicaHome';
import { useComunicaMode } from '@/hooks/comunica/useComunicaMode';

export default function ComunicaGate() {
  const mode = useComunicaMode();
  if (mode === 'legacy') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ComunicaScreen />
      </>
    );
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerLargeTitle: true }} />
      <ComunicaHome />
    </>
  );
}
