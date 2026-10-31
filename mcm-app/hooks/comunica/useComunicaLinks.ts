// Los enlaces de Comunica que abren la app, en el área NATIVA (plan 10 §3).
// La puerta lo monta: recoge el enlace pendiente (si la app se abrió con él)
// y los que lleguen con la app ya abierta.
//
// Lo que hace con cada enlace vive en `handleComunicaLink`, sin React, para
// poder probarlo: sobre todo el caso delicado, un enlace de OTRA persona con
// la sesión abierta. Antes de cambiar se intenta subir lo pendiente; si aún
// queda algo, se dice cuánto se perdería, y nunca se acepta solo (ni en web).
//
// La puerta sigue montada debajo de toda la pila de Comunica, así que también
// vigila aquí que una sesión REVOCADA (un 401 sin refresco posible) no deje a
// nadie atrapado en una pantalla interna: vuelve a la puerta, que pide entrar.

import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import {
  nativeHrefFor,
  publicPageUrl,
  type ComunicaLink,
  type Destination,
} from '@/services/comunica/links';
import { unsent, type Outbox } from '@/services/comunica/outbox';
import {
  consumePendingNativeLink,
  subscribeNativeLink,
} from '@/services/comunica/pendingLink';
import { getSessionState, signIn, signOut } from '@/services/comunica/session';
import { readDrawer } from '@/services/comunica/storage';
import {
  initialProfile,
  isGuardianOnly,
  mustChooseFirst,
  sectionOfDestination,
  type ActiveChoice,
} from '@/utils/comunica/profiles';
import { consumePendingComunicaAuthUrl } from '@/utils/pendingComunicaLink';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { useToast } from '@/contexts/AppToastContext';
import { useOpenLegacy } from './useOpenLegacy';

/** Pregunta sí/no. En web, `window.confirm`; sin él, NO (nunca se acepta solo). */
export function confirmSwitch(title: string, body: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ask = (globalThis as { confirm?: (m: string) => boolean }).confirm;
    return Promise.resolve(
      typeof ask === 'function' ? ask(`${title}\n\n${body}`) : false,
    );
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, body, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Entrar', onPress: () => resolve(true) },
    ]);
  });
}

/** El aviso cuando falla el canje del enlace: no todo es «caducado». */
export function exchangeErrorText(e: unknown): string {
  if (isComunicaApiError(e)) {
    if (e.code === 'validation' && e.reason === 'link_expired') {
      return 'El enlace ha caducado. Entra con un código.';
    }
    if (e.code === 'network' || e.code === 'crm_unavailable') {
      return 'Necesitas conexión para usar este enlace. Inténtalo en un rato.';
    }
    if (e.code === 'rate_limited') {
      return 'Demasiados intentos. Espera un poco y vuelve a probar.';
    }
  }
  return 'No se ha podido usar el enlace. Entra con un código.';
}

export const CHOOSE_TEXT =
  'Este enlace es de varias personas. Entra con un código para elegir quién eres.';

/** «una cosa» / «3 cosas» sin subir. */
const pendingText = (n: number) =>
  n === 1 ? 'un cambio sin subir' : `${n} cambios sin subir`;

export interface LinkDeps {
  push: (href: { pathname: string; params?: Record<string, string> }) => void;
  toast: (label: string) => void;
  openLegacy: (destination: Destination, title: string) => Promise<void>;
  confirm: (title: string, body: string) => Promise<boolean>;
  /** La cola de quien está dentro (para subir antes de cambiar). */
  outbox: Outbox | null;
  /** Vaciar la caché en memoria tras salir. */
  clearQueries: () => void;
}

/**
 * Antes de salir para entrar como otra persona: se intenta subir lo
 * pendiente, ya, con la sesión de quien está dentro. Devuelve lo que no ha
 * podido subir.
 */
async function tryToUpload(outbox: Outbox | null): Promise<number> {
  if (!outbox) return 0;
  for (const e of unsent(outbox.entries())) {
    // `retry` pone el intento a ahora (también lo atascado) y sube.
    await outbox.retry(e.key);
  }
  return unsent(outbox.entries()).length;
}

/**
 * ¿Hay que elegir a quién ver antes de abrir este destino? Solo para un destino de familia y solo quien es familiar a secas; se pregunta al servidor
 * quiénes son sus hijos AHORA (no se confía en lo pintado: el enlace puede llegar con la app recién abierta o recién entrada). Si no se puede
 * saber (sin conexión), no se pregunta: se abre el destino como siempre.
 */
export async function mustPickProfileFirst(
  destination: Destination,
): Promise<boolean> {
  const s = getSessionState();
  if (
    s.status !== 'signedIn' ||
    !s.me ||
    !sectionOfDestination(destination.internalpage) ||
    !isGuardianOnly(s.me)
  )
    return false;
  try {
    const { children } = await getComunicaApi().getMyProfiles();
    const saved = await readDrawer<ActiveChoice>(s.me.personId, 'profile');
    const start = initialProfile(s.me, children, saved);
    return !!mustChooseFirst(
      s.me,
      children,
      { activeId: start.activeId, chosen: start.chosen },
      destination.internalpage,
    );
  } catch {
    return false;
  }
}

export async function handleComunicaLink(
  link: ComunicaLink,
  deps: LinkDeps,
): Promise<void> {
  // Este modo se queda el enlace: el del legado sobra.
  consumePendingComunicaAuthUrl();
  if (link.kind === 'appAccess') {
    deps.push({
      pathname: '/comunica/acceso-codigo',
      params: { link: link.linkToken },
    });
    return;
  }
  const publicUrl = publicPageUrl(link);
  if (publicUrl) {
    // La ficha nativa del evento llega con el plan 13; hasta entonces, su
    // página pública (como cualquier otra página del dominio).
    deps.push({ pathname: '/comunica/web', params: { url: publicUrl } });
    return;
  }
  if (link.kind !== 'page') return;
  if (link.auth) {
    let res;
    try {
      res = await getComunicaApi().exchange(
        link.auth.magic
          ? { magic: link.auth.magic }
          : { token: link.auth.token! },
      );
    } catch (e) {
      deps.toast(exchangeErrorText(e));
      return;
    }
    if ('choose' in res) {
      deps.toast(CHOOSE_TEXT);
      return;
    }
    const current = getSessionState();
    if (
      current.status === 'signedIn' &&
      current.me &&
      current.me.personId !== res.me.personId
    ) {
      const first = res.me.name.split(' ')[0];
      const left = await tryToUpload(deps.outbox);
      const ok = await deps.confirm(
        `Este enlace es para ${first}`,
        left > 0
          ? `Tienes ${pendingText(left)}. Si sales, se ${left === 1 ? 'pierde' : 'pierden'}. ¿Salir y entrar como ${res.me.name}?`
          : `¿Salir y entrar como ${res.me.name}?`,
      );
      if (!ok) return;
      await signOut();
      deps.clearQueries();
    }
    await signIn(res, res.me);
  }
  if (link.destination) {
    // Familias (plan 11, FAM-a1): un enlace a una pantalla de familia, y quien entra es solo familiar con varios hijos que no ha elegido nunca (o
    // la sección no es de a quien se ve): primero «¿A quién ves?», con el destino; al elegir se va al destino, no a la portada.
    if (await mustPickProfileFirst(link.destination)) {
      const d = link.destination;
      deps.push({
        pathname: '/comunica/perfiles',
        params: {
          internalpage: d.internalpage,
          ...(d.action ? { action: d.action } : {}),
          ...(d.id ? { id: d.id } : {}),
          ...(d.from ? { from: d.from } : {}),
        },
      });
      return;
    }
    const native = nativeHrefFor(link.destination);
    if (native) deps.push(native);
    else await deps.openLegacy(link.destination, 'Comunica');
  }
}

/**
 * ¿Hay que volver a la puerta? Solo si la sesión se acaba de revocar y se está
 * en una pantalla interna de Comunica (no en otra pestaña, ni en la puerta).
 * «Salir» a propósito ya vuelve solo desde «Tu cuenta».
 */
export const shouldReturnToGate = (
  session: { status: string; reason?: string },
  pathname: string | null | undefined,
) =>
  session.status === 'signedOut' &&
  session.reason === 'revoked' &&
  !!pathname?.startsWith('/comunica/');

function useBackToGateWhenRevoked() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useArea();
  const revoked =
    session.status === 'signedOut' && session.reason === 'revoked';
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  // Solo al revocarse la sesión, no a cada navegación.
  useEffect(() => {
    if (!revoked) return;
    if (!shouldReturnToGate(getSessionState(), pathRef.current)) return;
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/comunica');
  }, [revoked, router]);
}

export function useComunicaLinks() {
  useBackToGateWhenRevoked();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const openLegacy = useOpenLegacy();
  // La cola cambia con la persona; el manejador lee siempre la de ahora.
  const { outbox } = useArea();
  const outboxRef = useRef(outbox);
  useEffect(() => {
    outboxRef.current = outbox;
  }, [outbox]);

  useEffect(() => {
    const handle = (link: ComunicaLink) =>
      handleComunicaLink(link, {
        push: (href) => router.push(href as never),
        toast: (label) => toast.show({ variant: 'warning', label }),
        openLegacy,
        confirm: confirmSwitch,
        get outbox() {
          return outboxRef.current;
        },
        clearQueries: () => qc.clear(),
      }).catch(() => {
        toast.show({
          variant: 'warning',
          label: 'No se ha podido usar el enlace. Entra con un código.',
        });
      });
    const pending = consumePendingNativeLink();
    if (pending) void handle(pending);
    return subscribeNativeLink((l) => void handle(l));
  }, [router, qc, toast, openLegacy]);
}
