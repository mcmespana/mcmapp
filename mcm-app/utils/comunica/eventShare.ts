// utils/comunica/eventShare.ts
//
// «Compartir un evento con el texto ya escrito» (plan 08, F5 del plugin).
// Puro, sin React. Si algún día se hace el puente `sticpa:share` de la WebView,
// que reutilice `buildEventShareMessage()`.
//
//   Convivencia COM · sáb 15 y dom 16 de noviembre · Benicàssim · Apúntate hasta el 5 de noviembre: <url>
//
//   · Fechas en lenguaje humano: un día, «sáb 8 de noviembre»; dos seguidos,
//     «sáb 15 y dom 16 de noviembre»; más, «del vie 31 de octubre al dom 2 de
//     noviembre». El año solo si no es el actual. Nunca «01/07/2026».
//   · El lugar, si lo hay.
//   · El plazo, solo si la inscripción está abierta y tiene fecha de fin. El
//     día de fin cuenta ENTERO (`EVENTOS.md` §5.2): «hasta el 5», no el «antes
//     del 5/11» de F5, que le quitaría un día a la gente. Sin fechas, abierta.
//   · El enlace: el que dé el servidor (`share`, plan 08 «Datos»: la página
//     pública si el evento la tiene; si no, la ficha del área). Si el evento no
//     lo trae, se calcula como el plugin (`inc/stic-event-web.php`): la
//     pública `…/actividades/?e=<slug o id>` solo si está publicado, y si no
//     la ficha del área, cuyo destino sobrevive al login (`ACCESO.md` §4.b).
//
// El tipo del evento es propio: el contrato de eventos (plan 07) aún no está.
// Cuando esté, su `EventSummary` encaja aquí tal cual (`id`, `name`,
// `startDate`, `endDate`) más lo que añade el plan 08 (`share`, `place`,
// `registrationClosesOn`).

import {
  COMUNICA_ORIGIN,
  DESTINATION_SHAPES,
  destinationQuery,
} from '@/services/comunica/links';
import { longDay, shortDay } from './dates';
import { daysBetween } from './madrid';

export interface EventShareLink {
  url: string;
  kind: 'public' | 'area';
}

/** Lo mínimo de un evento para compartirlo. Días `YYYY-MM-DD` de Madrid. */
export interface ShareableEvent {
  id: string;
  name: string;
  startDate: string;
  /** Sin él (o anterior al inicio), es de un día. */
  endDate?: string | null;
  place?: string | null;
  /** Inscripción: se abre ese día. Sin fecha, ya está abierta. */
  registrationOpensOn?: string | null;
  /** Inscripción: el último día (cuenta entero). Sin fecha, no hay plazo. */
  registrationClosesOn?: string | null;
  /**
   * El enlace que calcula el servidor. `null` = no se comparte (sin botón).
   * Sin el campo, se calcula aquí con `published` y `slug`.
   */
  share?: EventShareLink | null;
  /** `web_publicar_c`: tiene página pública. */
  published?: boolean;
  /** `web_slug_c`; sin él, el id. */
  slug?: string | null;
}

const year = (day: string) => day.slice(0, 4);
const monthName = (day: string) => longDay(day).replace(/^.* de /, '');
const withYear = (day: string, currentYear: string) =>
  year(day) === currentYear ? '' : ` de ${year(day)}`;

/** «sáb 8 de noviembre» (con el año si no es el actual). */
function dayText(day: string, currentYear: string): string {
  return `${shortDay(day)} de ${monthName(day)}${withYear(day, currentYear)}`;
}

/** Las fechas del evento en lenguaje humano. */
export function eventDatesText(
  startDate: string,
  endDate: string | null | undefined,
  today: string,
): string {
  const now = year(today);
  const end = endDate && endDate > startDate ? endDate : null;
  if (!end) return dayText(startDate, now);
  const sameMonth = startDate.slice(0, 7) === end.slice(0, 7);
  if (daysBetween(startDate, end) === 1) {
    return sameMonth
      ? `${shortDay(startDate)} y ${dayText(end, now)}`
      : `${dayText(startDate, now)} y ${dayText(end, now)}`;
  }
  return sameMonth
    ? `del ${shortDay(startDate)} al ${dayText(end, now)}`
    : `del ${dayText(startDate, now)} al ${dayText(end, now)}`;
}

/**
 * «Apúntate hasta el 5 de noviembre», o `null` si no toca: sin fecha de fin,
 * aún no abierta o ya cerrada (el día de fin cuenta entero).
 */
export function registrationText(
  e: Pick<ShareableEvent, 'registrationOpensOn' | 'registrationClosesOn'>,
  today: string,
): string | null {
  const closes = e.registrationClosesOn;
  if (!closes || closes < today) return null;
  if (e.registrationOpensOn && e.registrationOpensOn > today) return null;
  const [, , d] = closes.split('-').map(Number);
  return `Apúntate hasta el ${d} de ${monthName(closes)}${withYear(closes, year(today))}`;
}

/** El enlace que se comparte, o `null` si el evento no se comparte. */
export function eventShareLink(e: ShareableEvent): EventShareLink | null {
  if (e.share !== undefined) return e.share;
  if (e.published) {
    const key = e.slug?.trim() || e.id;
    return {
      url: `${COMUNICA_ORIGIN}/actividades/?e=${encodeURIComponent(key)}`,
      kind: 'public',
    };
  }
  // La ficha en el área: solo con un id con la forma que admite el plugin.
  if (!DESTINATION_SHAPES.id.test(e.id)) return null;
  return {
    url: `${COMUNICA_ORIGIN}/ap/?${destinationQuery({
      internalpage: 'single_stic_events',
      action: 'detail',
      id: e.id,
    })}`,
    kind: 'area',
  };
}

/**
 * El mensaje entero, con el enlace dentro (igual en iOS y en Android), o
 * `null` si el evento no se comparte (y entonces no hay botón).
 */
export function buildEventShareMessage(
  e: ShareableEvent,
  today: string,
): string | null {
  const link = eventShareLink(e);
  if (!link) return null;
  const parts = [
    e.name.trim(),
    eventDatesText(e.startDate, e.endDate, today),
    e.place?.trim() || null,
    registrationText(e, today),
  ].filter(Boolean);
  return `${parts.join(' · ')}: ${link.url}`;
}
