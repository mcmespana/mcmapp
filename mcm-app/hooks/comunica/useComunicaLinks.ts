// Los enlaces de Comunica que abren la app, en el área NATIVA (plan 10 §3).
// La puerta lo monta: recoge el enlace pendiente (si la app se abrió con él)
// y los que lleguen con la app ya abierta.

import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import {
  COMUNICA_ORIGIN,
  nativeHrefFor,
  type ComunicaLink,
} from '@/services/comunica/links';
import {
  consumePendingNativeLink,
  subscribeNativeLink,
} from '@/services/comunica/pendingLink';
import { getSessionState, signIn, signOut } from '@/services/comunica/session';
import { consumePendingComunicaAuthUrl } from '@/utils/pendingComunicaLink';
import { useToast } from '@/contexts/AppToastContext';
import { useOpenLegacy } from './useOpenLegacy';

const confirm = (title: string, body: string) =>
  new Promise<boolean>((resolve) => {
    if (Platform.OS === 'web') {
      resolve(true);
      return;
    }
    Alert.alert(title, body, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Entrar', onPress: () => resolve(true) },
    ]);
  });

export function useComunicaLinks() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const openLegacy = useOpenLegacy();

  useEffect(() => {
    const handle = async (link: ComunicaLink) => {
      // Este modo se queda el enlace: el del legado sobra.
      consumePendingComunicaAuthUrl();
      if (link.kind === 'appAccess') {
        router.push({
          pathname: '/comunica/acceso-codigo',
          params: { link: link.linkToken },
        });
        return;
      }
      if (link.kind === 'event') {
        // La ficha nativa del evento llega con el plan 13.
        router.push({
          pathname: '/comunica/web',
          params: { url: `${COMUNICA_ORIGIN}/actividades/?e=${link.slug}` },
        });
        return;
      }
      if (link.kind === 'other') {
        router.push({ pathname: '/comunica/web', params: { url: link.url } });
        return;
      }
      if (link.auth) {
        try {
          const res = await getComunicaApi().exchange(
            link.auth.magic
              ? { magic: link.auth.magic }
              : { token: link.auth.token! },
          );
          if ('choose' in res) return;
          const current = getSessionState();
          if (
            current.status === 'signedIn' &&
            current.me &&
            current.me.personId !== res.me.personId
          ) {
            const first = res.me.name.split(' ')[0];
            const ok = await confirm(
              `Este enlace es para ${first}`,
              `¿Salir y entrar como ${res.me.name}?`,
            );
            if (!ok) return;
            await signOut();
            qc.clear();
          }
          await signIn(res, res.me);
        } catch {
          toast.show({
            variant: 'warning',
            label: 'El enlace ha caducado. Entra con un código.',
          });
          return;
        }
      }
      if (link.destination) {
        const native = nativeHrefFor(link.destination);
        if (native) router.push(native as never);
        else await openLegacy(link.destination, 'Comunica');
      }
    };
    const pending = consumePendingNativeLink();
    if (pending) void handle(pending);
    return subscribeNativeLink((l) => void handle(l));
  }, [router, qc, toast, openLegacy]);
}
