// utils/comunica/eventWindow.ts
//
// El plazo de inscripción (`sticpa_event_registration_window`, plan 13): PURO. Los dos días vacíos = abierta (regla de seguridad: sin fechas no se
// cierra una inscripción por error); antes del día de apertura = «antes»; el día de cierre cuenta ENTERO (hasta las 23:59:59 de Madrid: se compara
// el día de hoy en Madrid, así que ni el cambio de hora lo mueve); después, cerrada.

import { fullDay } from './dates';

export type WindowState = 'open' | 'before' | 'closed';
export interface RegistrationWindow {
  opensOn: string | null;
  closesOn: string | null;
}

/** `today` es el día de hoy en Madrid (`madridDay(comunicaNow())`). */
export function windowState(w: RegistrationWindow, today: string): WindowState {
  if (w.opensOn && today < w.opensOn) return 'before';
  if (w.closesOn && today > w.closesOn) return 'closed';
  return 'open';
}

export const hasWindowDates = (w: RegistrationWindow) =>
  !!(w.opensOn || w.closesOn);

/** El chip del plazo: solo cerrado y «no abierta»; abierta no lleva. */
export function windowChip(
  state: WindowState,
): { label: string; tone: 'neutral' | 'info' } | null {
  if (state === 'closed')
    return { label: 'Inscripción cerrada', tone: 'neutral' };
  if (state === 'before')
    return { label: 'Inscripción no abierta', tone: 'info' };
  return null;
}

/** La línea de plazo de la TARJETA: «Hasta el …» / «Se abre el …», nunca en lo cerrado. */
export function cardWindowLine(
  w: RegistrationWindow,
  state: WindowState,
): string | null {
  if (state === 'before' && w.opensOn)
    return `Se abre el ${fullDay(w.opensOn)}`;
  if (state === 'open' && w.closesOn) return `Hasta el ${fullDay(w.closesOn)}`;
  return null;
}

/** El dato de plazo de la FICHA: «Hasta el …», «Se abre el …», «Cerrada el …». */
export function detailWindowLine(
  w: RegistrationWindow,
  state: WindowState,
): string | null {
  if (state === 'closed' && w.closesOn)
    return `Cerrada el ${fullDay(w.closesOn)}`;
  return cardWindowLine(w, state);
}
