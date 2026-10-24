// app/(tabs)/comunica/acceso-codigo.tsx — el código de 6 cifras (plan 02).
// `?via=email|dni&value=…&sentTo=…`, o `?link=<token>` desde el enlace del correo.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CodeScreen from '@/components/comunica/acceso/CodeScreen';

export default function ComunicaAccesoCodigo() {
  const p = useLocalSearchParams<{
    via?: string;
    value?: string;
    sentTo?: string;
    link?: string;
  }>();
  return (
    <CodeScreen
      via={p.via === 'dni' ? 'dni' : 'email'}
      value={p.value}
      sentTo={p.sentTo}
      linkToken={p.link}
    />
  );
}
