// utils/comunica/bodyLinks.ts
//
// Qué hace un enlace del cuerpo de un evento (plan 13), puro:
//
//   · `tel:` y `mailto:`          → `Linking` (el teléfono o el correo del móvil)
//   · `{ documentId }`            → como un adjunto del evento (con sesión)
//   · nuestro dominio (también
//     escrito con `http://`)      → el mapa de enlaces del plan 10
//   · cualquier otro `http(s)`    → el navegador del sistema
//   · lo demás (`javascript:`…)   → NO es un enlace: se pinta como texto
//
// El servidor ya sanea las URLs (`mcm_cuerpo_url`); esto es la segunda puerta:
// la app nunca abre lo que no sabe qué es.

import type { BodyHref } from '@/services/comunica/contract';
import {
  classifyComunicaLink,
  type ComunicaLink,
} from '@/services/comunica/links';

export type BodyLink =
  | { kind: 'tel'; url: string }
  | { kind: 'mailto'; url: string }
  | { kind: 'document'; documentId: string }
  | { kind: 'comunica'; link: ComunicaLink }
  | { kind: 'external'; url: string }
  | { kind: 'none' };

export function classifyBodyLink(href: BodyHref): BodyLink {
  if ('documentId' in href) {
    return { kind: 'document', documentId: href.documentId };
  }
  const url = href.url.trim();
  if (/^tel:[+0-9 ()-]{3,}$/i.test(url)) return { kind: 'tel', url };
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return { kind: 'mailto', url };
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return { kind: 'none' };
  const link = classifyComunicaLink(url);
  if (link) return { kind: 'comunica', link };
  return { kind: 'external', url };
}

/** ¿Se pinta como enlace? */
export const isLinkable = (href: BodyHref): boolean =>
  classifyBodyLink(href).kind !== 'none';

/**
 * El enlace del mapa de un evento: el propio si lo tiene; si no, una búsqueda
 * con la app de mapas del sistema (Mapas en iOS, la que elija el móvil en
 * Android con `geo:`) y Google Maps en web.
 */
export function mapLink(
  map: { url: string } | { query: string },
  platform: string,
): string {
  if ('url' in map) return map.url;
  const q = encodeURIComponent(map.query);
  if (platform === 'ios') return `https://maps.apple.com/?q=${q}`;
  if (platform === 'android') return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** La miniatura de un vídeo de YouTube (Vimeo no la da sin pedirla). */
export const youtubeThumbnail = (id: string): string =>
  `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
