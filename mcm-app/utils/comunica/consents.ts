// utils/comunica/consents.ts
//
// Las siete autorizaciones de un menor (plan 05, regla 23). `null` es «Sin
// contestar», nunca un «no»: las fichas migradas llegaron vacías.

import type { Consents } from '@/services/comunica/contract';

export const CONSENT_ORDER: readonly (keyof Consents)[] = [
  'goHomeAlone',
  'photos',
  'whatsapp',
  'outings',
  'participation',
  'healthData',
  'dataProtection',
];

export const CONSENT_LABEL: Record<keyof Consents, string> = {
  goHomeAlone: 'Irse solo/a a casa',
  photos: 'Cesión de imágenes',
  whatsapp: 'Grupos de WhatsApp',
  outings: 'Actividades fuera del centro',
  participation: 'Participar en las actividades',
  healthData: 'Uso de datos de salud',
  dataProtection: 'Protección de datos (LOPD)',
};

export type ConsentState = 'yes' | 'no' | 'unanswered';

export const consentState = (v: boolean | null | undefined): ConsentState =>
  v === true ? 'yes' : v === false ? 'no' : 'unanswered';

export const CONSENT_STATE_LABEL: Record<ConsentState, string> = {
  yes: 'Sí',
  no: 'No',
  unanswered: 'Sin contestar',
};

/** La solapa del pliegue: «Todo autorizado» o «2 sin autorizar · 1 sin contestar». */
export function consentsSummary(c: Consents): string {
  const states = CONSENT_ORDER.map((k) => consentState(c[k]));
  const no = states.filter((s) => s === 'no').length;
  const unanswered = states.filter((s) => s === 'unanswered').length;
  const bits = [
    no > 0 ? `${no} sin autorizar` : null,
    unanswered > 0 ? `${unanswered} sin contestar` : null,
  ].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Todo autorizado';
}
