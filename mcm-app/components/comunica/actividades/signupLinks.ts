// Los destinos de apuntarse (plan 13, interinos hasta el plan 14): con las
// formas del plugin, por `useOpenDestination`, que abre lo nativo si ya
// existe y, si no, el legado con la sesión del perfil que se ve. El 14, al
// registrar `single_stic_registrations` en `links.ts`, los hace nativos sin
// tocar estas pantallas.

import type { Destination } from '@/services/comunica/links';

/** «Inscribirme» (alta corta o formulario avanzado: lo decide el plugin). */
export const signUpDestination = (eventId: string): Destination => ({
  internalpage: 'single_stic_registrations',
  action: 'create',
  from: 'stic_events',
  id: eventId,
});

/** «Mi inscripción»: directo a la inscripción (el plugin iba a la lista). */
export const registrationDestination = (
  registrationId: string,
): Destination => ({
  internalpage: 'single_stic_registrations',
  action: 'detail',
  id: registrationId,
});

/** «Ver mis inscripciones» (el vacío de Eventos). */
export const REGISTRATIONS_DESTINATION: Destination = {
  internalpage: 'list_stic_registrations',
};
