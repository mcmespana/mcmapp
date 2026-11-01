// app/(tabs)/comunica/inscripciones/[registrationId]/index.tsx — la ficha de una inscripción (plan 14). `note` = lo que se acaba de hacer; `msg=pagado`, la vuelta del
// pago con tarjeta («esperando al banco»).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RegistrationDetailScreen from '@/components/comunica/inscripciones/RegistrationDetailScreen';

export default function ComunicaRegistrationDetail() {
  const { registrationId, note, msg } = useLocalSearchParams<{
    registrationId: string;
    note?: string;
    msg?: string;
  }>();
  return (
    <RegistrationDetailScreen
      registrationId={registrationId}
      note={note}
      waiting={msg === 'pagado'}
    />
  );
}
