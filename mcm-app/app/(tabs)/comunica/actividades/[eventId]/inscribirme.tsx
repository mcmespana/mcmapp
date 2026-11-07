// app/(tabs)/comunica/actividades/[eventId]/inscribirme.tsx — el alta corta de una actividad (plan 14), o el motivo por el que no se puede.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import SignupScreen from '@/components/comunica/inscripciones/SignupScreen';

export default function ComunicaSignup() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <SignupScreen eventId={eventId} />;
}
