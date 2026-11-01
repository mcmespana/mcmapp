// services/comunica/fake/registrations.ts
//
// Las inscripciones del servidor falso (planes 13 y 14): UNA sola fuente para «Eventos» (qué tiene ya cada perfil) y para «Inscripciones». El estado vive
// POR datos (`WeakMap`): `reset()` del falso lo deja como al principio.
//
// Sembradas para ver cada estado de pago y de inscripción:
//   Lucía  → «Con plaza» (sesiones) · de un evento oculto · rechazada · pagada con tarjeta (de un evento pasado) · un curso (MIC, no se cancela).
//   Nico/«Participante» (`f-hijo-sin-nombre`) → pago pendiente con tarjeta · domiciliado · devuelto (plazo cerrado) · pendiente por transferencia.

import type { PaymentState, RegistrationCard } from '../contract';
import type { FakeData } from './fixtures';

export interface FakeRegistration {
  id: string;
  eventId: string;
  /** Días desde «hoy» del alta. */
  signedOn: number;
  status: { label: string; tone: RegistrationCard['status']['tone'] };
  cancelled: boolean;
  answers: number[];
  specialNeeds: string | null;
  specialNeedsDescription: string | null;
  payment: PaymentState;
  amount: number | null;
  participation: string | null;
  attendancePercent: number | null;
  attendees: number;
  schoolLevel: string | null;
  classLabel: string | null;
  contacts: {
    name: string;
    relationship: string | null;
    phone: string | null;
    email: string | null;
  }[];
}

const noPay: PaymentState = {
  state: 'none',
  amount: null,
  method: null,
  methodLabel: null,
  date: null,
  paymentId: null,
};
const ok = { label: 'Confirmada', tone: 'ok' as const };
const TUTORS = [
  {
    name: 'Marta Villarroya',
    relationship: 'Madre',
    phone: '600111222',
    email: 'marta@ejemplo.org',
  },
  {
    name: 'Joan Messeguer',
    relationship: 'Padre',
    phone: '600333444',
    email: null,
  },
];

/** `date` en los pagos sembrados va en días relativos; se resuelve con el «hoy» del falso al leer. */
export const SEED: Record<string, FakeRegistration[]> = {
  'f-hijo-lucia': [
    {
      id: 'reg-lucia-sesiones',
      eventId: 'pev-sesiones',
      signedOn: -40,
      status: ok,
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: noPay,
      amount: null,
      participation: null,
      attendancePercent: 85,
      attendees: 1,
      schoolLevel: '5.º EP',
      classLabel: 'Clase B',
      contacts: TUTORS,
    },
    {
      id: 'reg-lucia-oculta',
      eventId: 'pev-oculta-con',
      signedOn: -10,
      status: ok,
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: noPay,
      amount: null,
      participation: null,
      attendancePercent: null,
      attendees: 1,
      schoolLevel: '5.º EP',
      classLabel: null,
      contacts: [],
    },
    {
      id: 'reg-lucia-rechazada',
      eventId: 'pev-rechazada',
      signedOn: -8,
      status: { label: 'Rechazada', tone: 'danger' },
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: noPay,
      amount: null,
      participation: null,
      attendancePercent: null,
      attendees: 1,
      schoolLevel: '5.º EP',
      classLabel: null,
      contacts: [],
    },
    {
      id: 'reg-lucia-pasada',
      eventId: 'pev-pasada',
      signedOn: -50,
      status: ok,
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: {
        state: 'paid',
        amount: 110,
        method: 'card',
        methodLabel: 'Tarjeta',
        date: '@-30',
        paymentId: 'pay-lucia-110',
      },
      amount: 110,
      participation: null,
      attendancePercent: 100,
      attendees: 1,
      schoolLevel: '5.º EP',
      classLabel: 'Clase B',
      contacts: TUTORS,
    },
    {
      id: 'reg-lucia-curso',
      eventId: 'pev-curso',
      signedOn: -70,
      status: ok,
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: {
        state: 'no_commitment',
        amount: 300,
        method: null,
        methodLabel: null,
        date: null,
        paymentId: null,
      },
      amount: 300,
      participation: null,
      attendancePercent: 70,
      attendees: 1,
      schoolLevel: '5.º EP',
      classLabel: 'Clase B',
      contacts: TUTORS,
    },
  ],
  'f-hijo-sin-nombre': [
    {
      id: 'reg-nico-card',
      eventId: 'pev-sinc',
      signedOn: -2,
      status: { label: 'Pendiente de confirmar', tone: 'warn' },
      cancelled: false,
      answers: [],
      specialNeeds: '1',
      specialNeedsDescription: 'Lleva gafas y necesita sentarse delante.',
      payment: {
        state: 'pending',
        amount: 20,
        method: 'card',
        methodLabel: 'Tarjeta',
        date: null,
        paymentId: 'pay-pend-1',
      },
      amount: 20,
      participation: null,
      attendancePercent: null,
      attendees: 2,
      schoolLevel: '2.º ESO',
      classLabel: 'Clase A',
      contacts: TUTORS,
    },
    {
      id: 'reg-nico-convi',
      eventId: 'pev-convi',
      signedOn: -3,
      status: ok,
      cancelled: false,
      answers: [1, 2],
      specialNeeds: '0',
      specialNeedsDescription: null,
      payment: {
        state: 'pending',
        amount: 45,
        method: 'card',
        methodLabel: 'Tarjeta',
        date: null,
        paymentId: 'pay-pend-2',
      },
      amount: 45,
      participation: null,
      attendancePercent: null,
      attendees: 1,
      schoolLevel: '2.º ESO',
      classLabel: 'Clase A',
      contacts: TUTORS,
    },
    {
      id: 'reg-nico-dd',
      eventId: 'pev-no-abre',
      signedOn: -1,
      status: ok,
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: {
        state: 'direct_debit',
        amount: 60,
        method: 'direct_debit',
        methodLabel: 'Domiciliación',
        date: '@14',
        paymentId: 'pay-dd-60',
      },
      amount: 60,
      participation: null,
      attendancePercent: null,
      attendees: 1,
      schoolLevel: '2.º ESO',
      classLabel: null,
      contacts: [],
    },
    {
      id: 'reg-nico-devuelto',
      eventId: 'pev-cerrada',
      signedOn: -15,
      status: ok,
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: {
        state: 'returned',
        amount: 110,
        method: 'direct_debit',
        methodLabel: 'Domiciliación',
        date: null,
        paymentId: 'pay-ret-1',
      },
      amount: 110,
      participation: null,
      attendancePercent: null,
      attendees: 1,
      schoolLevel: '2.º ESO',
      classLabel: null,
      contacts: [],
    },
    {
      id: 'reg-nico-transfer',
      eventId: 'pev-acaba-hoy',
      signedOn: -12,
      status: ok,
      cancelled: false,
      answers: [],
      specialNeeds: null,
      specialNeedsDescription: null,
      payment: {
        state: 'pending',
        amount: 35,
        method: 'transfer',
        methodLabel: 'Transferencia',
        date: null,
        paymentId: 'pay-tr-1',
      },
      amount: 35,
      participation: null,
      attendancePercent: null,
      attendees: 1,
      schoolLevel: '2.º ESO',
      classLabel: null,
      contacts: [],
    },
  ],
};

const registry = new WeakMap<FakeData, Map<string, FakeRegistration[]>>();

/** Las inscripciones de un perfil (las sembradas, más las que se vayan haciendo). */
export function registrationsOf(
  data: FakeData,
  pid: string,
): FakeRegistration[] {
  let m = registry.get(data);
  if (!m) {
    m = new Map();
    registry.set(data, m);
  }
  let list = m.get(pid);
  if (!list) {
    list = (SEED[pid] ?? []).map((r) => ({
      ...r,
      payment: { ...r.payment },
      contacts: [...r.contacts],
    }));
    m.set(pid, list);
  }
  return list;
}

/** La inscripción NO cancelada de un perfil en un evento, si la tiene. */
export const activeRegistration = (
  data: FakeData,
  pid: string,
  eventId: string,
) =>
  registrationsOf(data, pid).find((r) => r.eventId === eventId && !r.cancelled);

/** El estado del pago: las fechas sembradas como `@-30` se resuelven con «hoy». */
export function resolvePayment(
  p: PaymentState,
  addDays: (n: number) => string,
): PaymentState {
  return p.date?.startsWith('@')
    ? { ...p, date: addDays(Number(p.date.slice(1))) }
    : p;
}
