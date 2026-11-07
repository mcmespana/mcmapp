// utils/comunica/eventSignup.ts
//
// La acción de la ficha de un evento (plan 13, `sticpa_event_detail_html`): PURO. El orden importa y es éste:
//
//   pasado → con plaza → no es para ti → fuera de plazo → abierta
//
// A quien tiene plaza no se le dice que no es para él; y la audiencia va ANTES que el plazo: a quien es de otra delegación, «el plazo terminó» le
// hace pensar que llegó tarde. Los textos son los del plugin, para uno mismo y para un hijo («Lucía ya tiene una inscripción…»).

import type { EventDetail } from '@/services/comunica/contract';
import { fullDay } from './dates';
import { isPast } from './activityList';
import { windowState } from './eventWindow';

export type SignupAction =
  | { kind: 'past'; text: string }
  | {
      kind: 'registered';
      text: string;
      cta: string;
      registrationId: string;
    }
  | { kind: 'not_for_you'; title: string; text: string; cta: string }
  | { kind: 'closed'; title: string; text: string; cta: string }
  | { kind: 'open'; label: string; note: string | null };

export const OTHER_EVENTS = 'Ver otras actividades';

type Input = Pick<
  EventDetail,
  | 'startDate'
  | 'endDate'
  | 'window'
  | 'myRegistrationId'
  | 'hasAdvancedForm'
  | 'signup'
>;

/** `childName`: el nombre de pila del hijo que se ve, o `null` si se ve a uno mismo (o no tiene nombre). */
export function signupAction(
  e: Input,
  today: string,
  childName: string | null,
): SignupAction {
  if (isPast(e, today))
    return { kind: 'past', text: 'Esta actividad ya se ha celebrado.' };

  if (e.myRegistrationId)
    return {
      kind: 'registered',
      registrationId: e.myRegistrationId,
      text: childName
        ? `${childName} ya tiene una inscripción para esta actividad.`
        : 'Ya tienes una inscripción para esta actividad.',
      cta: childName ? 'Ver su inscripción' : 'Ver mi inscripción',
    };

  const audience = e.signup?.audience;
  if (audience && !audience.ok)
    return {
      kind: 'not_for_you',
      title: 'Esta actividad no es para ti',
      text: audience.message,
      cta: OTHER_EVENTS,
    };

  const state = windowState(e.window, today);
  if (state === 'before')
    return {
      kind: 'closed',
      title: 'La inscripción no está abierta',
      text: e.window.opensOn
        ? `La inscripción se abre el ${fullDay(e.window.opensOn)}.`
        : 'La inscripción todavía no está abierta.',
      cta: OTHER_EVENTS,
    };
  if (state === 'closed')
    return {
      kind: 'closed',
      title: 'La inscripción no está abierta',
      text: e.window.closesOn
        ? `El plazo de inscripción terminó el ${fullDay(e.window.closesOn)}.`
        : 'El plazo de inscripción ha terminado.',
      cta: OTHER_EVENTS,
    };

  return {
    kind: 'open',
    label: 'Inscribirme en esta actividad',
    note: e.hasAdvancedForm
      ? 'La inscripción se hace en el formulario de la actividad. Te lo abrimos con tus datos ya puestos.'
      : null,
  };
}
