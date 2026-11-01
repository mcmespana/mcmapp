// services/comunica/fake/profilePayments.ts
//
// «Pagos» y «pagar con tarjeta» en el servidor falso (plan 15, familias). Va aparte de `index.ts` y comparte con él el estado a través de `ctx`. Se porta como
// el servidor de verdad (`comunicaMiddleware:src/app/profile-payments.ts`, `card-*.ts`):
//
//   · Todas las rutas empiezan por `allowedProfile` (plan 11). El dinero es DE QUIEN PAGA: viéndose a sí mismo, todo lo que paga (con `forName`); viendo a un
//     hijo, solo lo de ese hijo. Un pago de otra familia → 403 (nunca 404).
//   · Importes en céntimos. El IBAN nunca sale entero: `accountMasked`, con 4 cifras como mucho.
//   · `card-checkout` SOLO lee: `payable: false` con `not_payable` (no pendiente, o ya se está confirmando), `missing_payer_data` (el pagador sin documento) o
//     `nothing_to_pay` (una inscripción sin nada que pagar).
//   · Los intentos devuelven `simulated: true` (SOLO el falso): la hoja pinta una pasarela de mentira y dice qué pasó con `check`. El estado lo decide SIEMPRE
//     el servidor: `ko` → `failed`; `ok` → `paid`, o `confirming` durante `cardConfirmsAfter` comprobaciones (el banco tarda); cerrar a medias → `started`.
//   · Pagar un pago lo deja pagado con tarjeta y un nº de operación; si venía de una inscripción, su pago también (plan 14).
//
// El estado vive POR datos (`WeakMap`): `reset()` del falso lo deja como al principio.

import {
  CardAttemptCheck,
  CardAttemptCreate,
  CardAttemptStatus,
  CardCheckout,
  PaymentDetail,
  PaymentsList,
  type PayMethod,
  type PayStatus,
  type RouteName,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { allowedProfile, FAKE_CHILDREN } from './profiles';
import { EVENTS } from './profileEvents';
import { registrationsOf } from './registrations';
import { addDays } from '@/utils/comunica/madrid';

export interface PaymentsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  today: () => string;
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
  controls: () => {
    profilesDown: boolean;
    newChildNext: boolean;
    cardConfirmsAfter: number;
  };
}

export type ProfilePaymentKeys =
  | 'getProfilePayments'
  | 'getProfilePayment'
  | 'getCardCheckout'
  | 'createCardAttempt'
  | 'checkCardAttempt';
type PaymentsApi = Pick<ComunicaApi, ProfilePaymentKeys>;

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const conflict = (reason: string, message: string) =>
  new ComunicaApiError('conflict', message, 409, reason);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

interface FakePayment {
  id: string;
  title: string;
  /** Días desde «hoy». */
  date: number | null;
  amountCents: number;
  status: PayStatus;
  statusLabel: string;
  method: PayMethod;
  methodLabel: string;
  /** A quién va (el hijo o uno mismo) y quién paga. */
  recipient: string;
  payer: string;
  typeLabel?: string;
  accountMasked?: string;
  bankingConcept?: string;
  inKindDescription?: string;
  transactionCode?: string;
  rejection?: { reason?: string; date?: number };
  registrationId?: string;
  confirmingSince?: string;
}

const MARTA = 'f-per-familia';
const LUCIA = 'f-hijo-lucia';
const NICO = 'f-hijo-sin-nombre';
const MASK = '••••  ••••  ••••  ••••  1332';

const pending = (
  p: Partial<FakePayment> &
    Pick<FakePayment, 'id' | 'title' | 'amountCents' | 'recipient' | 'payer'>,
): FakePayment => ({
  date: -2,
  status: 'pending',
  statusLabel: 'Pendiente de pago',
  method: 'transfer',
  methodLabel: 'Transferencia',
  ...p,
});

/** Lo que cada persona de prueba tiene en el CRM. */
const SEED: FakePayment[] = [
  // Familia de Marta (dos hijos): todos los bloques.
  pending({
    id: 'pay-transfer-110',
    title: 'Campamento de verano',
    amountCents: 11000,
    recipient: LUCIA,
    payer: MARTA,
    date: -5,
  }),
  pending({
    id: 'pay-bizum-25',
    title: 'Excursión de otoño',
    amountCents: 2500,
    recipient: LUCIA,
    payer: MARTA,
    method: 'bizum',
    methodLabel: 'Bizum',
    date: -4,
  }),
  pending({
    id: 'pay-especie',
    title: 'Material del campamento',
    amountCents: 1800,
    recipient: LUCIA,
    payer: MARTA,
    method: 'other',
    methodLabel: 'Especie',
    inKindDescription: 'Dos paquetes de folios y pegamento',
    date: -3,
  }),
  pending({
    id: 'pay-confirming',
    title: 'Salida a la montaña',
    amountCents: 3000,
    recipient: LUCIA,
    payer: MARTA,
    method: 'card',
    methodLabel: 'Tarjeta',
    date: -1,
    confirmingSince: '2026-11-01T09:55:00Z',
  }),
  pending({
    id: 'pay-fee-20',
    title: 'Cuota de actividades',
    amountCents: 2000,
    recipient: MARTA,
    payer: MARTA,
    date: -6,
  }),
  {
    id: 'pay-rejected',
    title: 'Comedor',
    date: -8,
    amountCents: 1500,
    status: 'failed',
    statusLabel: 'Rechazado',
    method: 'direct_debit',
    methodLabel: 'Domiciliación',
    recipient: LUCIA,
    payer: MARTA,
    accountMasked: MASK,
    rejection: { reason: 'Fondos insuficientes', date: -3 },
  },
  {
    id: 'pay-lucia-110',
    title: 'Campamento del año pasado',
    date: -30,
    amountCents: 11000,
    status: 'paid',
    statusLabel: 'Pagado',
    method: 'card',
    methodLabel: 'Tarjeta',
    recipient: LUCIA,
    payer: MARTA,
    transactionCode: '260930123456',
    registrationId: 'reg-lucia-pasada',
  },
  // Lo de Nico (ligado a sus inscripciones del plan 14).
  pending({
    id: 'pay-pend-1',
    title: 'Merienda de bienvenida',
    amountCents: 2000,
    recipient: NICO,
    payer: MARTA,
    method: 'card',
    methodLabel: 'Tarjeta',
    date: -2,
    registrationId: 'reg-nico-card',
  }),
  pending({
    id: 'pay-pend-2',
    title: 'Convivencia COM',
    amountCents: 4500,
    recipient: NICO,
    payer: MARTA,
    method: 'card',
    methodLabel: 'Tarjeta',
    date: -3,
    registrationId: 'reg-nico-convi',
  }),
  pending({
    id: 'pay-tr-1',
    title: 'Triduo de hoy',
    amountCents: 3500,
    recipient: NICO,
    payer: MARTA,
    date: -12,
    registrationId: 'reg-nico-transfer',
  }),
  {
    id: 'pay-ret-1',
    title: 'Jornada de puertas abiertas',
    date: -15,
    amountCents: 11000,
    status: 'failed',
    statusLabel: 'Devuelto',
    method: 'direct_debit',
    methodLabel: 'Domiciliación',
    recipient: NICO,
    payer: MARTA,
    accountMasked: MASK,
    registrationId: 'reg-nico-devuelto',
    rejection: { reason: 'Cuenta cerrada', date: -10 },
  },
  {
    id: 'pay-dd-60',
    title: 'Pascua joven',
    date: 14,
    amountCents: 6000,
    status: 'scheduled',
    statusLabel: 'En remesa',
    method: 'direct_debit',
    methodLabel: 'Domiciliación',
    recipient: NICO,
    payer: MARTA,
    accountMasked: MASK,
    registrationId: 'reg-nico-dd',
  },
  // Una familia con el pagador sin documento.
  pending({
    id: 'pay-carmen-1',
    title: 'Cuota de actividades',
    amountCents: 4000,
    recipient: 'f-per-familia-ninguno',
    payer: 'f-per-familia-ninguno',
    method: 'card',
    methodLabel: 'Tarjeta',
  }),
  // Un monitor que se paga lo suyo.
  pending({
    id: 'pay-mon-1',
    title: 'Congreso de Monitores',
    amountCents: 9000,
    recipient: 'f-per-monitora-madre',
    payer: 'f-per-monitora-madre',
    typeLabel: 'Congreso',
  }),
  // Un pago de OTRA familia (para el 403).
  pending({
    id: 'pay-other-1',
    title: 'Cuota de otra familia',
    amountCents: 5000,
    recipient: 'f-otra-persona',
    payer: 'f-otra-persona',
  }),
];

interface Attempt {
  id: string;
  pid: string;
  source: { payment: string } | { registration: string };
  amountCents: number;
  /** Cuántas comprobaciones llevan desde el «ok» del banco. */
  checksAfterOk: number;
  returned: 'ok' | 'ko' | 'closed' | null;
  state: 'started' | 'confirming' | 'paid' | 'failed' | 'abandoned';
  paymentId?: string;
  registrationId?: string;
}

interface State {
  payments: Map<string, FakePayment>;
  attempts: Map<string, Attempt>;
  tx: number;
}
const states = new WeakMap<FakeData, State>();

export function profilePaymentsRoutes(ctx: PaymentsCtx): PaymentsApi {
  const state = (): State => {
    const d = ctx.data();
    let s = states.get(d);
    if (!s) {
      s = {
        payments: new Map(SEED.map((p) => [p.id, { ...p }])),
        attempts: new Map(),
        tx: 0,
      };
      states.set(d, s);
    }
    return s;
  };
  const day = (n: number | null) =>
    n == null ? null : addDays(ctx.today(), n);
  const meId = () => ctx.data().personas[ctx.persona()].personId;
  const nameOf = (id: string): string | undefined => {
    const p = ctx.data().people.find((x) => x.id === id);
    if (p) return p.firstName;
    return (
      Object.values(FAKE_CHILDREN)
        .flat()
        .find((c) => c?.id === id)?.firstName ?? undefined
    );
  };
  /** ¿Es de este perfil visto por quien ha entrado? (pagador = yo; viendo a un hijo, destinatario = ese hijo). */
  const visibleTo = (p: FakePayment, who: { id: string; self: boolean }) =>
    p.payer === meId() && (who.self || p.recipient === who.id);
  const payable = (p: FakePayment) =>
    (p.status === 'pending' || p.status === 'failed') && !p.confirmingSince;

  const view = (p: FakePayment, who: { id: string; self: boolean }) => ({
    id: p.id,
    title: p.title,
    ...(who.self && p.recipient !== who.id && nameOf(p.recipient)
      ? { forName: nameOf(p.recipient) }
      : {}),
    date: day(p.date),
    amountCents: p.amountCents,
    status: p.status,
    statusLabel: p.statusLabel,
    method: p.method,
    methodLabel: p.methodLabel,
    canPayByCard: payable(p),
    ...(p.confirmingSince ? { confirmingSince: p.confirmingSince } : {}),
  });

  const own = (id: string, who: { id: string; self: boolean }): FakePayment => {
    const p = state().payments.get(id);
    // Lo de otra familia o de otro perfil: 403, nunca 404.
    if (!p || !visibleTo(p, who)) throw forbidden();
    return p;
  };

  /** `card-checkout`: SOLO lee. */
  const checkoutOf = (
    who: { id: string; self: boolean },
    source: { payment: string } | { registration: string },
  ) => {
    let p: FakePayment | undefined;
    let concept = '';
    let amountCents = 0;
    let returnTo: { registration: string } | 'payments' = 'payments';
    if ('payment' in source) {
      p = own(source.payment, who);
      concept = p.title;
      amountCents = p.amountCents;
      if (p.registrationId) returnTo = { registration: p.registrationId };
    } else {
      const reg = registrationsOf(ctx.data(), who.id).find(
        (r) => r.id === source.registration && !r.cancelled,
      );
      if (!reg) throw forbidden();
      const ev = EVENTS.find((e) => e.id === reg.eventId);
      returnTo = { registration: reg.id };
      if (reg.payment.paymentId) {
        p = state().payments.get(reg.payment.paymentId);
        if (p) {
          concept = p.title;
          amountCents = p.amountCents;
        }
      } else if (reg.payment.state === 'no_commitment' && reg.amount) {
        concept = ev?.name ?? 'Inscripción';
        amountCents = Math.round(reg.amount * 100);
      }
      if (!amountCents)
        return { payable: false as const, reason: 'nothing_to_pay' as const };
    }
    if (p && !payable(p))
      return { payable: false as const, reason: 'not_payable' as const };
    // Los datos del pagador, tal cual están en su ficha: el de «Carmen» no tiene documento.
    if (meId() === 'f-per-familia-ninguno')
      return { payable: false as const, reason: 'missing_payer_data' as const };
    const me = ctx.data().people.find((x) => x.id === meId());
    const forName = who.self ? undefined : nameOf(who.id);
    return {
      payable: true as const,
      concept,
      amountCents,
      payer: {
        name: me ? `${me.firstName} ${me.lastName}` : 'Quien paga',
        email: `${(me?.firstName ?? 'pagador').toLowerCase()}@ejemplo.org`,
      },
      ...(forName ? { forName } : {}),
      returnTo,
    };
  };

  /** Lo que pasa cuando el servidor da el pago por cobrado (con el cobro del CRM, nunca por la vuelta del banco). */
  const settle = (a: Attempt) => {
    const s = state();
    let p: FakePayment | undefined;
    if ('payment' in a.source) p = s.payments.get(a.source.payment);
    else {
      const reg = registrationsOf(ctx.data(), a.pid).find(
        (r) =>
          r.id === ('registration' in a.source ? a.source.registration : ''),
      );
      p = reg?.payment.paymentId
        ? s.payments.get(reg.payment.paymentId)
        : undefined;
      if (!p && reg) {
        // Una inscripción sin compromiso: nace el pago al cobrarse.
        const id = `pay-${reg.id}`;
        p = {
          id,
          title:
            EVENTS.find((e) => e.id === reg.eventId)?.name ?? 'Inscripción',
          date: 0,
          amountCents: a.amountCents,
          status: 'paid',
          statusLabel: 'Pagado',
          method: 'card',
          methodLabel: 'Tarjeta',
          recipient: a.pid,
          payer: meId(),
          registrationId: reg.id,
        };
        s.payments.set(id, p);
      }
    }
    if (!p) return;
    s.tx += 1;
    p.status = 'paid';
    p.statusLabel = 'Pagado';
    p.method = 'card';
    p.methodLabel = 'Tarjeta';
    p.amountCents = a.amountCents;
    p.transactionCode = `26110${String(s.tx).padStart(7, '0')}`;
    p.confirmingSince = undefined;
    p.date = 0;
    a.paymentId = p.id;
    if (p.registrationId) {
      a.registrationId = p.registrationId;
      const reg = registrationsOf(ctx.data(), p.recipient).find(
        (r) => r.id === p.registrationId,
      );
      if (reg)
        reg.payment = {
          state: 'paid',
          amount: a.amountCents / 100,
          method: 'card',
          methodLabel: 'Tarjeta',
          date: '@0',
          paymentId: p.id,
        };
    }
  };

  return {
    async getProfilePayments(pid) {
      await ctx.gate('profilePayments');
      const who = allowedProfile(ctx as never, pid);
      const list = [...state().payments.values()].filter((p) =>
        visibleTo(p, who),
      );
      return PaymentsList.parse({
        generatedAt: ctx.nowIso(),
        payments: list.map((p) => view(p, who)),
      });
    },

    async getProfilePayment(pid, id) {
      await ctx.gate('profilePayment');
      const who = allowedProfile(ctx as never, pid);
      const p = own(id, who);
      return PaymentDetail.parse({
        generatedAt: ctx.nowIso(),
        ...view(p, who),
        ...(p.typeLabel ? { typeLabel: p.typeLabel } : {}),
        ...(p.accountMasked ? { accountMasked: p.accountMasked } : {}),
        ...(p.bankingConcept ? { bankingConcept: p.bankingConcept } : {}),
        ...(p.inKindDescription
          ? { inKindDescription: p.inKindDescription }
          : {}),
        ...(p.transactionCode ? { transactionCode: p.transactionCode } : {}),
        ...(p.rejection
          ? {
              rejection: {
                ...(p.rejection.reason ? { reason: p.rejection.reason } : {}),
                ...(p.rejection.date != null
                  ? { date: day(p.rejection.date)! }
                  : {}),
              },
            }
          : {}),
        ...(p.registrationId ? { registrationId: p.registrationId } : {}),
      });
    },

    async getCardCheckout(pid, source) {
      await ctx.gate('cardCheckout');
      const who = allowedProfile(ctx as never, pid);
      return CardCheckout.parse({
        generatedAt: ctx.nowIso(),
        checkout: checkoutOf(who, source),
      });
    },

    async createCardAttempt(pid, body) {
      await ctx.gate('createCardAttempt', true);
      const who = allowedProfile(ctx as never, pid);
      const parsed = CardAttemptCreate.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      const w = parsed.data;
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) return repeated as { attemptId: string; simulated: true };
      const c = checkoutOf(who, w.source);
      if (!c.payable)
        throw conflict(c.reason, 'No se puede pagar esto con tarjeta');
      const id = `att-${state().attempts.size + 1}`;
      state().attempts.set(id, {
        id,
        pid: who.id,
        source: w.source,
        amountCents: w.amountCents,
        checksAfterOk: 0,
        returned: null,
        state: 'started',
      });
      ctx.bumpWrites(1);
      const result = { attemptId: id, simulated: true as const };
      ctx.seen.set(w.clientId, result);
      return result;
    },

    async checkCardAttempt(pid, id, body) {
      await ctx.gate('checkCardAttempt', true);
      const who = allowedProfile(ctx as never, pid);
      const parsed = CardAttemptCheck.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      const a = state().attempts.get(id);
      if (!a || a.pid !== who.id) throw forbidden();
      const ret = parsed.data.returned;
      if (ret && !a.returned) a.returned = ret;
      if (a.state !== 'paid' && a.state !== 'failed') {
        if (a.returned === 'ko') a.state = 'failed';
        else if (a.returned === 'ok') {
          // El estado sale del cobro, no de la vuelta del banco: el banco puede tardar.
          if (a.checksAfterOk >= ctx.controls().cardConfirmsAfter) {
            a.state = 'paid';
            settle(a);
          } else {
            a.state = 'confirming';
            const p =
              'payment' in a.source
                ? state().payments.get(a.source.payment)
                : undefined;
            if (p) p.confirmingSince = ctx.nowIso();
          }
          a.checksAfterOk += 1;
        }
      }
      return CardAttemptStatus.parse({
        attemptId: a.id,
        state: a.state,
        ...(a.state === 'paid' ? { paidCents: a.amountCents } : {}),
        ...(a.registrationId ? { registrationId: a.registrationId } : {}),
        ...(a.paymentId ? { paymentId: a.paymentId } : {}),
      });
    },
  };
}
