// Eventos y su ficha (plan 13): las lecturas de un perfil y cómo se abre un archivo.
//
//   · `['activities', pid]` y `['activities', pid, eventId]`: con el `pid` en la clave, cambiar de hijo no mezcla datos. Se guardan en el móvil
//     (el estado de su inscripción y poco más); familias funcionan CON conexión, la caché solo abre rápido.
//   · Nada se escribe aquí (inscribirse es del plan 14): ni cola ni cambios.
//   · Las imágenes `{ documentId }` se piden con la sesión puesta (`eventFileSource`); las `{ url }` van tal cual, sin sesión.

import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { getComunicaApi } from '@/services/comunica';
import type { BodyHref, ImageRef } from '@/services/comunica/contract';
import { openEventFile } from '@/services/comunica/eventFiles';
import { classifyComunicaLink, nativeHrefFor } from '@/services/comunica/links';
import { classifyBodyHref, type BodyLink } from '@/utils/comunica/bodyLinks';
import { useOpenLegacy } from './useOpenLegacy';
import { useToast } from '@/contexts/AppToastContext';
import { STALE, useAreaQuery } from './useAreaQuery';

const FRESH = 2 * 60_000;

export const activitiesKey = (pid: string) => ['activities', pid] as const;

export function useActivities(pid: string | null | undefined) {
  return useAreaQuery({
    key: [...activitiesKey(pid ?? '')],
    route: 'profileActivities',
    fetch: () => getComunicaApi().getProfileActivities(pid!),
    staleTime: FRESH,
    enabled: !!pid,
  });
}

export function useEventDetail(
  pid: string | null | undefined,
  eventId: string,
) {
  return useAreaQuery({
    key: [...activitiesKey(pid ?? ''), eventId],
    route: 'profileEvent',
    fetch: () => getComunicaApi().getProfileEvent(pid!, eventId),
    staleTime: FRESH,
    enabled: !!pid && !!eventId,
    // Una ficha que no existe no se arregla insistiendo.
    retry: false,
  });
}

/** El evento por el slug (o id) de la página pública, para el enlace `/actividades/?e=`. */
export function useEventBySlug(pid: string | null | undefined, slug: string) {
  return useAreaQuery({
    key: [...activitiesKey(pid ?? ''), 'slug', slug],
    route: 'profileEventBySlug',
    fetch: () => getComunicaApi().getProfileEventBySlug(pid!, slug),
    staleTime: STALE.state,
    enabled: !!pid && !!slug,
    retry: false,
  });
}

/** Lo que entiende `expo-image` para una imagen del evento (con sesión si es un documento nuestro). */
export function eventImageSource(
  pid: string,
  eventId: string,
  ref: ImageRef,
): { uri: string; headers?: Record<string, string>; cacheKey?: string } {
  if ('url' in ref) return { uri: ref.url, cacheKey: ref.url };
  return getComunicaApi().eventFileSource(pid, eventId, ref.documentId);
}

/** Abrir un archivo del evento (un PDF, un documento enlazado): se baja con sesión y se enseña en la hoja de compartir. */
export function useOpenEventFile(
  pid: string | null | undefined,
  eventId: string,
) {
  const { toast } = useToast();
  return useCallback(
    async (documentId: string, title?: string) => {
      if (!pid) return;
      const src = getComunicaApi().eventFileSource(pid, eventId, documentId);
      const result = await openEventFile(src, title ?? 'Documento');
      if (result === 'offline')
        toast.show({
          variant: 'warning',
          label: 'Necesitas conexión para abrir el documento',
        });
      else if (result === 'failed')
        toast.show({
          variant: 'danger',
          label: 'No se ha podido abrir el documento',
        });
    },
    [pid, eventId, toast],
  );
}

/** Para `router` en pantallas de eventos que vuelven al listado. */
export function useGoToActivities() {
  const router = useRouter();
  return useCallback(
    () => router.replace('/comunica/actividades' as never),
    [router],
  );
}

/**
 * Abrir un enlace del cuerpo (`bodyLinks.ts`): un documento como un adjunto; `tel:` y `mailto:` con `Linking`; nuestro dominio por el mapa del plan 10
 * (la pantalla nativa si la hay; si no, el legado con la sesión); lo demás, el navegador del sistema. Lo que no se sabe abrir no hace nada.
 */
export function useOpenBodyLink(
  pid: string | null | undefined,
  eventId: string,
) {
  const router = useRouter();
  const openLegacy = useOpenLegacy();
  const openFile = useOpenEventFile(pid, eventId);
  return useCallback(
    async (href: BodyHref, title?: string) => {
      const link: BodyLink = classifyBodyHref(href);
      try {
        if (link.kind === 'document')
          return await openFile(link.documentId, title);
        if (link.kind === 'tel' || link.kind === 'mailto')
          return await Linking.openURL(link.url);
        if (link.kind === 'external')
          return void (await WebBrowser.openBrowserAsync(link.url));
        if (link.kind === 'own') {
          const c = classifyComunicaLink(link.url);
          if (c?.kind === 'event')
            return router.push({
              pathname: '/comunica/actividades/publica/[slug]',
              params: { slug: c.slug },
            } as never);
          if (c?.kind === 'page' && c.destination) {
            const native = nativeHrefFor(c.destination);
            if (native) return router.push(native as never);
            return await openLegacy(c.destination, title ?? 'Comunica');
          }
          return router.push({
            pathname: '/comunica/web',
            params: { url: link.url },
          } as never);
        }
      } catch {
        /* sin app que lo abra: no pasa nada */
      }
    },
    [router, openLegacy, openFile],
  );
}
