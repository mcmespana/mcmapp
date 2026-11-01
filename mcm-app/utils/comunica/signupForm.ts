// utils/comunica/signupForm.ts
//
// El alta corta (plan 14): validar lo que hay en pantalla y armar el envío. PURO. Lo que enseña la app es cortesía: el guard de verdad es el servidor.
//
//   · Un grupo de opciones obligatorio por pregunta; el envío lleva el NÚMERO de opción (desde 1) y el servidor lo cambia por su texto.
//   · Con precio y medios en el CRM: medio obligatorio; con domiciliación, IBAN válido (módulo 97). El IBAN solo viaja con domiciliación.
//   · Las necesidades especiales llevan descripción solo con la opción «sí» (`yesValue`).
//   · Ni la persona inscrita ni quien paga viajan en el cuerpo: la persona es el `pid` de la ruta.

import type {
  PaymentMethod,
  SignupForm,
  SignupWrite,
} from '@/services/comunica/contract';
import { isValidIban, normalizeIban } from './iban';

export interface SignupDraft {
  /** Número de opción (desde 1) de cada pregunta, por su `n`. */
  answers: Partial<Record<1 | 2, number>>;
  method: PaymentMethod | null;
  /** Solo vive aquí, en el estado del formulario: nunca a una caché, una cola o un log. */
  iban: string;
  specialNeeds: string | null;
  specialNeedsDescription: string;
}

export const EMPTY_DRAFT: SignupDraft = {
  answers: {},
  method: null,
  iban: '',
  specialNeeds: null,
  specialNeedsDescription: '',
};

export const SIGNUP_ERRORS = {
  answers: 'Contesta a todas las preguntas de la actividad.',
  payment: 'Elige cómo vas a pagar.',
  iban: 'El IBAN no parece válido.',
} as const;

export type SignupErrors = Partial<
  Record<'answers' | 'payment' | 'iban', string>
>;

/** ¿Hay que elegir cómo se paga? (con precio y medios en el CRM). */
export const needsPayment = (
  form: Pick<SignupForm, 'price' | 'paymentMethods'>,
) => form.price != null && form.price > 0 && form.paymentMethods.length > 0;

export function signupErrors(
  form: Pick<SignupForm, 'questions' | 'price' | 'paymentMethods'>,
  draft: SignupDraft,
): SignupErrors {
  const e: SignupErrors = {};
  if (form.questions.some((q) => !draft.answers[q.n]))
    e.answers = SIGNUP_ERRORS.answers;
  if (needsPayment(form)) {
    if (
      !draft.method ||
      !form.paymentMethods.some((m) => m.key === draft.method)
    )
      e.payment = SIGNUP_ERRORS.payment;
    else if (draft.method === 'direct_debit' && !isValidIban(draft.iban))
      e.iban = SIGNUP_ERRORS.iban;
  }
  return e;
}

/** El campo al que ir primero cuando falta algo (el orden de la pantalla). */
export const firstErrorField = (
  e: SignupErrors,
): 'answers' | 'payment' | 'iban' | null =>
  e.answers ? 'answers' : e.payment ? 'payment' : e.iban ? 'iban' : null;

export function buildSignup(
  form: Pick<
    SignupForm,
    'questions' | 'price' | 'paymentMethods' | 'specialNeeds'
  >,
  draft: SignupDraft,
  clientId: string,
  eventId: string,
): SignupWrite {
  const pays = needsPayment(form);
  const iban =
    draft.method === 'direct_debit' ? normalizeIban(draft.iban) : undefined;
  const sn = draft.specialNeeds;
  const yes = sn !== null && sn === form.specialNeeds.yesValue;
  return {
    clientId,
    eventId,
    answers: form.questions.map((q) => ({
      n: q.n,
      option: draft.answers[q.n] as number,
    })),
    payment:
      pays && draft.method
        ? { method: draft.method, ...(iban ? { iban } : {}) }
        : null,
    specialNeeds: sn,
    specialNeedsDescription: yes
      ? draft.specialNeedsDescription.trim() || null
      : null,
  };
}

/** El título de cada pregunta: la pregunta, o «Elige una opción» («Elige una opción (2)» si hay dos sin texto). */
export function questionTitle(
  q: { n: 1 | 2; prompt: string | null },
  total: number,
): string {
  if (q.prompt) return q.prompt;
  return total > 1 ? `Elige una opción (${q.n})` : 'Elige una opción';
}
