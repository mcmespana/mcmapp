// utils/notificationAudience.ts
//
// Filtrado del historial in-app de notificaciones por audiencia.
//
// El MCM Panel segmenta cada envío con hasta cuatro EJES independientes y guarda
// ese filtro en el propio registro de `/notifications/<id>.audience`. Como la app
// pinta TODO el nodo `/notifications` en el centro de notificaciones, sin este
// filtro una notificación "solo monitores de Madrid" la vería cualquiera que
// abriese la campana. Aquí replicamos la MISMA semántica que usa el panel para
// decidir a qué tokens enviar (`mcmpanel/src/lib/audience.ts →
// tokenMatchesAudience` y su espejo en `api/_lib/push.ts`), pero evaluada contra
// el usuario actual del dispositivo en vez de contra un token de `/pushTokens`.
//
// Ejes (todos opcionales):
//   - todos        → el usuario tiene el topic "general"
//   - perfiles[]   → profileType del usuario ∈ perfiles  (OR dentro del eje)
//   - delegaciones[] → delegationId del usuario ∈ delegaciones  (OR dentro del eje)
//   - eventId      → el usuario tiene el topic "event-<eventId>" (suscripción)
//
// Entre ejes distintos se combina según `match`: 'all' (AND, por defecto) o
// 'any' (OR). Un eje sin selección NO cuenta. Sin ningún eje activo → visible
// para todos (retrocompatible con el histórico sin `audience`).

import type { ProfileType } from '@/types/profileConfig';

export type AudienceMatch = 'all' | 'any';

export interface NotificationAudience {
  /** Cómo combinar los ejes activos entre sí. 'all' = AND, 'any' = OR. */
  match: AudienceMatch;
  /** Eje "todos": usuarios con el topic "general". */
  todos: boolean;
  /** Eje perfil: profileType del usuario ∈ esta lista. */
  perfiles: ProfileType[];
  /** Eje delegación: delegationId del usuario ∈ esta lista. */
  delegaciones: string[];
  /** Eje evento: usuario suscrito al topic "event-<eventId>". null = inactivo. */
  eventId: string | null;
}

/**
 * Identidad del usuario actual necesaria para el match. Coincide en forma con la
 * metadata que se guarda en `/pushTokens` (`TokenProfileMetadata`), de modo que
 * un registro visible en la campana es exactamente un registro que este mismo
 * dispositivo habría recibido como push.
 */
export interface NotificationAudienceUser {
  profileType: ProfileType | null;
  delegationId: string | null;
  /** Unión de notificationTopics del perfil/delegación + topics `event-<id>`. */
  topics: string[];
}

/** Topic que identifica la suscripción opt-in a un evento concreto. */
export function eventTopic(eventId: string): string {
  return `event-${eventId}`;
}

/** ¿Hay al menos un eje activo? Si no, el registro es visible para todos. */
function audienceHasAxis(a: NotificationAudience): boolean {
  return (
    a.todos || a.perfiles.length > 0 || a.delegaciones.length > 0 || !!a.eventId
  );
}

/**
 * Sanea una audiencia que llega de Firebase (puede venir malformada o parcial).
 * Devuelve null cuando no hay ningún eje activo (= "para todos", sin filtro).
 */
export function normalizeAudience(
  input?: Partial<NotificationAudience> | null,
): NotificationAudience | null {
  if (!input || typeof input !== 'object') return null;
  const audience: NotificationAudience = {
    match: input.match === 'any' ? 'any' : 'all',
    todos: !!input.todos,
    perfiles: Array.isArray(input.perfiles)
      ? (input.perfiles.filter(Boolean) as ProfileType[])
      : [],
    delegaciones: Array.isArray(input.delegaciones)
      ? input.delegaciones.filter(Boolean)
      : [],
    eventId:
      typeof input.eventId === 'string' && input.eventId.trim()
        ? input.eventId.trim()
        : null,
  };
  return audienceHasAxis(audience) ? audience : null;
}

/**
 * ¿Debe ver el usuario actual una notificación con esta audiencia?
 *
 * Acepta la audiencia tal cual sale de Firebase (objeto, parcial, null o
 * undefined). Un registro sin `audience` o sin ejes activos → visible para
 * todos, preservando el histórico anterior a la segmentación.
 */
export function notificationMatchesUser(
  rawAudience: Partial<NotificationAudience> | null | undefined,
  user: NotificationAudienceUser,
): boolean {
  const a = normalizeAudience(rawAudience);
  if (!a) return true; // sin filtro → a todos

  const topics = Array.isArray(user.topics) ? user.topics : [];

  const axes: boolean[] = [];
  if (a.todos) axes.push(topics.includes('general'));
  if (a.perfiles.length > 0) {
    axes.push(!!user.profileType && a.perfiles.includes(user.profileType));
  }
  if (a.delegaciones.length > 0) {
    axes.push(
      !!user.delegationId && a.delegaciones.includes(user.delegationId),
    );
  }
  if (a.eventId) axes.push(topics.includes(eventTopic(a.eventId)));

  if (axes.length === 0) return true; // no debería pasar (normalizeAudience)
  return a.match === 'any' ? axes.some(Boolean) : axes.every(Boolean);
}
