// utils/comunica/eventWindow.ts
//
// El plazo de inscripción de un evento (plan 13), puro, como
// `sticpa_event_registration_window` (`inc/stic-events.php` 588-624):
//
//   · los dos vacíos → ABIERTA (regla de seguridad: sin fechas no se cierra);
//   · antes del día de apertura → «antes»;
//   · el día de cierre cuenta ENTERO, hasta las 23:59:59 de Madrid;
//   · si no, abierta.
//
// Se calcula en la app con la fecha de hoy (de Madrid): lo guardado sigue bien
// al día siguiente sin cobertura. Con días de Madrid, el cambio de hora no
// mueve nada.

import type { EventCard } from '@/services/comunica/contract';
import type { ChipTone } from '@/components/comunica/comun/theme';
import { dateLine, dayInWords } from './recordDates';

export type WindowState = 'open' | 'before' | 'closed';

export interface RegistrationWindow {
  state: WindowState;
  opensOn: string | null;
  closesOn: string | null;
  /** Los dos vacíos (el plugin, `sin_datos`): cuenta como abierta. */
  noDates: boolean;
}

type WindowLike = { opensOn: string | null; closesOn: string | null };

export function registrationWindow(
  w: WindowLike,
  today: string,
): RegistrationWindow {
  const { opensOn, closesOn } = w;
  const state: WindowState =
    opensOn !== null && today < opensOn
      ? 'before'
      : closesOn !== null && today > closesOn
        ? 'closed'
        : 'open';
  return { state, opensOn, closesOn, noDates: !opensOn && !closesOn };
}

/**
 * ¿Ya se celebró? Por la fecha de FIN (un campamento sigue mientras dura) y,
 * sin ella, por la de inicio. Lo que acaba hoy sigue. Sin fechas, no.
 */
export function isPastEvent(
  e: Pick<EventCard, 'startDate' | 'endDate'>,
  today: string,
): boolean {
  const ref = e.endDate ?? e.startDate;
  return ref !== null && ref < today;
}

/**
 * El dato del plazo («Hasta el 25 de octubre de 2026»), o `null` si no dice
 * nada (`sticpa_event_registration_fact`): abierta sin cierre no es un dato.
 */
export function windowFact(w: RegistrationWindow): string | null {
  if (w.state === 'before') {
    return w.opensOn ? `Se abre el ${dayInWords(w.opensOn)}` : null;
  }
  if (w.state === 'closed') {
    return w.closesOn ? `Cerrada el ${dayInWords(w.closesOn)}` : null;
  }
  return w.closesOn ? `Hasta el ${dayInWords(w.closesOn)}` : null;
}

/** El motivo por fechas (`sticpa_event_registration_note`); `''` si se puede. */
export function windowNote(w: RegistrationWindow): string {
  if (w.state === 'before') {
    return w.opensOn
      ? `La inscripción se abre el ${dayInWords(w.opensOn)}.`
      : 'La inscripción todavía no está abierta.';
  }
  if (w.state === 'closed') {
    return w.closesOn
      ? `El plazo de inscripción terminó el ${dayInWords(w.closesOn)}.`
      : 'El plazo de inscripción ya ha terminado.';
  }
  return '';
}

export interface Chip {
  label: string;
  tone: ChipTone;
}

/** El chip del plazo cuando contradice al CRM (`sticpa_event_registration_chip`). */
export function windowChip(w: RegistrationWindow): Chip | null {
  if (w.state === 'closed')
    return { label: 'Inscripción cerrada', tone: 'neutral' };
  if (w.state === 'before')
    return { label: 'Inscripción no abierta', tone: 'info' };
  return null;
}

const TONE: Record<
  NonNullable<EventCard['myRegistrationStatus']>['tone'],
  ChipTone
> = {
  ok: 'positive',
  warn: 'warning',
  danger: 'negative',
  neutral: 'neutral',
};

/**
 * El chip de una tarjeta, por este orden: «Con plaza» (o el estado en rojo de
 * una inscripción rechazada) → «Ya celebrado» → el del plazo → la etiqueta del
 * CRM. Cuando hay fechas, mandan las fechas.
 */
export function eventChip(e: EventCard, today: string): Chip | null {
  if (e.myRegistrationId) {
    const s = e.myRegistrationStatus;
    return s && s.tone === 'danger'
      ? { label: s.label, tone: TONE[s.tone] }
      : { label: 'Con plaza', tone: 'positive' };
  }
  if (isPastEvent(e, today)) return { label: 'Ya celebrado', tone: 'neutral' };
  return (
    windowChip(registrationWindow(e.window, today)) ??
    (e.statusLabel ? { label: e.statusLabel, tone: 'neutral' } : null)
  );
}

/**
 * Las líneas de la tarjeta: la fecha, el lugar y el plazo, este último SALVO
 * si está cerrado (el chip ya lo dice) o ya hay plaza (ya no te toca).
 */
export function cardLines(e: EventCard, today: string): string[] {
  const lines: string[] = [];
  const when = dateLine(e.startDate, e.endDate);
  if (when) lines.push(when);
  if (e.place) lines.push(e.place);
  const w = registrationWindow(e.window, today);
  if (!e.myRegistrationId && !isPastEvent(e, today) && w.state !== 'closed') {
    const fact = windowFact(w);
    if (fact) lines.push(fact);
  }
  return lines;
}

/** La acción del pie de la tarjeta: solo si lleva a OTRO sitio. */
export function cardAction(
  e: EventCard,
  today: string,
): 'myRegistration' | 'signUp' | null {
  if (e.myRegistrationId) return 'myRegistration';
  if (isPastEvent(e, today)) return null;
  return registrationWindow(e.window, today).state === 'open' ? 'signUp' : null;
}
