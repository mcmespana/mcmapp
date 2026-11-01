// Qué hace cada cosa que se toca en la ficha de un evento (plan 13): el mapa,
// las imágenes (visor), los adjuntos (el abridor con sesión), la página
// pública, los vídeos y los enlaces del cuerpo (`bodyLinks.ts`).
//
//   · `tel:` / `mailto:` y vídeos → `Linking` (el teléfono, el correo, la app
//     de YouTube si la hay)
//   · documento del evento → como un adjunto (PDF) o el visor (imagen)
//   · nuestro dominio → el mapa de enlaces del plan 10 (nativo o legado)
//   · lo demás → el navegador del sistema dentro de la app

import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEventFileSource } from '@/hooks/comunica/useActivities';
import { useOpenDestination } from '@/hooks/comunica/useOpenDestination';
import { useOpenFile } from '@/hooks/comunica/useOpenFile';
import type {
  BodyHref,
  EventDetail,
  ImageRef,
} from '@/services/comunica/contract';
import { classifyBodyLink, mapLink } from '@/utils/comunica/bodyLinks';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import type { EventDetailHandlers } from './EventDetailView';
import { resolveImage } from './EventMedia';

const openUrl = (url: string) =>
  Linking.openURL(url).catch(() =>
    logger.warn('[comunica] no se ha podido abrir un enlace del evento'),
  );

export const openInBrowser = (url: string) =>
  WebBrowser.openBrowserAsync(url).catch(() => openUrl(url));

export function useEventHandlers(event: EventDetail | undefined) {
  const router = useRouter();
  const openDestination = useOpenDestination();
  const fileSource = useEventFileSource(event?.id ?? '-');
  const { open, opening } = useOpenFile();
  const [viewer, setViewer] = useState<{ image: ImageRef; alt: string } | null>(
    null,
  );
  const resolve = useMemo(() => resolveImage(fileSource), [fileSource]);

  const onAttachment = useCallback(
    (documentId: string, title: string) =>
      void open({
        key: documentId,
        source: fileSource(documentId),
        fileName: `${title}.pdf`,
        mimeType: 'application/pdf',
      }),
    [open, fileSource],
  );

  const onLink = useCallback(
    (href: BodyHref) => {
      const link = classifyBodyLink(href);
      switch (link.kind) {
        case 'tel':
        case 'mailto':
          void openUrl(link.url);
          return;
        case 'document': {
          const pdf = event?.attachments.find(
            (a) => a.documentId === link.documentId,
          );
          if (pdf) onAttachment(pdf.documentId, pdf.title);
          else
            setViewer({
              image: { documentId: link.documentId },
              alt: 'Imagen de la actividad',
            });
          return;
        }
        case 'comunica': {
          const l = link.link;
          if (l.kind === 'event') {
            router.push({
              pathname: '/comunica/actividades/publica/[slug]',
              params: { slug: l.slug },
            });
          } else if (l.kind === 'page' && l.destination) {
            openDestination(l.destination, 'Comunica');
          } else if (l.kind === 'other') {
            router.push({ pathname: '/comunica/web', params: { url: l.url } });
          }
          return;
        }
        case 'external':
          void openInBrowser(link.url);
          return;
        case 'none':
          return;
      }
    },
    [event, onAttachment, openDestination, router],
  );

  const handlers: EventDetailHandlers = {
    resolve,
    onImage: (image, alt) => setViewer({ image, alt }),
    onLink,
    onVideo: (url) => void openUrl(url),
    onMap: () => {
      if (!event?.map) return;
      h.tap();
      // Mapas en iOS, la app que elija el móvil en Android (`geo:`) y Google
      // Maps en web: que se sienta del sistema.
      void openUrl(mapLink(event.map, Platform.OS));
    },
    onAttachment,
    onPublicPage: (url) => void openInBrowser(url),
    opening,
  };
  return { handlers, viewer, closeViewer: () => setViewer(null) };
}
