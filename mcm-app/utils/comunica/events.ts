// utils/comunica/events.ts
//
// Elegir evento (plan 07; `sticpa_pl_ev_clasificar`, `_fechas`, `_hoy_texto`
// del plugin), sin React. La app clasifica con la fecha de hoy, no el
// servidor: lo guardado en el móvil sigue bien clasificado al día siguiente
// sin cobertura.

import type { EventSummary } from '@/services/comunica/contract';

/** El curso que contiene `day`: del 1 de septiembre al 31 de agosto. */
export function courseOf(day: string) {
  const [y, m] = day.split('-').map(Number);
  const start = m >= 9 ? y : y - 1;
  return {
    start: `${start}-09-01`,
    end: `${start + 1}-08-31`,
    label: `${start}-${start + 1}`,
  };
}

/** Qué es hoy para el evento: empieza, acaba o está en marcha. */
export type TodayKind = 'start' | 'end' | 'during';

export interface ClassifiedEvent {
  event: EventSummary;
  when: 'today' | 'upcoming' | 'past';
  today: TodayKind | null;
}

export interface EventBuckets {
  today: ClassifiedEvent[];
  upcoming: ClassifiedEvent[];
  past: ClassifiedEvent[];
  /** Todos los del curso (para «N este curso» y el buscador). */
  count: number;
}

const TODAY_ORDER: Record<TodayKind, number> = { start: 0, end: 1, during: 2 };

/**
 * Hoy (empieza, acaba o en marcha, en ese orden), próximos (el más cercano
 * arriba) y pasados del curso (el más reciente arriba). Lo de otro curso no
 * sale: el 1 de septiembre la lista guardada se vacía sola.
 */
export function classifyEvents(
  events: readonly EventSummary[],
  today: string,
): EventBuckets {
  const course = courseOf(today);
  const out: EventBuckets = { today: [], upcoming: [], past: [], count: 0 };
  for (const event of events) {
    if (event.endDate < course.start || event.startDate > course.end) continue;
    const kind: TodayKind | null =
      event.startDate === today
        ? 'start'
        : event.endDate === today
          ? 'end'
          : event.startDate < today && event.endDate > today
            ? 'during'
            : null;
    const when = kind ? 'today' : event.startDate > today ? 'upcoming' : 'past';
    out[when].push({ event, when, today: kind });
    out.count += 1;
  }
  const byName = (a: ClassifiedEvent, b: ClassifiedEvent) =>
    a.event.name.localeCompare(b.event.name, 'es');
  out.today.sort(
    (a, b) =>
      TODAY_ORDER[a.today!] - TODAY_ORDER[b.today!] ||
      (a.event.startsAt < b.event.startsAt ? -1 : 1) ||
      byName(a, b),
  );
  out.upcoming.sort(
    (a, b) =>
      (a.event.startsAt < b.event.startsAt
        ? -1
        : a.event.startsAt > b.event.startsAt
          ? 1
          : 0) || byName(a, b),
  );
  out.past.sort(
    (a, b) =>
      (a.event.startsAt > b.event.startsAt
        ? -1
        : a.event.startsAt < b.event.startsAt
          ? 1
          : 0) || byName(a, b),
  );
  return out;
}

/** «Hoy empieza», «Hoy termina», «En marcha» u «Hoy» (de un solo día). */
export function todayLabel(c: Pick<ClassifiedEvent, 'event' | 'today'>) {
  switch (c.today) {
    case 'start':
      return c.event.startDate === c.event.endDate ? 'Hoy' : 'Hoy empieza';
    case 'end':
      return 'Hoy termina';
    case 'during':
      return 'En marcha';
    default:
      return '';
  }
}

/**
 * La tarjeta de la portada: solo si el evento EMPIEZA o ACABA hoy (el código
 * del plugin; «en marcha» sí cuenta en la pantalla de eventos, no aquí).
 */
export const isHomeCard = (c: Pick<ClassifiedEvent, 'today'>) =>
  c.today === 'start' || c.today === 'end';

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const dm = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return { d, m: MONTHS[m - 1] };
};

/** «10 oct», «10 – 12 oct» o «28 sep – 2 oct». */
export function eventDates(e: Pick<EventSummary, 'startDate' | 'endDate'>) {
  const a = dm(e.startDate);
  if (e.endDate === e.startDate) return `${a.d} ${a.m}`;
  const b = dm(e.endDate);
  return a.m === b.m && e.startDate.slice(0, 4) === e.endDate.slice(0, 4)
    ? `${a.d} – ${b.d} ${b.m}`
    : `${a.d} ${a.m} – ${b.d} ${b.m}`;
}

/** Los eventos cuya lista se precarga: los que tocan hoy y los dos días siguientes. */
export function eventsToPrefetch(
  events: readonly EventSummary[],
  today: string,
  until: string,
): EventSummary[] {
  return events.filter((e) => e.startDate <= until && e.endDate >= today);
}

/** Lo que el buscador compara: sin acentos ni mayúsculas. */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Con más de 8 eventos, buscador. */
export const EVENTS_SEARCH_FROM = 9;
