// app/(tabs)/comunica/acceso-codigo.tsx — el código de 6 cifras (plan 02).
// `?k=<llave>`: el correo o el DNI y a dónde se mandó llegan EN MEMORIA
// (`acceso/handoff.ts`), no en la URL. O `?link=<token>` desde el enlace del
// correo (viene de fuera y se canjea al momento).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import AccessExpired from '@/components/comunica/acceso/AccessExpired';
import CodeScreen from '@/components/comunica/acceso/CodeScreen';
import { getCodeHandoff } from '@/components/comunica/acceso/handoff';

export default function ComunicaAccesoCodigo() {
  const p = useLocalSearchParams<{ k?: string; link?: string }>();
  if (p.link) return <CodeScreen linkToken={p.link} />;
  const h = getCodeHandoff(p.k);
  if (!h) return <AccessExpired />;
  return <CodeScreen via={h.via} value={h.value} sentTo={h.sentTo} />;
}
