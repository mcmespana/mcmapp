// Historial de listas de un grupo (plan 04).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RollHistoryScreen from '@/components/comunica/pasar-lista/RollHistoryScreen';

export default function PasarListaHistorial() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <RollHistoryScreen groupId={String(groupId)} />;
}
