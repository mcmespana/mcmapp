// La ficha de un inscrito de un evento que gestionas (plan 18).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ManagedPersonScreen from '@/components/comunica/gestor/ManagedPersonScreen';

export default function FichaGestor() {
  const { eventId, personId } = useLocalSearchParams<{
    eventId: string;
    personId: string;
  }>();
  return (
    <ManagedPersonScreen
      eventId={String(eventId)}
      personId={String(personId)}
    />
  );
}
