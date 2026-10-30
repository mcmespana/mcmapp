// Un hueco para el enlace de Comunica que acaba de abrir la app (plan 10 §3),
// para el área NATIVA. `+native-intent.ts` lo deja aquí antes de que exista la
// pantalla; la puerta lo recoge al montar (o al llegar, si ya estaba montada).
// Caduca a los 2 minutos: un enlace que nadie recogió no se aplica horas
// después por sorpresa.
//
// El legado tiene el suyo (`utils/pendingComunicaLink.ts`): cada modo recoge
// el que le toca y el otro se queda sin usar.

import type { ComunicaLink } from './links';

const TTL_MS = 2 * 60_000;

let pending: { link: ComunicaLink; at: number } | null = null;
let listener: ((link: ComunicaLink) => void) | null = null;

export function setPendingNativeLink(link: ComunicaLink): void {
  if (listener) {
    listener(link);
    return;
  }
  pending = { link, at: Date.now() };
}

export function consumePendingNativeLink(): ComunicaLink | null {
  const p = pending;
  pending = null;
  if (!p || Date.now() - p.at > TTL_MS) return null;
  return p.link;
}

export function subscribeNativeLink(
  fn: (link: ComunicaLink) => void,
): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
