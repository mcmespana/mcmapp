// app/(tabs)/comunica/pagos/index.tsx — «Pagos» (plan 15): lo pendiente, lo que se cobrará por domiciliación y lo pagado. `nota`: «pagado» o «error» (la vuelta
// de la pasarela por la web).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PaymentsScreen from '@/components/comunica/pagos/PaymentsScreen';

export default function ComunicaPayments() {
  const { nota } = useLocalSearchParams<{ nota?: string }>();
  return <PaymentsScreen note={nota} />;
}
