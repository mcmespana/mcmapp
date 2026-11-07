// Marcar y guardar la lista de un grupo (plan 04). `?sesion=<id>`; sin ella,
// la sesión que propone la regla. Cambiar de fecha es `setParams` (no apila).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RollScreen from '@/components/comunica/pasar-lista/RollScreen';

export default function PasarListaGrupo() {
  const { groupId, sesion } = useLocalSearchParams<{
    groupId: string;
    sesion?: string;
  }>();
  return <RollScreen groupId={String(groupId)} sessionId={sesion} />;
}
