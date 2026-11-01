// «Sesión» (plan 16), en hoja (`formSheet`).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import SessionScreen from '@/components/comunica/calendario/SessionScreen';

export default function ComunicaSesion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionScreen id={String(id)} />;
}
