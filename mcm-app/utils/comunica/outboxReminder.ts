// utils/comunica/outboxReminder.ts
//
// «Tienes N listas sin subir» (plan 08): el único aviso que manda la propia
// app, porque solo el móvil sabe qué hay en su cola. Puro, sin React.
//
//   · Cuenta las entradas de la cola que son LISTAS (de grupo, de evento y de
//     monitores: planes 04, 07 y 06) y aún no han subido. Lo demás de la cola
//     (avisos, pañuelos, el alta del móvil…) no cuenta.
//   · Al pasar la app a segundo plano con alguna, se programa UNO a los 60
//     min; si cae entre las 22:00 y las 8:30 de Madrid, a las 8:30.
//   · Con alguna atascada, el texto cambia: hay que abrirla, no basta la red.

import type { ComunicaPushData } from '@/services/comunica/contract';
import type { OutboxEntry } from '@/services/comunica/outbox';
import { addDays, madridDate, madridDay, madridTime } from './madrid';

/** Los `kind` de la cola que son una lista (planes 04, 07 y 06). */
export const LIST_KINDS: readonly string[] = [
  'roll',
  'event-roll',
  'monitors-roll',
];

/** A los cuántos minutos de irse la app llega el recordatorio. */
export const REMINDER_DELAY_MIN = 60;
/** Ni de noche: de 22:00 a 8:30, se espera a las 8:30. */
const QUIET_FROM = '22:00';
const QUIET_UNTIL = '08:30';

export interface UnsentLists {
  count: number;
  stuck: number;
}

/**
 * Las listas sin subir. «Subiendo» también cuenta: si el sistema duerme la app
 * a mitad, al volver estará pendiente.
 */
export function unsentLists(entries: readonly OutboxEntry[]): UnsentLists {
  const lists = entries.filter(
    (e) => LIST_KINDS.includes(e.kind) && e.status !== 'applied',
  );
  return {
    count: lists.length,
    stuck: lists.filter((e) => e.status === 'stuck').length,
  };
}

/** Cuándo suena: a la hora, salvo de noche (Madrid), que espera a las 8:30. */
export function reminderTime(now: Date): Date {
  const at = new Date(now.getTime() + REMINDER_DELAY_MIN * 60_000);
  const day = madridDay(at);
  const time = madridTime(at.toISOString());
  if (time >= QUIET_FROM) return madridDate(addDays(day, 1), QUIET_UNTIL);
  if (time < QUIET_UNTIL) return madridDate(day, QUIET_UNTIL);
  return at;
}

export interface OutboxReminder {
  at: Date;
  title: string;
  body: string;
  data: ComunicaPushData;
}

/** El recordatorio que toca, o `null` si no hay listas sin subir. */
export function outboxReminder(
  entries: readonly OutboxEntry[],
  now: Date,
  newId: () => string,
): OutboxReminder | null {
  const { count, stuck } = unsentLists(entries);
  if (count === 0) return null;
  const text =
    stuck > 0
      ? {
          title:
            stuck === 1
              ? 'Una lista no se ha podido subir'
              : `${stuck} listas no se han podido subir`,
          body: 'Ábrela para ver qué ha pasado.',
        }
      : {
          title:
            count === 1
              ? 'Tienes 1 lista sin subir'
              : `Tienes ${count} listas sin subir`,
          body: 'Abre la app con cobertura y se suben solas.',
        };
  return {
    at: reminderTime(now),
    ...text,
    data: {
      source: 'comunica',
      v: 1,
      id: `comunica:${newId()}`,
      type: 'outbox_pending',
    },
  };
}
