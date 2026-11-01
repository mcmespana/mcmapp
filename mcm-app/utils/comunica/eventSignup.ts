// utils/comunica/eventSignup.ts
//
// La acción de la ficha de un evento (plan 13), pura. El ORDEN importa
// (`sticpa_event_detail_html` y `sticpa_event_signup_block`,
// `inc/stic-events.php` 712-777 y 1018-1047):
//
//   1. pasado          → «Esta actividad ya se ha celebrado.»
//   2. con plaza       → «Ver mi inscripción» (a quien tiene plaza no se le
//                        dice que no es para él: primero lo que ES)
//   3. no es para ti   → el motivo del servidor, «Ver otras actividades»
//   4. fuera de plazo  → el motivo por fechas, «Ver otras actividades»
//   5. abierta         → «Inscribirme en esta actividad», la única principal
//
// Audiencia ANTES que plazo: a quien es de otra delegación, «el plazo
// terminó» le hace pensar que llegó tarde a algo que nunca fue suyo.

import type { EventDetail } from '@/services/comunica/contract';
import { isPastEvent, registrationWindow, windowNote } from './eventWindow';

export type SignupAction =
  | { kind: 'past'; note: string }
  | {
      kind: 'registered';
      registrationId: string;
      label: string;
      note: string;
    }
  | {
      kind: 'blocked';
      title: string;
      note: string;
      reason: 'audience' | 'window';
    }
  | { kind: 'open'; label: string; note: string | null; advanced: boolean };

/** Lo que hace falta de la ficha (también vale lo guardado sin conexión). */
export type SignupInput = Pick<
  EventDetail,
  | 'startDate'
  | 'endDate'
  | 'window'
  | 'myRegistrationId'
  | 'hasAdvancedForm'
  | 'signup'
>;

export const ADVANCED_FORM_NOTE =
  'La inscripción se hace en el formulario de la actividad. Te lo abrimos con tus datos ya puestos.';

/**
 * @param childName el nombre de pila del hijo que se ve; `''` viéndose a sí
 * mismo (FAM-a4: de quién es la plaza).
 */
export function signupAction(
  e: SignupInput,
  today: string,
  childName = '',
): SignupAction {
  if (isPastEvent(e, today)) {
    return { kind: 'past', note: 'Esta actividad ya se ha celebrado.' };
  }
  if (e.myRegistrationId) {
    return {
      kind: 'registered',
      registrationId: e.myRegistrationId,
      label: childName ? 'Ver su inscripción' : 'Ver mi inscripción',
      note: childName
        ? `${childName} ya tiene una inscripción para esta actividad.`
        : 'Ya tienes una inscripción para esta actividad.',
    };
  }
  const audience = e.signup?.audience;
  if (audience && !audience.ok) {
    return {
      kind: 'blocked',
      reason: 'audience',
      title: 'Esta actividad no es para ti',
      note: audience.message,
    };
  }
  const note = windowNote(registrationWindow(e.window, today));
  if (note) {
    return {
      kind: 'blocked',
      reason: 'window',
      title: 'La inscripción no está abierta',
      note,
    };
  }
  return {
    kind: 'open',
    label: 'Inscribirme en esta actividad',
    note: e.hasAdvancedForm ? ADVANCED_FORM_NOTE : null,
    advanced: e.hasAdvancedForm,
  };
}
