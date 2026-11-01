// app/(tabs)/comunica/pagos/[id].tsx — la ficha de un pago (plan 15).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PaymentDetailScreen from '@/components/comunica/pagos/PaymentDetailScreen';

export default function ComunicaPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PaymentDetailScreen id={id} />;
}
