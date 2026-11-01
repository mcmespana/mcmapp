// utils/comunica/personDetails.ts
//
// «Mis datos» / «Datos de Lucía» (plan 12), lógica pura: del contrato al formulario, qué campos se ven, qué hay que mandar (SOLO lo que cambia) y qué
// formatos no dejan guardar. Nada de React. Las reglas están en `docs/planes/area-nativa/12-mis-datos.md`; los textos, en
// `components/comunica/datos/copy.ts`.
//
//   · Ningún campo es obligatorio; sí hay formatos (correo con el patrón del plugin, código postal de cinco cifras, años de cuatro).
//   · Un campo que se esconde por la etapa CONSERVA su valor y no se manda (el plugin solo lo oculta).
//   · Las autorizaciones: `null` = sin contestar. Solo viaja la que se toca (encender = `true`; encender y apagar = `false`, a propósito); una que
//     no se ha tocado NO viaja nunca (el plugin convertía «sin contestar» en «no»).
//   · La identidad se rellena SOLO viniendo a pagar (`completar=pago`) y SOLO lo que está vacío en el CRM.

import type {
  HealthInfo,
  PersonDetails,
  PersonDetailsChanges,
  Scarf,
} from '@/services/comunica/contract';
import { isValidDocument } from './documentId';

type Consent = boolean | null;

export interface DetailsForm {
  gender: string | null;
  supportNumber: string;
  /** `AAAA-MM-DD` o vacío. */
  issueDate: string;
  email: string;
  mobile: string;
  emergencyPhone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  region: string | null;
  stage: string | null;
  comLevel: string | null;
  scarf: Scarf | null;
  shirtSize: string | null;
  groupName: string;
  localMcm: string | null;
  lcYear: string;
  memberSince: string;
  dataProtection: Consent;
  healthData: Consent;
  photos: Consent;
  /** Solo con `completar=pago` y solo lo que el CRM no tiene. */
  fillFirstName: string;
  fillLastName: string;
  fillDocumentType: string | null;
  fillDocumentNumber: string;
}

export interface HealthForm {
  foodIntolerances: string;
  allergies: string;
  illnesses: string;
  treatments: string;
  other: string;
}

export type DetailErrors = Partial<Record<keyof DetailsForm, string>>;

/** El patrón del plugin para el correo (`single_stic_comunica_perfil.php`, `pattern` de `email1`). */
export const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
const POSTAL = /^\d{5}$/;
const YEAR = /^\d{4}$/;
export const YEAR_MIN = 1900;
export const YEAR_MAX = 2100;

export const ERROR_TEXT = {
  email: 'El correo electrónico no es válido.',
  postalCode: 'El código postal son cinco cifras.',
  year: 'Escribe el año con cuatro cifras, por ejemplo 2019.',
  document: 'El número de documento no es válido.',
  required: 'Escribe este dato para poder pagar.',
} as const;

const text = (v: string | null | undefined) => (v ?? '').trim();
const orNull = (v: string) => (text(v) === '' ? null : text(v));
const yearText = (v: number | null) => (v == null ? '' : String(v));

export function formFromDetails(d: PersonDetails): DetailsForm {
  return {
    gender: d.gender,
    supportNumber: d.documentSupportNumber ?? '',
    issueDate: d.documentIssueDate ?? '',
    email: d.contact.email ?? '',
    mobile: d.contact.mobile ?? '',
    emergencyPhone: d.contact.emergencyPhone ?? '',
    street: d.address.street ?? '',
    city: d.address.city ?? '',
    province: d.address.province ?? '',
    postalCode: d.address.postalCode ?? '',
    region: d.address.region,
    stage: d.mcm?.stage ?? null,
    comLevel: d.mcm?.comLevel ?? null,
    scarf: d.mcm?.scarf ?? null,
    shirtSize: d.mcm?.shirtSize ?? null,
    groupName: d.mcm?.groupName ?? '',
    localMcm: d.mcm?.localMcm ?? null,
    lcYear: yearText(d.mcm?.lcIncorporationYear ?? null),
    memberSince: yearText(d.mcm?.memberSince ?? null),
    dataProtection: d.consents.dataProtection,
    healthData: d.consents.healthData,
    photos: d.consents.photos,
    fillFirstName: '',
    fillLastName: '',
    fillDocumentType: null,
    fillDocumentNumber: '',
  };
}

export function formFromHealth(h: HealthInfo): HealthForm {
  return {
    foodIntolerances: h.foodIntolerances ?? '',
    allergies: h.allergies ?? '',
    illnesses: h.illnesses ?? '',
    treatments: h.treatments ?? '',
    other: h.other ?? '',
  };
}

// ── Qué se ve ───────────────────────────────────────────────────────────────

export interface Visibility {
  /** Las secciones que manda el servidor (el hijo no tiene `mcm`). */
  sections: ReadonlySet<PersonDetails['sections'][number]>;
  /** «Nivel COM»: solo con etapa COM. */
  comLevel: boolean;
  /** «Año incorporación LC»: solo con LC Incorporado. */
  lcYear: boolean;
  /** «Número de soporte» y «Fecha de expedición del DNI»: solo si ya tienen valor. */
  support: boolean;
  issueDate: boolean;
}

export function visibility(d: PersonDetails, form: DetailsForm): Visibility {
  return {
    sections: new Set(d.sections),
    comLevel: form.stage === 'com',
    lcYear: form.stage === 'lc_incorporated',
    support: text(d.documentSupportNumber) !== '',
    issueDate: d.documentIssueDate != null,
  };
}

/** Qué datos de identidad se pueden escribir viniendo a pagar: solo los que están vacíos. */
export function fillable(d: PersonDetails, completar: boolean) {
  const empty = (v: string | null) => text(v) === '';
  return {
    firstName: completar && empty(d.identity.firstName),
    lastName: completar && empty(d.identity.lastName),
    documentType: completar && empty(d.identity.documentType),
    documentNumber: completar && empty(d.identity.documentNumber),
  };
}

/** ¿Falta algo para poder pagar? (nombre, apellidos, correo y documento) */
export function missingToPay(d: PersonDetails): boolean {
  return (
    text(d.identity.firstName) === '' ||
    text(d.identity.lastName) === '' ||
    text(d.contact.email) === '' ||
    text(d.identity.documentNumber) === ''
  );
}

// ── Qué se manda ────────────────────────────────────────────────────────────

function yearValue(v: string): number | null {
  const t = text(v);
  return t === '' ? null : Number(t);
}

/**
 * SOLO lo que cambia contra lo confirmado por el servidor. `{}` = nada que mandar. Lo escondido por la etapa y lo que la audiencia no tiene
 * (`mcm` de un hijo) no viaja; una autorización sin tocar, tampoco.
 */
export function detailChanges(
  d: PersonDetails,
  form: DetailsForm,
  opts: { fill?: boolean } = {},
): PersonDetailsChanges {
  const out: PersonDetailsChanges = {};
  const base = formFromDetails(d);
  const vis = visibility(d, form);

  if (text(form.gender) !== text(base.gender)) out.gender = form.gender;
  if (vis.support && text(form.supportNumber) !== text(base.supportNumber))
    out.documentSupportNumber = orNull(form.supportNumber);
  if (vis.issueDate && form.issueDate !== base.issueDate)
    out.documentIssueDate = form.issueDate === '' ? null : form.issueDate;

  const contact: NonNullable<PersonDetailsChanges['contact']> = {};
  if (text(form.email) !== text(base.email)) contact.email = orNull(form.email);
  if (text(form.mobile) !== text(base.mobile))
    contact.mobile = orNull(form.mobile);
  if (text(form.emergencyPhone) !== text(base.emergencyPhone))
    contact.emergencyPhone = orNull(form.emergencyPhone);
  if (Object.keys(contact).length) out.contact = contact;

  const address: NonNullable<PersonDetailsChanges['address']> = {};
  if (text(form.street) !== text(base.street))
    address.street = orNull(form.street);
  if (text(form.city) !== text(base.city)) address.city = orNull(form.city);
  if (text(form.province) !== text(base.province))
    address.province = orNull(form.province);
  if (text(form.postalCode) !== text(base.postalCode))
    address.postalCode = orNull(form.postalCode);
  if (form.region !== base.region) address.region = form.region;
  if (Object.keys(address).length) out.address = address;

  if (d.mcm && vis.sections.has('mcm')) {
    const mcm: NonNullable<PersonDetailsChanges['mcm']> = {};
    if (form.stage !== base.stage) mcm.stage = form.stage;
    if (vis.comLevel && form.comLevel !== base.comLevel)
      mcm.comLevel = form.comLevel;
    if (form.scarf !== base.scarf && form.scarf !== 'unknown')
      mcm.scarf = form.scarf;
    if (form.shirtSize !== base.shirtSize) mcm.shirtSize = form.shirtSize;
    if (text(form.groupName) !== text(base.groupName))
      mcm.groupName = orNull(form.groupName);
    if (form.localMcm !== base.localMcm) mcm.localMcm = form.localMcm;
    if (vis.lcYear && text(form.lcYear) !== text(base.lcYear))
      mcm.lcIncorporationYear = yearValue(form.lcYear);
    if (text(form.memberSince) !== text(base.memberSince))
      mcm.memberSince = yearValue(form.memberSince);
    if (Object.keys(mcm).length) out.mcm = mcm;
  }

  // Autorizaciones: solo la que se toca (nunca `null`, que es «sin contestar»).
  const consents: NonNullable<PersonDetailsChanges['consents']> = {};
  for (const k of ['dataProtection', 'healthData', 'photos'] as const) {
    if (form[k] !== base[k] && form[k] !== null) consents[k] = form[k];
  }
  if (Object.keys(consents).length) out.consents = consents;

  if (opts.fill) {
    const can = fillable(d, true);
    const fill: NonNullable<PersonDetailsChanges['identityFill']> = {};
    if (can.firstName && text(form.fillFirstName))
      fill.firstName = text(form.fillFirstName);
    if (can.lastName && text(form.fillLastName))
      fill.lastName = text(form.fillLastName);
    if (can.documentType && form.fillDocumentType)
      fill.documentType = form.fillDocumentType;
    if (can.documentNumber && text(form.fillDocumentNumber))
      fill.documentNumber = text(form.fillDocumentNumber).toUpperCase();
    if (Object.keys(fill).length) out.identityFill = fill;
  }
  return out;
}

/** La salud: solo los textos que cambian (`null` = se ha vaciado). `{}` = nada. */
export function healthChanges(
  confirmed: HealthInfo,
  form: HealthForm,
): Partial<HealthInfo> {
  const base = formFromHealth(confirmed);
  const out: Partial<HealthInfo> = {};
  for (const k of Object.keys(base) as (keyof HealthForm)[]) {
    if (text(form[k]) !== text(base[k])) out[k] = orNull(form[k]);
  }
  return out;
}

export const isEmpty = (o: object) => Object.keys(o).length === 0;

// ── Qué no deja guardar ─────────────────────────────────────────────────────

/** Los formatos. Un campo vacío nunca es un error (nada es obligatorio), salvo lo de pagar. */
export function detailErrors(
  d: PersonDetails,
  form: DetailsForm,
  opts: { fill?: boolean } = {},
): DetailErrors {
  const e: DetailErrors = {};
  if (text(form.email) !== '' && !EMAIL_PATTERN.test(text(form.email)))
    e.email = ERROR_TEXT.email;
  if (text(form.postalCode) !== '' && !POSTAL.test(text(form.postalCode)))
    e.postalCode = ERROR_TEXT.postalCode;
  const year = (v: string) =>
    text(v) !== '' &&
    (!YEAR.test(text(v)) ||
      Number(text(v)) < YEAR_MIN ||
      Number(text(v)) > YEAR_MAX);
  if (visibility(d, form).lcYear && year(form.lcYear))
    e.lcYear = ERROR_TEXT.year;
  if (d.mcm && year(form.memberSince)) e.memberSince = ERROR_TEXT.year;
  if (opts.fill) {
    const can = fillable(d, true);
    if (
      can.documentNumber &&
      text(form.fillDocumentNumber) !== '' &&
      !isValidDocument(form.fillDocumentType, form.fillDocumentNumber)
    )
      e.fillDocumentNumber = ERROR_TEXT.document;
  }
  return e;
}
