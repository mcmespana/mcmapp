// utils/comunica/paymentLine.ts
//
// El pago de una inscripción en UNA línea (plan 14, `sticpa_payment_state_ui`), y cuándo se ofrece pagar. PURO. Nunca se dice «compromiso» (plan 041 D-6).
//
//   pagado       «110,00 € · Pagado · Tarjeta · 2 de octubre de 2026» (+ «Ver el pago»)
//   domiciliado  «60,00 € · Se cobra por domiciliación el 16 de octubre de 2026»
//   devuelto     «110,00 € · No se pudo cobrar» + aviso rojo
//   pendiente    «35,00 € · Pendiente de pagar · Transferencia» (sin medio si es tarjeta o no hay compromiso)
//                con transferencia, Bizum o efectivo: «¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.»
//                recién vuelto del pago: «Estamos esperando la confirmación del banco. En unos minutos lo verás como pagado.»

import type {
  PaymentState,
  RegistrationDetail,
} from '@/services/comunica/contract';
import { fullDay } from './dates';

/** «110,00 €» y «1.250,00 €»: coma decimal, siempre dos decimales (los importes sin «.00» solo son del CRM). */
export function euro(n: number): string {
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`;
}

export interface PaymentLine {
  text: string;
  /** Con «Ver el pago» (`pagos/[id]`, plan 15). */
  viewPaymentId: string | null;
  notice: { tone: 'info' | 'danger'; text: string } | null;
}

export function paymentLine(
  p: PaymentState,
  opts: { waiting?: boolean } = {},
): PaymentLine | null {
  if (p.state === 'none') return null;
  const amount = p.amount != null && p.amount > 0 ? euro(p.amount) : null;
  const join = (...parts: (string | null)[]) =>
    parts.filter(Boolean).join(' · ');
  switch (p.state) {
    case 'paid':
      return {
        text: join(
          amount,
          'Pagado',
          p.methodLabel,
          p.date ? fullDay(p.date) : null,
        ),
        viewPaymentId: p.paymentId,
        notice: null,
      };
    case 'direct_debit':
      return {
        text: join(
          amount,
          p.date
            ? `Se cobra por domiciliación el ${fullDay(p.date)}`
            : 'Se cobra por domiciliación',
        ),
        viewPaymentId: null,
        notice: null,
      };
    case 'returned':
      return {
        text: join(amount, 'No se pudo cobrar'),
        viewPaymentId: null,
        notice: {
          tone: 'danger',
          text: 'Este pago no se pudo cobrar. Puedes pagarlo con tarjeta o hablar con tu delegación.',
        },
      };
    default: {
      // pending y no_commitment: sin medio si es tarjeta o no hay compromiso.
      const method =
        p.state === 'pending' && p.method !== 'card' ? p.methodLabel : null;
      const manual =
        p.state === 'pending' &&
        (p.method === 'transfer' ||
          p.method === 'bizum' ||
          p.method === 'cash');
      return {
        text: join(amount, 'Pendiente de pagar', method),
        viewPaymentId: null,
        notice: opts.waiting
          ? {
              tone: 'info',
              text: 'Estamos esperando la confirmación del banco. En unos minutos lo verás como pagado.',
            }
          : manual
            ? {
                tone: 'info',
                text: '¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.',
              }
            : null,
      };
    }
  }
}

export interface PayAction {
  label: string;
  /** El pago pendiente que se paga; `null` = por la inscripción (sin compromiso). */
  paymentId: string | null;
}

/**
 * «Pagar 35,00 € con tarjeta» es la acción principal si el estado no es `danger` y (hay pago pendiente o devuelto con `paymentId`, o no hay compromiso y
 * no ha pasado) y no se está esperando al banco. Si no, no se ofrece (la principal es «Ver la actividad»).
 */
export function payAction(
  d: Pick<RegistrationDetail, 'status' | 'payment' | 'amount'>,
  opts: { waiting?: boolean; past?: boolean },
): PayAction | null {
  if (d.status.tone === 'danger' || opts.waiting) return null;
  const p = d.payment;
  const amount = p.amount ?? d.amount;
  if (amount == null || amount <= 0) return null;
  const payable =
    ((p.state === 'pending' || p.state === 'returned') && !!p.paymentId) ||
    (p.state === 'no_commitment' && !opts.past);
  if (!payable) return null;
  return {
    label: `Pagar ${euro(amount)} con tarjeta`,
    paymentId: p.paymentId,
  };
}
