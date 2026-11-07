// Los textos de la salud (plan 05, regla 22 y tabla de estados).

import type { HealthKind } from '@/services/comunica/contract';
import { isComunicaApiError } from '@/services/comunica/client';

export const HEALTH_LABEL: Record<HealthKind, string> = {
  allergies: 'Alergias',
  intolerances: 'Intolerancias',
  treatments: 'Tratamientos',
  illnesses: 'Enfermedades',
  other: 'Otras patologías',
};

export const HEALTH_OFFLINE = 'Sin conexión. La salud solo se ve con conexión.';
export const HEALTH_EMPTY = 'Sin detalle en su ficha.';
export const HEALTH_ERROR = 'No se ha podido cargar. Mira su ficha.';

/** ¿El fallo es de red? (o el CRM no contesta: para la persona, lo mismo). */
export const isOfflineError = (e: unknown) =>
  isComunicaApiError(e) &&
  (e.code === 'network' || e.code === 'crm_unavailable');
