// «Forma de pago» (05/11/2026): la lectura y la escritura.
//
//   · Lleva el IBAN (tapado) y el titular: NADA en el móvil. `persist: false` en el contrato (`paymentMethod`), memoria 5 min y `staleTime: 0`.
//   · Es de QUIEN PAGA: quien ha entrado. `pid` solo dice qué perfil se mira (uno mismo o un hijo); el servidor lo comprueba y escribe siempre en la ficha de
//     quien ha entrado.
//   · Sin cola: se escribe DIRECTO y con conexión (lleva el IBAN). Un `clientId` por «Guardar»: el mismo mientras falla por red o CRM caído y el cuerpo no
//     cambia (así el servidor no escribe dos veces); si lo escrito cambia, uno nuevo.
//   · Al guardar bien, lo releído que devuelve el servidor sustituye a lo leído y se vuelve a pedir lo que depende de la cuenta (Pagos).

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type {
  PaymentMethodInfo,
  PaymentMethodRead,
  PaymentMethodSaved,
  PaymentMethodWrite,
} from '@/services/comunica/contract';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey, useAreaQuery } from './useAreaQuery';

const GC = 5 * 60_000;

export const paymentMethodKey = (pid: string) => ['forma-pago', pid] as const;

/** Lo releído que trae `PUT` (`current`) no lleva `generatedAt`: se le pone la hora de ahora para dejarlo como una lectura. */
const stamped = (info: PaymentMethodInfo): PaymentMethodRead => ({
  ...info,
  generatedAt: new Date().toISOString(),
});

export function usePaymentMethod(pid: string | null | undefined) {
  return useAreaQuery({
    key: [...paymentMethodKey(pid ?? '')],
    route: 'paymentMethod',
    fetch: () => getComunicaApi().getPaymentMethod(pid!),
    staleTime: 0,
    gcTime: GC,
    enabled: !!pid,
    retry: false,
  });
}

/** ¿Vale la pena reintentar con el MISMO `clientId`? Red y CRM caído sí; lo demás es otra petición. */
const retryable = (e: unknown) => isComunicaApiError(e) && e.retryable;

/**
 * Guardar la forma de pago. Lanza el error (`validation` con su `reason`, `crm_unavailable`…); quien llama decide qué decir. Con éxito responde con lo que ha
 * pasado con lo pendiente de cobro.
 */
export function useSavePaymentMethod(pid: string) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  // El `clientId` y la huella del cuerpo con el que se pidió (en memoria: lleva el IBAN que se escribió, y nunca sale de aquí).
  const pending = useRef<{ fingerprint: string; clientId: string } | null>(
    null,
  );

  const save = useCallback(
    async (
      body: Omit<PaymentMethodWrite, 'clientId'>,
    ): Promise<PaymentMethodSaved> => {
      const fingerprint = JSON.stringify(body);
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, clientId: uuidV4() };
      const clientId = pending.current.clientId;
      setSaving(true);
      try {
        const r = await getComunicaApi().savePaymentMethod(pid, {
          ...body,
          clientId,
        });
        pending.current = null;
        qc.setQueryData(
          areaKey([...paymentMethodKey(pid)]),
          stamped(r.current),
        );
        // La forma de pago es la misma para todo lo que se mire (un hijo y uno mismo) y la cuenta se ve en cada pago.
        // La de ahora ya es lo releído; las de otras personas (la fila de «Datos de Lucía») se vuelven a pedir.
        void qc.invalidateQueries({
          queryKey: areaKey(['forma-pago']),
          predicate: (q) => q.queryKey[q.queryKey.length - 1] !== pid,
        });
        void qc.invalidateQueries({ queryKey: areaKey(['pagos']) });
        return r;
      } catch (e) {
        if (!retryable(e)) pending.current = null;
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [pid, qc],
  );
  return { save, saving };
}
