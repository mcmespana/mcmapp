// Textos y reglas puras del acceso (plan 02), sin React, para poder probarlos.

import { isComunicaApiError } from '@/services/comunica/client';

/** Un DNI/NIE con pinta de serlo (no se valida la letra: eso es del servidor). */
export const looksLikeDni = (v: string) =>
  /^[0-9XYZ][0-9]{7}[A-Z]$/i.test(v.trim());

export const looksLikeEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** El mensaje que se enseña ante un fallo del acceso. */
export function accessErrorText(e: unknown): string {
  if (!isComunicaApiError(e)) return 'No se ha podido. Inténtalo de nuevo.';
  switch (e.code) {
    case 'network':
      return 'Sin conexión. Necesitas conexión para entrar la primera vez.';
    case 'rate_limited': {
      if (e.reason === 'blocked') {
        return 'Demasiados códigos fallidos. Espera una hora o entra con otra vía.';
      }
      const min = Math.max(1, Math.ceil((e.retryAfter ?? 600) / 60));
      return `Demasiados intentos. Espera ${min} ${min === 1 ? 'minuto' : 'minutos'}.`;
    }
    case 'validation':
      if (e.reason === 'code_expired')
        return 'El código ha caducado. Pide otro.';
      if (e.reason === 'link_expired')
        return 'El enlace ha caducado. Pide un código.';
      if (e.reason === 'bad_code') return 'Ese código no es. Revísalo.';
      return 'Revisa lo que has escrito.';
    default:
      return 'No se ha podido. Inténtalo de nuevo.';
  }
}

/** Segundos que hay que esperar para volver a mandar el código. */
export const RESEND_AFTER_S = 60;
