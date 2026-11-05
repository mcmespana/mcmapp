// app/(tabs)/comunica/forma-pago/index.tsx — «Forma de pago» (05/11/2026): cómo paga quien ha entrado (domiciliación, transferencia o Bizum), su IBAN y el titular.
// Es de quien paga, no de a quien se ve: viendo a un menor se dice que es la del familiar. A donde llega `single_stic_forma_pago` del plugin.

import React from 'react';
import PaymentMethodScreen from '@/components/comunica/pagos/PaymentMethodScreen';

export default function ComunicaPaymentMethod() {
  return <PaymentMethodScreen />;
}
