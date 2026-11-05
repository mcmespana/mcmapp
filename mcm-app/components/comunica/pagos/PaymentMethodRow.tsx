// La fila de «Datos de Lucía» (05/11/2026): dice cuál es la forma de pago con la que se cobran las cosas de Lucía —la de quien ha entrado, que es quien
// paga— y lleva a cambiarla: «Forma de pago · La tuya, Domiciliación bancaria · ES93 •••• 8644 · titular: Marta» con «Cambiar» (o «Indicarla» si no hay nada).
// Quien la pinta decide si hay ficha LEÍDA; sin ella la fila no sale (no se inventa «todavía no has indicado la tuya»).

import React from 'react';
import { useRouter } from 'expo-router';
import type { PaymentMethodInfo } from '@/services/comunica/contract';
import {
  memberRow,
  PAYMENT_METHOD_COPY as C,
} from '@/utils/comunica/paymentMethod';
import NavRow from '../comun/NavRow';

export default function PaymentMethodRow({
  info,
}: {
  info: PaymentMethodInfo;
}) {
  const router = useRouter();
  const { subtitle, action } = memberRow(info);
  return (
    <NavRow
      icon="creditcard"
      title={C.row.title}
      subtitle={subtitle}
      trailing={action}
      onPress={() => router.push('/comunica/forma-pago' as never)}
    />
  );
}
