// services/comunica/fake/profileRegistrations.ts
//
// «Inscripciones» en el servidor falso (plan 14, familias). Va aparte de `index.ts` y comparte con él el estado a través de `ctx`. Se porta como el servidor de
// verdad (`comunicaMiddleware:src/app/profile-registrations*.ts` y `profile-signup*.ts`):
//
//   · Todas las rutas empiezan por `allowedProfile` (plan 11). La persona inscrita es SIEMPRE `pid`.
//   · EL GUARD ES EL SERVIDOR: formulario avanzado → `conflict` `advanced_form`; ya apuntado (sin caché) → `conflict` `already_registered`; audiencia →
//     `forbidden` `audience`; plazo → `conflict` `window_closed`. Después se valida: respuestas (todas, número de opción desde 1, de ese evento) y pago
//     (con precio: medio obligatorio y de la lista; domiciliación con IBAN válido) → `validation` con `reason` `answers` o `payment`.
//   · Mismo `clientId` = misma inscripción. El IBAN NUNCA se guarda (ni en el estado del falso) ni vuelve en una respuesta.
//   · Modificar: solo respuestas y necesidades especiales; cancelar: estado «Cancelada» (no se borra). Los dos solo con derechos (no cancelada ni
//     rechazada, evento sin pasar, plazo abierto; cancelar además no siendo un curso: más de 31 días).
//   · Mandos: `noCardPayment` (el CRM no genera el pago: `cardPaymentId: null`), `paymentFails` (`payment: 'error'`) y `alreadyRegisteredElsewhere`
//     (otro dispositivo ya se apuntó: `conflict` al enviar).

import {
  AdvancedFormResult,
  RegistrationDetail,
  RegistrationsList,
  SignupForm,
  SignupResult,
  SignupWrite,
  RegistrationEdit,
  RegistrationCancel,
  WriteResult,
  type PaymentMethod,
  type RegistrationCard,
  type RouteName,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { EVENTS, eventIsFor, type FakeEvent } from './profileEvents';
import { allowedProfile } from './profiles';
import {
  activeRegistration,
  registrationsOf,
  resolvePayment,
  type FakeRegistration,
} from './registrations';
import { isValidIban } from '@/utils/comunica/iban';
import { windowState } from '@/utils/comunica/eventWindow';
import { addDays, daysBetween } from '@/utils/comunica/madrid';
import { isPast } from '@/utils/comunica/activityList';

export interface RegistrationsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  roles: () => readonly string[];
  today: () => string;
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
  controls: () => {
    profilesDown: boolean;
    newChildNext: boolean;
    noCardPayment: boolean;
    paymentFails: boolean;
    alreadyRegisteredElsewhere: boolean;
  };
}

export type ProfileRegistrationKeys =
  | 'getProfileRegistrations'
  | 'getProfileRegistration'
  | 'getSignupForm'
  | 'signUp'
  | 'updateRegistration'
  | 'cancelRegistration'
  | 'getAdvancedFormUrl';
type RegistrationsApi = Pick<ComunicaApi, ProfileRegistrationKeys>;

const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);
const conflict = (reason: string, message: string) =>
  new ComunicaApiError('conflict', message, 409, reason);
const notFound = () =>
  new ComunicaApiError('not_found', 'No existe', 404, 'registration_not_found');

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bizum: 'Bizum',
  transfer: 'Transferencia',
  transfer_received: 'Transferencia recibida',
  cash: 'Efectivo',
  direct_debit: 'Domiciliación',
  card: 'Tarjeta',
};

const SPECIAL_NEEDS = {
  label: 'Necesidades especiales',
  options: [
    { value: '0', label: 'No' },
    { value: '1', label: 'Sí' },
  ],
  yesValue: '1',
  descriptionLabel: 'Descripción de las necesidades',
};

const eventOf = (id: string): FakeEvent | undefined =>
  EVENTS.find((e) => e.id === id);

export function profileRegistrationsRoutes(
  ctx: RegistrationsCtx,
): RegistrationsApi {
  const day = (n: number) => addDays(ctx.today(), n);
  const eventDays = (e: FakeEvent) => ({
    start: e.start == null ? null : day(e.start),
    end: e.end == null ? null : day(e.end),
  });
  const windowOf = (e: FakeEvent) => ({
    opensOn: e.opens == null ? null : day(e.opens),
    closesOn: e.closes == null ? null : day(e.closes),
  });
  const counted = (n: number) => Math.round(n * 100) / 100;

  const cardOf = (r: FakeRegistration): RegistrationCard => {
    const e = eventOf(r.eventId);
    const d = e ? eventDays(e) : { start: null, end: null };
    return {
      id: r.id,
      title: e?.name ?? 'Actividad',
      eventId: e ? e.id : null,
      eventStart: d.start,
      eventEnd: d.end,
      signedOn: day(r.signedOn),
      schoolLevel: r.schoolLevel,
      classLabel: r.classLabel,
      status: r.cancelled ? { label: 'Cancelada', tone: 'danger' } : r.status,
      eventHidden: !!e?.hidden,
    };
  };

  /** Los derechos de modificar y cancelar (`sticpa_registration_manage_rights`). */
  const rights = (r: FakeRegistration, e: FakeEvent | undefined) => {
    const d = e ? eventDays(e) : { start: null, end: null };
    const win = e ? windowOf(e) : { opensOn: null, closesOn: null };
    const until = win.closesOn;
    const closedReason =
      'El plazo de inscripción ya ha terminado. Si necesitas cambiar algo o no puedes ir, habla con tu delegación.';
    if (r.cancelled || r.status.tone === 'danger')
      return { canEdit: false, canCancel: false, reason: null, until: null };
    if (isPast({ startDate: d.start, endDate: d.end }, ctx.today()))
      return { canEdit: false, canCancel: false, reason: null, until: null };
    if (e && windowState(win, ctx.today()) === 'closed')
      return { canEdit: false, canCancel: false, reason: closedReason, until };
    const course = !!(d.start && d.end && daysBetween(d.start, d.end) > 31);
    return {
      canEdit: true,
      canCancel: !course,
      reason: course
        ? 'Para darte de baja del curso, habla con tu delegación.'
        : null,
      until,
    };
  };

  const detailOf = (r: FakeRegistration) => {
    const e = eventOf(r.eventId);
    const manage = rights(r, e);
    const questions = e?.questions ?? [];
    return RegistrationDetail.parse({
      ...cardOf(r),
      generatedAt: ctx.nowIso(),
      amount: r.amount,
      participation: r.participation,
      attendancePercent: r.attendancePercent,
      attendees: r.attendees,
      answers: r.answers.map((n, i) => questions[i]?.options[n - 1] ?? ''),
      specialNeeds: r.specialNeeds,
      specialNeedsDescription: r.specialNeedsDescription,
      contacts: r.contacts,
      payment: resolvePayment(r.payment, day),
      manage,
      edit: manage.canEdit
        ? {
            questions: questions.map((q, i) => ({
              ...q,
              current: r.answers[i] ?? null,
            })),
            specialNeeds: SPECIAL_NEEDS,
          }
        : null,
    });
  };

  const own = (who: { id: string }, rid: string) => {
    const r = registrationsOf(ctx.data(), who.id).find((x) => x.id === rid);
    if (!r) throw notFound();
    return r;
  };

  /** Lo que se contesta: todas las preguntas, con el número de opción de ese evento. */
  const checkAnswers = (
    e: FakeEvent | undefined,
    answers: { n: number; option: number }[],
  ): number[] => {
    const questions = e?.questions ?? [];
    const out: number[] = [];
    for (const q of questions) {
      const a = answers.find((x) => x.n === q.n);
      if (!a || a.option < 1 || a.option > q.options.length)
        throw validation(
          'answers',
          'Contesta a todas las preguntas de la actividad.',
        );
      out.push(a.option);
    }
    return out;
  };

  return {
    async getProfileRegistrations(pid) {
      await ctx.gate('profileRegistrations');
      const who = allowedProfile(ctx as never, pid);
      return RegistrationsList.parse({
        generatedAt: ctx.nowIso(),
        items: registrationsOf(ctx.data(), who.id).map(cardOf),
      });
    },

    async getProfileRegistration(pid, rid) {
      await ctx.gate('profileRegistration');
      const who = allowedProfile(ctx as never, pid);
      return detailOf(own(who, rid));
    },

    async getSignupForm(pid, eventId) {
      await ctx.gate('profileSignupForm');
      const who = allowedProfile(ctx as never, pid);
      const e = eventOf(eventId);
      if (!e)
        throw new ComunicaApiError(
          'not_found',
          'No existe',
          404,
          'event_not_found',
        );
      const d = eventDays(e);
      const existing = activeRegistration(ctx.data(), who.id, e.id);
      const state = windowState(windowOf(e), ctx.today());
      let blocked: SignupForm['blocked'] = null;
      if (existing)
        blocked = { reason: 'already_registered', registrationId: existing.id };
      else if (!eventIsFor(ctx.roles(), who.id, who.self, e))
        blocked = {
          reason: 'audience',
          title: 'Esta actividad no es para ti',
          message: e.audience?.message ?? 'Esta actividad no es para ti.',
        };
      else if (state !== 'open')
        blocked = {
          reason: 'window',
          title: 'La inscripción no está abierta',
          message:
            state === 'before'
              ? `La inscripción se abre el ${windowOf(e).opensOn}.`
              : `El plazo de inscripción terminó el ${windowOf(e).closesOn}.`,
        };
      else if (e.advancedForm) blocked = { reason: 'advanced_form' };
      const price = e.price && e.price > 0 ? e.price : null;
      return SignupForm.parse({
        generatedAt: ctx.nowIso(),
        event: {
          id: e.id,
          name: e.name,
          startDate: d.start,
          endDate: d.end,
          description: e.description ?? null,
        },
        blocked,
        questions: e.questions ?? [],
        price,
        paymentMethods: price
          ? (e.methods ?? []).map((k) => ({ key: k, label: METHOD_LABELS[k] }))
          : [],
        specialNeeds: SPECIAL_NEEDS,
      });
    },

    async signUp(pid, body) {
      await ctx.gate('profileSignUp', true);
      const who = allowedProfile(ctx as never, pid);
      const parsed = SignupWrite.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      const w = parsed.data;
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) return SignupResult.parse(repeated);
      const e = eventOf(w.eventId);
      if (!e)
        throw new ComunicaApiError(
          'not_found',
          'No existe',
          404,
          'event_not_found',
        );
      // El guard, por su orden.
      if (e.advancedForm)
        throw conflict(
          'advanced_form',
          'Esta actividad tiene su propio formulario',
        );
      const existing = activeRegistration(ctx.data(), who.id, e.id);
      if (!existing && ctx.controls().alreadyRegisteredElsewhere) {
        // Otro dispositivo ya se apuntó: la inscripción existe cuando llega esta petición.
        registrationsOf(ctx.data(), who.id).push({
          id: `reg-${who.id}-${w.eventId}-otro`,
          eventId: e.id,
          signedOn: 0,
          status: { label: 'Confirmada', tone: 'ok' },
          cancelled: false,
          answers: [],
          specialNeeds: null,
          specialNeedsDescription: null,
          payment: {
            state: 'none',
            amount: null,
            method: null,
            methodLabel: null,
            date: null,
            paymentId: null,
          },
          amount: null,
          participation: null,
          attendancePercent: null,
          attendees: 1,
          schoolLevel: null,
          classLabel: null,
          contacts: [],
        });
      }
      if (existing || ctx.controls().alreadyRegisteredElsewhere)
        throw conflict(
          'already_registered',
          'Ya tiene una inscripción activa para esta actividad',
        );
      if (!eventIsFor(ctx.roles(), who.id, who.self, e))
        throw new ComunicaApiError(
          'forbidden',
          'Esta actividad no es para ti',
          403,
          'audience',
        );
      if (windowState(windowOf(e), ctx.today()) !== 'open')
        throw conflict('window_closed', 'La inscripción no está abierta');

      const answers = checkAnswers(e, w.answers);
      const price = e.price && e.price > 0 ? e.price : null;
      const methods = price ? (e.methods ?? []) : [];
      let method: PaymentMethod | null = null;
      if (methods.length > 0) {
        const m = w.payment?.method;
        if (!m || !(methods as string[]).includes(m))
          throw validation('payment', 'Elige cómo vas a pagar.');
        if (m === 'direct_debit' && !isValidIban(w.payment?.iban))
          throw validation('payment', 'El IBAN no parece válido.');
        method = m;
      }

      const id = `reg-${who.id}-${w.eventId}-${registrationsOf(ctx.data(), who.id).length}`;
      let payment: 'none' | 'noted' | 'error' = 'none';
      let cardPaymentId: string | null = null;
      let state: FakeRegistration['payment'] = {
        state: 'none',
        amount: null,
        method: null,
        methodLabel: null,
        date: null,
        paymentId: null,
      };
      if (method && price) {
        if (ctx.controls().paymentFails) payment = 'error';
        else {
          payment = 'noted';
          if (method === 'card' && !ctx.controls().noCardPayment)
            cardPaymentId = `pay-${id}`;
          // El IBAN NO se guarda: solo el medio.
          state = {
            state: method === 'direct_debit' ? 'direct_debit' : 'pending',
            amount: counted(price),
            method,
            methodLabel: METHOD_LABELS[method],
            date: method === 'direct_debit' ? '@14' : null,
            paymentId: cardPaymentId,
          };
        }
      }
      registrationsOf(ctx.data(), who.id).push({
        id,
        eventId: e.id,
        signedOn: 0,
        status: { label: 'Confirmada', tone: 'ok' },
        cancelled: false,
        answers,
        specialNeeds: w.specialNeeds ?? null,
        specialNeedsDescription:
          w.specialNeeds === SPECIAL_NEEDS.yesValue
            ? (w.specialNeedsDescription ?? null)
            : null,
        payment: state,
        amount: price,
        participation: null,
        attendancePercent: null,
        attendees: 1,
        schoolLevel: null,
        classLabel: null,
        contacts: [],
      });
      ctx.bumpWrites(1);
      const result = SignupResult.parse({
        clientId: w.clientId,
        status: 'applied',
        registrationId: id,
        payment,
        cardPaymentId,
      });
      ctx.seen.set(w.clientId, result);
      return result;
    },

    async updateRegistration(pid, rid, body) {
      await ctx.gate('updateRegistration', true);
      const who = allowedProfile(ctx as never, pid);
      const parsed = RegistrationEdit.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      const w = parsed.data;
      if (ctx.seen.has(w.clientId))
        return WriteResult.parse(ctx.seen.get(w.clientId));
      const r = own(who, rid);
      const e = eventOf(r.eventId);
      if (!rights(r, e).canEdit)
        throw conflict(
          'window_closed',
          'Esta inscripción ya no se puede cambiar',
        );
      r.answers = checkAnswers(e, w.answers);
      if (w.specialNeeds !== undefined) {
        r.specialNeeds = w.specialNeeds;
        r.specialNeedsDescription =
          w.specialNeeds === SPECIAL_NEEDS.yesValue
            ? (w.specialNeedsDescription ?? null)
            : null;
      }
      ctx.bumpWrites(1);
      const result = WriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
      });
      ctx.seen.set(w.clientId, result);
      return result;
    },

    async cancelRegistration(pid, rid, body) {
      await ctx.gate('cancelRegistration', true);
      const who = allowedProfile(ctx as never, pid);
      const parsed = RegistrationCancel.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      const w = parsed.data;
      if (ctx.seen.has(w.clientId))
        return WriteResult.parse(ctx.seen.get(w.clientId));
      const r = own(who, rid);
      if (!rights(r, eventOf(r.eventId)).canCancel)
        throw conflict(
          'window_closed',
          'Esta inscripción ya no se puede cancelar',
        );
      // No se borra: pasa a «cancelada» y no se toca ningún pago.
      r.cancelled = true;
      ctx.bumpWrites(1);
      const result = WriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
      });
      ctx.seen.set(w.clientId, result);
      return result;
    },

    async getAdvancedFormUrl(pid, eventId) {
      await ctx.gate('advancedForm', true);
      const who = allowedProfile(ctx as never, pid);
      const e = eventOf(eventId);
      if (!e?.advancedForm)
        throw conflict(
          'advanced_form',
          'Esta actividad no tiene formulario avanzado',
        );
      if (activeRegistration(ctx.data(), who.id, e.id))
        throw conflict(
          'already_registered',
          'Ya tiene una inscripción activa para esta actividad',
        );
      return AdvancedFormResult.parse({
        url: `https://crm.example.org/formulario/${encodeURIComponent(e.id)}?persona=${encodeURIComponent(who.id)}`,
      });
    },
  };
}
