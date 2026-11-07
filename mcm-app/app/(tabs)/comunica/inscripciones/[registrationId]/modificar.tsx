// app/(tabs)/comunica/inscripciones/[registrationId]/modificar.tsx — «Modificar mi inscripción» (plan 14): solo las respuestas y las necesidades especiales.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RegistrationEditScreen from '@/components/comunica/inscripciones/RegistrationEditScreen';

export default function ComunicaRegistrationEdit() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  return <RegistrationEditScreen registrationId={registrationId} />;
}
