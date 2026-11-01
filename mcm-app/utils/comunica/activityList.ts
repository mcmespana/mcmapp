// utils/comunica/activityList.ts
//
// El listado «Eventos» de familias (plan 13), puro, como
// `sticpa_events_list_html` (`inc/stic-events.php` 801-855):
//
//   · fuera lo ya celebrado (lo quita la app con la fecha de hoy: lo guardado
//     sigue bien al día siguiente sin cobertura);
//   · por fecha de inicio, el más cercano arriba; sin fecha, al final;
//   · «Para apuntarte» primero, «Te has apuntado» después; los títulos solo si
//     hay los dos bloques.

import type { ActivityList, EventCard } from '@/services/comunica/contract';
import { isPastEvent } from './eventWindow';

export const byStartDate = (a: EventCard, b: EventCard): number =>
  (a.startDate ?? '9999-99-99').localeCompare(b.startDate ?? '9999-99-99');

export interface ActivityBlocks {
  toSignUp: EventCard[];
  signedUp: EventCard[];
  /** Hay los dos: se pintan sus títulos. */
  titled: boolean;
  empty: boolean;
}

export function activityBlocks(
  list: Pick<ActivityList, 'toSignUp' | 'signedUp'>,
  today: string,
): ActivityBlocks {
  const keep = (xs: EventCard[]) =>
    xs.filter((e) => !isPastEvent(e, today)).sort(byStartDate);
  const toSignUp = keep(list.toSignUp);
  const signedUp = keep(list.signedUp);
  return {
    toSignUp,
    signedUp,
    titled: toSignUp.length > 0 && signedUp.length > 0,
    empty: toSignUp.length === 0 && signedUp.length === 0,
  };
}
