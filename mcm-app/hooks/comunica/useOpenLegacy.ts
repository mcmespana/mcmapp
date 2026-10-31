// Abrir una página del plugin con la sesión puesta (plan 10 §2): pide el pase
// y va a `web.tsx`. Todo salto al legado pasa por aquí (un test lo vigila).

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useToast } from '@/contexts/AppToastContext';
import { prepareLegacy } from '@/services/comunica/legacy';
import type { Destination } from '@/services/comunica/links';

export function useOpenLegacy() {
  const router = useRouter();
  const { toast } = useToast();
  return useCallback(
    async (destination: Destination, title: string, profileId?: string) => {
      const ok = await prepareLegacy(destination, title, profileId);
      if (!ok) {
        toast.show({
          variant: 'warning',
          label: 'Necesitas conexión para abrir esto.',
        });
        return;
      }
      router.push('/comunica/web');
    },
    [router, toast],
  );
}
