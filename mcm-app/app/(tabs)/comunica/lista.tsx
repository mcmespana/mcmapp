// app/(tabs)/comunica/lista.tsx — marcar la lista de un grupo en una sesión.
// `?sid=<sesión>&gid=<grupo>`. La pantalla, en `components/comunica/pasar-lista/`.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RollScreen from '@/components/comunica/pasar-lista/RollScreen';

export default function ComunicaLista() {
  const { sid, gid } = useLocalSearchParams<{ sid: string; gid: string }>();
  return (
    <RollScreen sessionId={String(sid ?? '')} groupId={String(gid ?? '')} />
  );
}
