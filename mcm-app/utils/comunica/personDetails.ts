// utils/comunica/personDetails.ts
//
// «Mis datos» (plan 12) sin React: de `PersonDetails` y la salud a los valores
// planos del formulario (`forms.ts`) y de vuelta, de los cambios al cuerpo del
// `PATCH` y del `PUT /health`. Más el título, la fecha de nacimiento en
// lenguaje humano y a qué campo va cada error del servidor.

import type {
  HealthInfo,
  HealthWrite,
  PersonDetails,
  PersonDetailsWrite,
  SetScarf,
} from '@/services/comunica/contract';
import type { FormValue, FormValues } from './forms';
import { firstNameOf } from './profiles';

type Changes = PersonDetailsWrite['changes'];
type HealthChanges = HealthWrite['health'];

const str = (v: string | number | null | undefined): FormValue =>
  v === null || v === undefined ? null : String(v);

/** Los datos como valores del formulario (`contact.email`…). */
export function detailsValues(d: PersonDetails): FormValues {
  const out: Record<string, FormValue> = {
    'identity.firstName': d.identity.firstName,
    'identity.lastName': d.identity.lastName,
    'identity.documentType': d.identity.documentType,
    'identity.documentNumber': d.identity.documentNumber,
    'identity.birthDate': d.identity.birthDate,
    // Lo que se puede completar para pagar empieza vacío.
    'identityFill.firstName': null,
    'identityFill.lastName': null,
    'identityFill.documentType': null,
    'identityFill.documentNumber': null,
    gender: d.gender,
    documentSupportNumber: d.documentSupportNumber,
    documentIssueDate: d.documentIssueDate,
    'contact.email': d.contact.email,
    'contact.mobile': d.contact.mobile,
    'contact.emergencyPhone': d.contact.emergencyPhone,
    'address.street': d.address.street,
    'address.city': d.address.city,
    'address.province': d.address.province,
    'address.postalCode': d.address.postalCode,
    'address.region': d.address.region,
    'consents.dataProtection': d.consents.dataProtection,
    'consents.healthData': d.consents.healthData,
    'consents.photos': d.consents.photos,
  };
  if (d.mcm) {
    out['mcm.stage'] = d.mcm.stage;
    out['mcm.comLevel'] = d.mcm.comLevel;
    // «Desconocido» solo se lee: en el desplegable sale como «Sin indicar».
    out['mcm.scarf'] = d.mcm.scarf === 'unknown' ? null : d.mcm.scarf;
    out['mcm.shirtSize'] = d.mcm.shirtSize;
    out['mcm.groupName'] = d.mcm.groupName;
    out['mcm.localMcm'] = d.mcm.localMcm;
    out['mcm.lcIncorporationYear'] = str(d.mcm.lcIncorporationYear);
    out['mcm.memberSince'] = str(d.mcm.memberSince);
  }
  return out;
}

export const HEALTH_KEYS = [
  'foodIntolerances',
  'allergies',
  'illnesses',
  'treatments',
  'other',
] as const;

export function healthValues(h: HealthInfo | null | undefined): FormValues {
  return Object.fromEntries(
    HEALTH_KEYS.map((k) => [`health.${k}`, h ? h[k] : null]),
  );
}

const YEAR_KEYS = new Set(['mcm.lcIncorporationYear', 'mcm.memberSince']);

/**
 * Los cambios (`formChanges`) como los cuerpos del contrato: `details` para
 * el `PATCH` y `health` para el `PUT`; `null` si no hay nada que mandar.
 */
export function writesFrom(changes: Record<string, FormValue>): {
  details: Changes | null;
  health: HealthChanges | null;
} {
  const details: Record<string, unknown> = {};
  const health: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(changes)) {
    const [group, field] = key.split('.');
    let v: unknown = raw;
    if (YEAR_KEYS.has(key)) v = raw === null ? null : Number(raw);
    if (key === 'mcm.scarf') v = raw as SetScarf | null;
    if (group === 'health') {
      health[field] = raw as string | null;
    } else if (field === undefined) {
      details[group] = v;
    } else if (group === 'identityFill') {
      // Completar la identidad: lo vacío no viaja.
      if (raw === null) continue;
      const fill = (details.identityFill ?? {}) as Record<string, unknown>;
      fill[field] = field === 'documentNumber' ? String(raw).toUpperCase() : v;
      details.identityFill = fill;
    } else {
      const sub = (details[group] ?? {}) as Record<string, unknown>;
      sub[field] = v;
      details[group] = sub;
    }
  }
  return {
    details: Object.keys(details).length ? (details as Changes) : null,
    health: Object.keys(health).length ? (health as HealthChanges) : null,
  };
}

/** «Mis datos»; viendo a un hijo, «Datos de Lucía» (o «del participante»). */
export function detailsTitle(
  viewingSelf: boolean,
  firstName: string | null | undefined,
): string {
  if (viewingSelf) return 'Mis datos';
  const name = firstNameOf(firstName);
  return name ? `Datos de ${name}` : 'Datos del participante';
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2014-05-05` → «5 de mayo de 2014». */
export function humanDate(day: FormValue): string {
  if (typeof day !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${Number(m[3])} de ${MONTHS[Number(m[2]) - 1]} de ${m[1]}`;
}

/** El campo donde se enseña cada error `validation` del servidor. */
const FIELD_OF_REASON: Record<string, string> = {
  bad_email: 'contact.email',
  bad_postal_code: 'address.postalCode',
  bad_document: 'identityFill.documentNumber',
  bad_date: 'documentIssueDate',
};

export const fieldOfReason = (reason: string | undefined): string | null =>
  (reason && FIELD_OF_REASON[reason]) || null;

/** Qué datos de identidad se pueden completar para pagar (los vacíos). */
export function fillableIdentity(d: PersonDetails) {
  const empty = (v: string | null) => (v ?? '').trim() === '';
  return {
    firstName: empty(d.identity.firstName),
    lastName: empty(d.identity.lastName),
    documentType: empty(d.identity.documentType),
    documentNumber: empty(d.identity.documentNumber),
  };
}
