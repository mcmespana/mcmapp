// utils/comunica/payments.ts
//
// «Pagos» (plan 15), lógica pura: los bloques y su orden, qué chip y qué líneas lleva cada tarjeta, los textos de la ficha, los céntimos ↔ «35,00 €» y
// leer el importe que se escribe en «Pagar otra cantidad». Nada de React. La palabra «compromiso» no aparece nunca.
//
//   · Bloques (`inc/stic-payments.php` 418-485): «Pendiente de pagar» = devuelto o pagable; «Se cobrará por domiciliación»; «Pagado»; «Otros». Lo que viene,
//     por fecha ascendente; lo pagado, lo último arriba. Un bloque vacío no sale.
//   · El chip solo dice lo que el bloque no dice: un devuelto («Rechazado», en rojo) o «Comprobando el pago». El color sale de la CLAVE, nunca del texto.

import type { Payment, PaymentDetail } from '@/services/comunica/contract';
import { fullDay } from './dates';
import { euro } from './paymentLine';

// ── Céntimos y euros ────────────────────────────────────────────────────────

/** 3500 → «35,00 €». */
export const centsToEuro = (cents: number): string => euro(cents / 100);

/** Para el lector de pantalla: 3500 → «35 euros»; 3550 → «35 euros con 50 céntimos». */
export function amountSpoken(cents: number): string {
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  const euros = `${e} ${e === 1 ? 'euro' : 'euros'}`;
  return c === 0
    ? euros
    : `${euros} con ${c} ${c === 1 ? 'céntimo' : 'céntimos'}`;
}

export const AMOUNT_ERRORS = {
  generic: 'Escribe solo el importe, como 35 o 35,50',
  ambiguous: 'Escribe el importe con coma para los céntimos: 1234 o 1234,00',
  min: 'El importe mínimo es 1,00 €',
} as const;
export const MIN_CENTS = 100;

export type ParsedAmount =
  { ok: true; cents: number } | { ok: false; message: string };

/**
 * Lo que se escribe en «Pagar otra cantidad», SIN sorpresas (✅ `tope-importe`: sin tope; el aviso del «35 mal escrito» es `needsDoubleCheck`):
 *   «35», «35,5», «35,50», «35.50» → céntimos; «1.234,56» y «1,234.56» → 123456.
 *   «1.234» (punto y tres cifras, sin otra marca) se rechaza: puede ser mil doscientos o uno con veintitrés.
 *   Más de dos decimales, letras o vacío: «Escribe solo el importe…». Mínimo 1 €.
 */
export function parseEuroAmount(raw: string): ParsedAmount {
  const s = raw.trim().replace(/\s+/g, '');
  const bad = { ok: false as const, message: AMOUNT_ERRORS.generic };
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return bad;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let int: string;
  let dec = '';
  if (dots > 0 && commas > 0) {
    // El último separador es el decimal; el otro, de miles (de tres en tres).
    const decimalIsComma = s.lastIndexOf(',') > s.lastIndexOf('.');
    const dsep = decimalIsComma ? ',' : '.';
    const tsep = decimalIsComma ? '.' : ',';
    if ((s.match(new RegExp(`\\${dsep}`, 'g')) ?? []).length !== 1) return bad;
    const [head, tail] = s.split(dsep);
    if (!new RegExp(`^\\d{1,3}(\\${tsep}\\d{3})+$`).test(head)) return bad;
    int = head.split(tsep).join('');
    dec = tail;
  } else if (dots > 0 || commas > 0) {
    const sep = dots > 0 ? '.' : ',';
    if (dots + commas > 1) return bad;
    const [head, tail] = s.split(sep);
    if (sep === '.' && /^\d{1,3}$/.test(head) && /^\d{3}$/.test(tail))
      return { ok: false, message: AMOUNT_ERRORS.ambiguous };
    if (head === '' || tail === '' || tail.length > 2) return bad;
    int = head;
    dec = tail;
  } else {
    int = s;
  }
  if (!/^\d+$/.test(int) || (dec !== '' && !/^\d{1,2}$/.test(dec))) return bad;
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents)) return bad;
  if (cents < MIN_CENTS) return { ok: false, message: AMOUNT_ERRORS.min };
  return { ok: true, cents };
}

/** ¿Es más del doble de lo indicado? Antes de abrir la pasarela se pregunta (no es un tope: es el aviso del «35 mal escrito»). */
export const needsDoubleCheck = (cents: number, indicated: number) =>
  cents > indicated * 2;

export const doubleCheckText = (cents: number, indicated: number) =>
  `Vas a pagar ${centsToEuro(cents)}, más de lo indicado (${centsToEuro(indicated)}). ¿Es correcto?`;

/** ¿Cambió el importe respecto al indicado? */
export const amountChanged = (cents: number, indicated: number) =>
  cents !== indicated;

// ── Bloques ─────────────────────────────────────────────────────────────────

export type BlockKey = 'pending' | 'scheduled' | 'paid' | 'other';
export interface PaymentBlock {
  key: BlockKey;
  title: string;
  payments: Payment[];
}

export const BLOCK_TITLES: Record<BlockKey, string> = {
  pending: 'Pendiente de pagar',
  scheduled: 'Se cobrará por domiciliación',
  paid: 'Pagado',
  other: 'Otros',
};

const asc = (a: Payment, b: Payment) =>
  a.date === b.date ? 0 : !a.date ? 1 : !b.date ? -1 : a.date < b.date ? -1 : 1;
const desc = (a: Payment, b: Payment) =>
  a.date === b.date ? 0 : !a.date ? 1 : !b.date ? -1 : a.date > b.date ? -1 : 1;

export function paymentBlocks(payments: readonly Payment[]): PaymentBlock[] {
  const by = (f: (p: Payment) => boolean) => payments.filter(f);
  const blocks: PaymentBlock[] = [
    {
      key: 'pending',
      title: BLOCK_TITLES.pending,
      payments: by((p) => p.status === 'pending' || p.status === 'failed').sort(
        asc,
      ),
    },
    {
      key: 'scheduled',
      title: BLOCK_TITLES.scheduled,
      payments: by((p) => p.status === 'scheduled').sort(asc),
    },
    {
      key: 'paid',
      title: BLOCK_TITLES.paid,
      payments: by((p) => p.status === 'paid').sort(desc),
    },
    {
      key: 'other',
      title: BLOCK_TITLES.other,
      payments: by((p) => p.status === 'other').sort(asc),
    },
  ];
  return blocks.filter((b) => b.payments.length > 0);
}

// ── Chip y líneas de la tarjeta ─────────────────────────────────────────────

export interface PaymentChip {
  label: string;
  tone: 'negative' | 'neutral';
}

/** El chip solo cuando dice algo que el bloque no dice. Un devuelto, en rojo con la etiqueta del CRM; «Comprobando el pago» mientras el banco confirma. */
export function paymentChip(p: Payment): PaymentChip | null {
  if (p.confirmingSince)
    return { label: 'Comprobando el pago', tone: 'neutral' };
  if (p.status === 'failed')
    return { label: p.statusLabel || 'No se pudo cobrar', tone: 'negative' };
  return null;
}

/** Las líneas de debajo del concepto: el medio (no si es tarjeta pendiente) y «Para Lucía». */
export function paymentLines(p: Payment): string[] {
  const lines: string[] = [];
  if (p.forName) lines.push(`Para ${p.forName}`);
  const hideMethod =
    p.method === 'card' && (p.status === 'pending' || p.status === 'failed');
  if (!hideMethod && p.methodLabel) lines.push(p.methodLabel);
  return lines;
}

/** ¿Se ofrece «Pagar con tarjeta»? Nunca mientras el banco confirma (no se paga dos veces). */
export const canPay = (p: Pick<Payment, 'canPayByCard' | 'confirmingSince'>) =>
  p.canPayByCard && !p.confirmingSince;

// ── La ficha ────────────────────────────────────────────────────────────────

export const MANUAL_METHOD_NOTE =
  '¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.';
export const CONFIRMING_NOTE =
  'Estamos esperando la confirmación del banco. En unos minutos lo verás como pagado.';

/** ¿Pendiente por transferencia, Bizum o efectivo? (el «¿Ya lo has pagado?» sale también en la ficha del pago). */
export const isManualPending = (p: Pick<Payment, 'status' | 'method'>) =>
  p.status === 'pending' &&
  (p.method === 'transfer' || p.method === 'bizum' || p.method === 'cash');

/** El aviso de un devuelto: el motivo y la fecha y qué se puede hacer. `null` si no es un devuelto. */
export function rejectionNote(d: PaymentDetail): string | null {
  if (d.status !== 'failed') return null;
  const reason = d.rejection?.reason
    ? `Este recibo no se pudo cobrar: ${d.rejection.reason}.`
    : 'Este recibo no se pudo cobrar.';
  const when = d.rejection?.date
    ? ` Ocurrió el ${fullDay(d.rejection.date)}.`
    : '';
  const next = canPay(d)
    ? ' Puedes pagarlo con tarjeta o hablar con tu delegación.'
    : ' Ponte en contacto con tu delegación para volver a intentarlo.';
  return `${reason}${when}${next}`;
}

export interface DetailFact {
  label: string;
  value: string;
}

/** Los datos de la ficha, en el orden del plugin: Tipo (no «Servicios»), Cuenta, Concepto (si no es el título), Descripción, Para y, la última, la referencia. */
export function detailFacts(d: PaymentDetail): DetailFact[] {
  const out: DetailFact[] = [];
  if (d.typeLabel && d.typeLabel.toLowerCase() !== 'servicios')
    out.push({ label: 'Tipo', value: d.typeLabel });
  if (d.accountMasked) out.push({ label: 'Cuenta', value: d.accountMasked });
  if (d.bankingConcept && d.bankingConcept !== d.title)
    out.push({ label: 'Concepto', value: d.bankingConcept });
  if (d.inKindDescription)
    out.push({ label: 'Descripción', value: d.inKindDescription });
  if (d.forName) out.push({ label: 'Para', value: d.forName });
  if (d.transactionCode)
    out.push({
      label: d.method === 'card' ? 'Nº de operación' : 'Referencia',
      value: d.transactionCode,
    });
  return out;
}

export const PAYMENTS_TEXT = {
  title: 'Pagos',
  emptyOwn: 'No tienes ningún pago',
  emptyOf: (child: string) => `${child} no tiene ningún pago`,
  emptyBody:
    'Cuando te apuntes a algo que cueste dinero, aquí verás lo que tienes pendiente, lo que se cobrará y lo pagado.',
  needsConnection: 'Necesitas conexión para ver tus pagos',
  paidNote:
    'Pago hecho. Si aún lo ves pendiente, el banco está terminando de confirmarlo.',
  errorNote:
    'No hemos podido completar el pago. No se ha realizado ningún cargo.',
  unavailable: 'Este pago ya no está disponible',
  unavailableBody: 'Consulta el resto de tus pagos.',
  seeAll: 'Ver mis pagos',
} as const;
