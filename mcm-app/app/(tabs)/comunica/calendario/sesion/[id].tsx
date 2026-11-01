// app/(tabs)/comunica/calendario/sesion/[id].tsx — «Sesión» (plan 16): una hoja con el detalle de una sesión.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import SessionScreen from '@/components/comunica/calendario/SessionScreen';

export default function ComunicaSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionScreen id={id} />;
}
