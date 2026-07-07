// utils/notificationEventRoute.ts
//
// Deep link de una notificación a un evento concreto (Jubileo, Visita del Papa,
// `activities/<nombre>`…). El MCM Panel puede enviar `data.eventId` con el id del
// evento en el registry de la app (`constants/events.ts`). Al tocar la
// notificación, la app resuelve ese id a la ruta del evento y navega allí, en
// vez de limitarse a abrir el centro de notificaciones.
//
// Es retrocompatible y de impacto cero mientras el panel no mande `eventId`: sin
// ese campo, todo se comporta como antes.

import { EVENTS, type EventConfig } from '@/constants/events';

/**
 * Resuelve el id de un evento a la ruta de su hub en la app, o `null` si el id
 * no está en el registry (en cuyo caso el llamante cae a su comportamiento por
 * defecto). El mapa de eventos es inyectable para poder testear sin depender del
 * registry real (que arrastra `require()` de imágenes).
 *
 * - Evento con `tabId` (tiene tab propia, p. ej. `visitapapa`) → `/(tabs)/<tabId>`.
 * - Evento sin `tabId` (p. ej. Jubileo, archivado) → `/(tabs)/mas`, donde vive
 *   el acceso a los eventos pasados. Es el mejor destino estable disponible.
 * - Id desconocido o vacío → `null`.
 *
 * Nota: la ruta de un evento con tab propia está gateada por perfil; si el
 * usuario no tiene acceso, la navegación puede no llevar a ningún sitio. En la
 * práctica el panel deep-linkea un evento a sus suscriptores (que sí tienen
 * acceso) y el llamante envuelve la navegación en try/catch.
 */
export function routeForEventId(
  eventId?: string | null,
  events: Record<string, EventConfig> = EVENTS,
): string | null {
  if (!eventId || typeof eventId !== 'string') return null;
  const event = events[eventId.trim()];
  if (!event) return null;
  return event.tabId ? `/(tabs)/${event.tabId}` : '/(tabs)/mas';
}
