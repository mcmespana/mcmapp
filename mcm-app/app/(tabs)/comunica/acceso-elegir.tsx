// app/(tabs)/comunica/acceso-elegir.tsx — «¿Quién eres?» (plan 02).
// `?k=<llave>`: el correo con su código y los nombres de las fichas llegan EN
// MEMORIA (`acceso/handoff.ts`), nunca en la URL (en web se quedarían en el
// historial). Sin la llave, a empezar otra vez.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AccessExpired from '@/components/comunica/acceso/AccessExpired';
import ChooseScreen from '@/components/comunica/acceso/ChooseScreen';
import { getChooseHandoff } from '@/components/comunica/acceso/handoff';

export default function ComunicaAccesoElegir() {
  const { k } = useLocalSearchParams<{ k?: string }>();
  const h = getChooseHandoff(k);
  if (!h) return <AccessExpired />;
  return <ChooseScreen body={h.body} choices={h.choices} />;
}
