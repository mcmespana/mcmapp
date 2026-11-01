// app/(tabs)/comunica/pagos/pagar.tsx — pagar con tarjeta (plan 15). `pago=<id>` o `inscripcion=<id>`; sin ninguno no hay pantalla de pago (nunca un donativo).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PayScreen from '@/components/comunica/pagos/PayScreen';

export default function ComunicaPay() {
  const { pago, inscripcion } = useLocalSearchParams<{
    pago?: string;
    inscripcion?: string;
  }>();
  return <PayScreen pago={pago} inscripcion={inscripcion} />;
}
