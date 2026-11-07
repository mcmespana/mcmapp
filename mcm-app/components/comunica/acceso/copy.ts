// Textos y reglas puras del acceso (plan 02), sin React, para poder probarlos.

import { isComunicaApiError } from '@/services/comunica/client';

/** Un DNI/NIE con pinta de serlo (no se valida la letra: eso es del servidor). */
export const looksLikeDni = (v: string) =>
  /^[0-9XYZ][0-9]{7}[A-Z]$/i.test(v.trim());

export const looksLikeEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** La oficina técnica: a quien se escribe cuando la app no puede resolverlo sola. */
export const OFFICE_EMAIL = 'comunica@movimientoconsolacion.com';

export const ACCESS_TEXT = {
  /** El correo no está en Comunica (se dice, como la web desde el 31/10/2026). */
  noEmailMatch: 'Ese correo no está en Comunica.',
  noEmailMatchHint: 'Revisa que esté bien escrito.',
  noDniMatch: 'No encontramos a nadie con ese documento.',
  noEmailOnFile:
    'Te encontramos, pero no tenemos un correo tuyo: escribe a la oficina técnica.',
  tooManyMisses:
    'Hemos recibido demasiados intentos con correos que no están en Comunica desde esta red. Espera unos minutos o escríbenos.',
  /** La tarjeta del DNI que sigue a un correo que no existe. */
  dniCard: {
    title: '¿Te diste de alta con otro correo?',
    body: 'Búscate con tu DNI o NIE y te mandamos el código al correo de tu ficha.',
    button: 'Buscarme por mi DNI',
  },
  writeUs: 'Escribir a la oficina técnica',
} as const;

/** El mensaje que se enseña ante un fallo del acceso. */
export function accessErrorText(e: unknown): string {
  if (!isComunicaApiError(e)) return 'No se ha podido. Inténtalo de nuevo.';
  switch (e.code) {
    case 'network':
      return 'Sin conexión. Necesitas conexión para entrar la primera vez.';
    case 'rate_limited': {
      if (e.reason === 'too_many_misses') return ACCESS_TEXT.tooManyMisses;
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
      if (e.reason === 'no_email') return ACCESS_TEXT.noEmailOnFile;
      if (e.reason === 'bad_app_token')
        return 'No se ha podido comprobar tu cuenta de la app. Entra con un código.';
      return 'Revisa lo que has escrito.';
    case 'crm_unavailable':
      return 'Comunica no responde ahora mismo. Inténtalo dentro de un rato.';
    default:
      return 'No se ha podido. Inténtalo de nuevo.';
  }
}

/** Qué se ve cuando falla «Recibir código» (`POST /v1/auth/code`), por correo o por DNI. */
export interface CodeProblem {
  /**
   * `email_miss`: ese correo no está en Comunica. Se enseña con el correo tecleado, el campo se queda relleno para corregir la errata y debajo
   * va la tarjeta del DNI. `text`: un aviso y nada más.
   */
  kind: 'email_miss' | 'text';
  text: string;
  /** Con un enlace para escribir a la oficina técnica (lo que la app no resuelve sola). */
  office: boolean;
}

/**
 * El fallo de «Recibir código». OJO: `crm_unavailable` NO es «no existe» (una caída del CRM no puede mandar a todo el mundo al DNI), y el
 * `no_match` del correo es distinto del de la cuenta de la app (`accessErrorText` sin `via`).
 */
export function codeRequestProblem(
  e: unknown,
  via: 'email' | 'dni',
): CodeProblem {
  if (isComunicaApiError(e) && e.code === 'validation') {
    if (e.reason === 'no_match') {
      return via === 'email'
        ? { kind: 'email_miss', text: ACCESS_TEXT.noEmailMatch, office: false }
        : { kind: 'text', text: ACCESS_TEXT.noDniMatch, office: false };
    }
    if (e.reason === 'no_email') {
      return { kind: 'text', text: ACCESS_TEXT.noEmailOnFile, office: true };
    }
  }
  const tooMany =
    isComunicaApiError(e) &&
    e.code === 'rate_limited' &&
    e.reason === 'too_many_misses';
  return { kind: 'text', text: accessErrorText(e), office: tooMany };
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
