// A dónde lleva «Pagar … con tarjeta» y «Ver el pago» desde una inscripción (planes 14 y 15): a las pantallas nativas de Pagos. Con un pago pendiente, `pagar?pago=`;
// sin él (una inscripción sin compromiso), `pagar?inscripcion=`: el servidor lo prepara.

import { useCallback } from 'react';
import { useRouter } from 'expo-router';

export function usePayLink() {
  const router = useRouter();
  const pay = useCallback(
    (to: { paymentId: string | null; registrationId: string }) =>
      router.push({
        pathname: '/comunica/pagos/pagar',
        params: to.paymentId
          ? { pago: to.paymentId }
          : { inscripcion: to.registrationId },
      } as never),
    [router],
  );
  const view = useCallback(
    (paymentId: string) =>
      router.push({
        pathname: '/comunica/pagos/[id]',
        params: { id: paymentId },
      } as never),
    [router],
  );
  return { pay, view };
}
