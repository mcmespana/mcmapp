// utils/comunica/bodyLinks.ts
//
// A dónde lleva un enlace del cuerpo de un evento (plan 13): PURO. Solo se pinta como enlace lo que se sabe abrir.
//
//   · `{ documentId }`        → como un adjunto (se baja con sesión).
//   · `tel:` y `mailto:`      → `Linking`.
//   · nuestro dominio         → el mapa de enlaces del plan 10 (también escrito con `http://`).
//   · otro `http(s)`          → el navegador del sistema.
//   · lo demás (`javascript:`, `data:`, `intent:`…) → nada: no se pinta como enlace.

import type { BodyHref } from '@/services/comunica/contract';
import { COMUNICA_HOST, COMUNICA_ORIGIN } from '@/services/comunica/links';

export type BodyLink =
  | { kind: 'document'; documentId: string }
  | { kind: 'tel' | 'mailto'; url: string }
  | { kind: 'own'; url: string }
  | { kind: 'external'; url: string }
  | { kind: 'none' };

export function classifyBodyHref(href: BodyHref): BodyLink {
  if ('documentId' in href)
    return { kind: 'document', documentId: href.documentId };
  const url = href.url.trim();
  if (/^tel:[+\d][\d\s().-]*$/i.test(url)) return { kind: 'tel', url };
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url.split('?')[0]))
    return { kind: 'mailto', url };
  if (!/^https?:\/\//i.test(url)) return { kind: 'none' };
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { kind: 'none' };
  }
  if (host === COMUNICA_HOST)
    return { kind: 'own', url: url.replace(/^http:\/\//i, 'https://') };
  return { kind: 'external', url };
}

/** El enlace de nuestro dominio, en el origen de siempre (por si venía con `http://`). */
export const isOwnOrigin = (url: string) =>
  url.startsWith(`${COMUNICA_ORIGIN}/`);

/** Miniatura de YouTube (sin WebView dentro del scroll). Vimeo no tiene: tarjeta. */
export const youtubeThumb = (id: string) =>
  `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
