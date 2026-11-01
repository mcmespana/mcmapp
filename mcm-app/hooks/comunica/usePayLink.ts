// A dónde lleva «Pagar … con tarjeta» y «Ver el pago» HASTA que el plan 15 tenga sus pantallas (`pagos/pagar`, `pagos/[id]`): a la web del plugin con la
// sesión puesta y el perfil que se ve. Con un pago pendiente, su formulario; sin él, la lista de pagos. El 15 sustituye esto por rutas nativas.

import { useCallback } from 'react';
import { useActiveProfile } from './useActiveProfile';
import { useOpenLegacy } from './useOpenLegacy';

export function usePayLink() {
  const openLegacy = useOpenLegacy();
  const { active, isSelf } = useActiveProfile();
  const profileId = !isSelf && active ? active.id : undefined;
  const pay = useCallback(
    (paymentId: string | null) =>
      paymentId
        ? openLegacy(
            { internalpage: 'single_stic_payment_form', id: paymentId },
            'Pago',
            profileId,
          )
        : openLegacy(
            { internalpage: 'list_stic_payments' },
            'Pagos',
            profileId,
          ),
    [openLegacy, profileId],
  );
  const view = useCallback(
    (paymentId: string) =>
      openLegacy(
        {
          internalpage: 'single_stic_payments',
          action: 'detail',
          id: paymentId,
        },
        'Pago',
        profileId,
      ),
    [openLegacy, profileId],
  );
  return { pay, view };
}
