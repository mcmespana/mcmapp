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
      if (e.reason === 'no_match')
        return 'El correo de tu cuenta de la app no está en Comunica. Entra con el correo que tiene tu delegación o con el DNI.';
      if (e.reason === 'bad_app_token')
        return 'No se ha podido comprobar tu cuenta de la app. Entra con un código.';
      return 'Revisa lo que has escrito.';
    case 'crm_unavailable':
      return 'Comunica no responde ahora mismo. Inténtalo dentro de un rato.';
    default:
      return 'No se ha podido. Inténtalo de nuevo.';
  }
}

/**
 * El código técnico del fallo («crm_unavailable · app_not_configured»), en
 * pequeño debajo del mensaje: sin él, quien prueba no sabe qué ha pasado. No
 * lleva datos de nadie.
 */
export function accessErrorDetail(e: unknown): string | null {
  if (!isComunicaApiError(e)) {
    return e instanceof Error ? e.name : null;
  }
  return [e.code, e.reason, e.status ? String(e.status) : null]
    .filter(Boolean)
    .join(' · ');
}

/** Segundos que hay que esperar para volver a mandar el código. */
export const RESEND_AFTER_S = 60;
