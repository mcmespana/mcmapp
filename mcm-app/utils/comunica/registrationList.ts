// utils/comunica/registrationList.ts
//
// «Mis inscripciones» (plan 14, `sticpa_registrations_list_html`): qué va primero y cómo se leen las tarjetas. PURO.
//
//   · Lo abierto (ni pasado ni `danger`) por fecha ascendente; luego lo cerrado, del más reciente al más antiguo. La fecha es el inicio del
//     evento y, si no, la del alta.
//   · «Otros eventos»: las de eventos ocultos, plegado y con su número; abierto si no hay nada más.
//   · Apagada si pasó o es `danger`.

import type { RegistrationCard } from '@/services/comunica/contract';
import { fullDay } from './dates';
import { dateRangeText } from './recordDates';

/** La fecha por la que se ordena y se pinta la cápsula. */
export const cardDay = (c: RegistrationCard): string | null =>
  c.eventStart ?? c.signedOn;

/** ¿Pasó? Por el fin del evento (o su inicio); sin fechas de evento, no. */
export function isClosed(c: RegistrationCard, today: string): boolean {
  if (c.status.tone === 'danger') return true;
  const last = c.eventEnd ?? c.eventStart;
  return !!last && last < today;
}

const byDay = (dir: 1 | -1) => (a: RegistrationCard, b: RegistrationCard) => {
  const x = cardDay(a);
  const y = cardDay(b);
  if (x === y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return (x < y ? -1 : 1) * dir;
};

export interface OrderedRegistrations {
  open: RegistrationCard[];
  closed: RegistrationCard[];
  /** Las de eventos ocultos (con el mismo orden), aparte. */
  others: RegistrationCard[];
  /** «Otros eventos» sale ya abierto si no hay nada más que enseñar. */
  othersOpenByDefault: boolean;
}

export function orderRegistrations(
  items: readonly RegistrationCard[],
  today: string,
): OrderedRegistrations {
  const visible = items.filter((c) => !c.eventHidden);
  const hidden = items.filter((c) => c.eventHidden);
  const open = visible.filter((c) => !isClosed(c, today)).sort(byDay(1));
  const closed = visible.filter((c) => isClosed(c, today)).sort(byDay(-1));
  const others = [
    ...hidden.filter((c) => !isClosed(c, today)).sort(byDay(1)),
    ...hidden.filter((c) => isClosed(c, today)).sort(byDay(-1)),
  ];
  return {
    open,
    closed,
    others,
    othersOpenByDefault: others.length > 0 && open.length + closed.length === 0,
  };
}

/** «del 1 al 3 de diciembre de 2026» o, sin fechas de evento, «Te apuntaste el 14 de marzo de 2026» (de un hijo: «Lucía se apuntó el …»). */
export function whenLine(
  c: RegistrationCard,
  childName: string | null,
): string | null {
  const dates = dateRangeText(c.eventStart, c.eventEnd);
  if (dates) return dates;
  if (!c.signedOn) return null;
  return childName
    ? `${childName} se apuntó el ${fullDay(c.signedOn)}`
    : `Te apuntaste el ${fullDay(c.signedOn)}`;
}

/** «2.º ESO · Clase B». */
export const schoolLine = (
  c: Pick<RegistrationCard, 'schoolLevel' | 'classLabel'>,
): string | null =>
  [c.schoolLevel, c.classLabel].filter(Boolean).join(' · ') || null;
