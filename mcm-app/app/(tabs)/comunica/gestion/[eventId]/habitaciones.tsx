// Las habitaciones de un evento que gestionas (plan 18): quién está en cada
// una, lo puesto a mano y quién falta por colocar.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RoomsScreen from '@/components/comunica/gestor/RoomsScreen';

export default function Habitaciones() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <RoomsScreen eventId={String(eventId)} />;
}
