// utils/comunica/activityList.ts
//
// «Eventos» (plan 13, `sticpa_events_list_html` y `sticpa_events_cards`): qué se ve, en qué orden y con qué chip y acción. PURO.
//
//   · Fuera lo pasado: por la fecha de FIN (si no hay, la de inicio) antes de hoy; un evento que acaba hoy sigue. Sin fechas, se queda.
//   · Por inicio, el más cercano arriba; sin fecha, al final.
//   · Chip, por este orden: «Con plaza» (ok; en rojo con su etiqueta si la inscripción está en un estado de tono `danger`, p. ej. «Rechazada») → el del
//     plazo («Inscripción cerrada» apagado, «Inscripción no abierta» info) → la etiqueta del CRM (neutro). CUANDO HAY FECHAS, MANDAN LAS FECHAS: con
//     fechas y abierta no se pinta la etiqueta del CRM (que podría decir otra cosa).
//   · La tarjeta no repite el plazo cerrado ni el de lo inscrito.
//   · Acción al pie, solo si lleva a otro sitio: «Mi inscripción» (con plaza) o «Inscribirme» (plazo abierto o sin fechas); fuera de plazo, ninguna.

import type { ActivityList, EventCard } from '@/services/comunica/contract';
import {
  cardWindowLine,
  hasWindowDates,
  windowChip,
  windowState,
  type WindowState,
} from './eventWindow';

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'accent' | 'info';

/** ¿Ya pasó? Por el fin (o el inicio) antes de hoy. Sin fechas, no. */
export function isPast(
  e: Pick<EventCard, 'startDate' | 'endDate'>,
  today: string,
): boolean {
  const last = e.endDate ?? e.startDate;
  return !!last && last < today;
}

/** Por inicio, el más cercano arriba; sin fecha, al final (estable). */
export function sortByStart<T extends Pick<EventCard, 'startDate'>>(
  cards: readonly T[],
): T[] {
  return [...cards].sort((a, b) => {
    if (a.startDate === b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate < b.startDate ? -1 : 1;
  });
}

export function visibleActivities(
  list: Pick<ActivityList, 'toSignUp' | 'signedUp'>,
  today: string,
): { toSignUp: EventCard[]; signedUp: EventCard[] } {
  const keep = (cards: EventCard[]) =>
    sortByStart(cards.filter((c) => !isPast(c, today)));
  return { toSignUp: keep(list.toSignUp), signedUp: keep(list.signedUp) };
}

export interface CardChip {
  label: string;
  tone: Tone;
}

export function cardChip(card: EventCard, today: string): CardChip | null {
  if (card.myRegistrationId) {
    const s = card.myRegistrationStatus;
    if (s?.tone === 'danger') return { label: s.label, tone: 'negative' };
    return { label: 'Con plaza', tone: 'positive' };
  }
  const state = windowState(card.window, today);
  const w = windowChip(state);
  if (w) return w;
  // Con fechas y abierta, mandan las fechas: la etiqueta del CRM no se pinta.
  if (hasWindowDates(card.window)) return null;
  return card.statusLabel ? { label: card.statusLabel, tone: 'neutral' } : null;
}

export function cardState(card: EventCard, today: string): WindowState {
  return windowState(card.window, today);
}

/** La línea de plazo de la tarjeta (nunca en lo cerrado ni en lo inscrito). */
export function cardPlazo(card: EventCard, today: string): string | null {
  if (card.myRegistrationId) return null;
  return cardWindowLine(card.window, windowState(card.window, today));
}

export type CardAction =
  | { kind: 'registration'; label: 'Mi inscripción' }
  | { kind: 'signup'; label: 'Inscribirme' };

export function cardAction(card: EventCard, today: string): CardAction | null {
  if (card.myRegistrationId)
    return { kind: 'registration', label: 'Mi inscripción' };
  return windowState(card.window, today) === 'open'
    ? { kind: 'signup', label: 'Inscribirme' }
    : null;
}

/** ¿Hay los dos bloques? Los títulos solo salen entonces. */
export const showSectionTitles = (v: {
  toSignUp: unknown[];
  signedUp: unknown[];
}) => v.toSignUp.length > 0 && v.signedUp.length > 0;
