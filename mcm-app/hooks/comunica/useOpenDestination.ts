// Abrir un destino del plugin desde las pantallas de familias (plan 11): lo
// nativo si ya existe (`nativeHrefFor`, plan 10) y, si no, el legado con el
// perfil puesto (viendo a un hijo, el pase pone la sesión en ese hijo).
//
// `forPid` es para quien acaba de elegir («¿A quién ves?»): el contexto aún
// no se ha enterado del cambio y diría la persona de antes.

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { nativeHrefFor, type Destination } from '@/services/comunica/links';
import { useActiveProfile } from './useActiveProfile';
import { useOpenLegacy } from './useOpenLegacy';

export function useOpenDestination() {
  const router = useRouter();
  const openLegacy = useOpenLegacy();
  const { pid, self } = useActiveProfile();
  return useCallback(
    (d: Destination, title: string, forPid?: string) => {
      const native = nativeHrefFor(d);
      if (native) {
        router.push(native as never);
        return;
      }
      const who = forPid ?? pid;
      void openLegacy(d, title, who && who !== self?.id ? who : undefined);
    },
    [router, openLegacy, pid, self?.id],
  );
}
