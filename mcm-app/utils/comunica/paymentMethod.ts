// utils/comunica/paymentMethod.ts
//
// «Forma de pago» (05/11/2026; `single_stic_forma_pago` del plugin), lógica y textos puros. Nada de React. Los textos son LOS DEL PLUGIN, palabra por palabra
// (`comunicaAreaPrivada:pages/single_stic_forma_pago.php`); lo que cambia es el «cómo» (en la app, una hoja de radio y un botón pegado abajo).
//
//   · La forma de pago es de QUIEN PAGA, no de la persona que se mira: un menor no tiene una propia. La pantalla pinta lo que dice el servidor.
//   · El IBAN llega TAPADO (`ibanMasked`) y el campo empieza VACÍO: vacío al guardar = se queda el que había. IBAN y titular solo con domiciliación.
//   · El IBAN se comprueba aquí (módulo 97 y país SEPA) para no ir y volver con uno que se sabe mal; el servidor vuelve a comprobarlo y es el que manda.
//   · NUNCA se escribe un IBAN en un log, una caché ni una cola: solo vive en el estado del formulario.

import type {
  PaymentMethodInfo,
  PaymentMethodKind,
  PaymentMethodSaved,
  PaymentMethodWrite,
} from '@/services/comunica/contract';
import { isSepaIban, normalizeIban } from './iban';

export const PAYMENT_METHOD_COPY = {
  title: 'Forma de pago',
  /** Sin ningún menor visto. */
  contextOwn:
    'Con ella se cobran tus cuotas y las actividades a las que te apuntes.',
  /** Con un menor visto: es la de quien ha entrado, no la del menor (el «tu» va en negrita). */
  contextFor: (name: string) => ({
    before: 'Es ',
    strong: 'tu',
    after: ` forma de pago, no la de ${name}: con ella se cobran las actividades de ${name}.`,
  }),
  none: 'Todavía no has indicado cómo pagas.',
  question: '¿Cómo quieres pagar?',
  iban: 'IBAN',
  ibanPlaceholder: 'ES00 0000 0000 0000 0000 0000',
  ibanHintSaved: 'Déjalo vacío si no quieres cambiar la cuenta.',
  ibanHintNew: 'La cuenta en la que se cargarán los recibos.',
  holder: 'Titular de la cuenta',
  effect:
    'Si tienes recibos domiciliados que todavía no han pasado al banco, se cambiarán a la cuenta nueva. Lo que ya se ha cobrado, o está en una remesa, no se toca.',
  save: 'Guardar',
  saving: 'Guardando…',
  offlineSave:
    'Sin conexión: tus cambios siguen aquí. Guárdalos al volver la cobertura.',
  needsConnection: 'Necesitas conexión para ver tu forma de pago',
  needsConnectionBody: 'Por seguridad, no se guarda en el móvil.',
  /** La ficha no se puede leer: ni formulario ni «todavía no has indicado cómo pagas» (no se sabe). */
  unreadable:
    'No hemos podido leer tu forma de pago ahora mismo. Vuelve a intentarlo en un momento.',
  retry: 'Reintentar',
  forbidden: {
    title: 'No tienes acceso a esto',
    subtitle: 'Esta forma de pago no es de una persona a la que puedas ver.',
    action: 'Volver',
  },
  leave: {
    title: '¿Salir sin guardar?',
    message: 'Has cambiado tu forma de pago y todavía no la has guardado.',
    action: 'Salir sin guardar',
  },
  /** El botón de Pagos. */
  change: 'Cambiar forma de pago',
  /** La fila de «Datos de Lucía» y de «Tu perfil». */
  row: {
    title: 'Forma de pago',
    change: 'Cambiar',
    set: 'Indicarla',
    /** La entrada de «Tu perfil» (`sticpa_section_meta`). */
    description: 'Cómo pagas: domiciliación, transferencia o Bizum, y tu IBAN.',
  },
} as const;

export const PAYMENT_METHOD_ERRORS = {
  kind: 'Elige cómo quieres pagar.',
  iban: 'Ese IBAN no parece válido. Revisa que lo hayas copiado entero.',
  holder: 'Escribe el nombre del titular de la cuenta.',
  generic: 'No hemos podido guardarlo. Inténtalo de nuevo en un momento.',
  /** Guardada la ficha, pero algún pago pendiente no se pudo cambiar. */
  partial:
    'Tu forma de pago está guardada, pero no hemos podido cambiar la cuenta en algún pago pendiente. Avisa a tesorería de tu delegación para que lo revise.',
} as const;

export type PaymentMethodField = 'kind' | 'iban' | 'holder';
export type PaymentMethodErrors = Partial<Record<PaymentMethodField, string>>;

/** Qué campo señala cada motivo de `validation` del servidor. */
export const FIELD_OF_REASON: Record<string, PaymentMethodField> = {
  invalid_kind: 'kind',
  invalid_iban: 'iban',
  invalid_holder: 'holder',
};

export const isDirectDebit = (kind: PaymentMethodKind | null) =>
  kind === 'domiciliacion';

// ── Lo que se enseña de lo guardado ─────────────────────────────────────────

/**
 * La forma de pago en una línea: «Domiciliación bancaria · ES93 •••• 8644 · titular: Marta Pérez». La cuenta y el titular, solo con domiciliación y si
 * existen. `''` si no hay nada guardado (o es una clave que ya no se ofrece).
 */
export function paymentMethodSummary(info: PaymentMethodInfo): string {
  const current = info.options.find((o) => o.kind === info.kind);
  if (!current) return '';
  const parts: string[] = [current.label];
  if (isDirectDebit(info.kind) && info.ibanMasked) {
    parts.push(info.ibanMasked);
    if (info.holder) parts.push(`titular: ${info.holder}`);
  }
  return parts.join(' · ');
}

/** «Ahora mismo: …» o «Todavía no has indicado cómo pagas.» */
export function currentLine(info: PaymentMethodInfo): string {
  const summary = paymentMethodSummary(info);
  return summary ? `Ahora mismo: ${summary}.` : PAYMENT_METHOD_COPY.none;
}

/**
 * La fila de «Datos de Lucía»: «Forma de pago: la tuya, …» con «Cambiar», o «todavía no has indicado la tuya» con «Indicarla». Solo con la ficha LEÍDA: si no
 * se pudo leer, la fila no sale (no se inventa «todavía no has indicado la tuya»).
 */
export function memberRow(info: PaymentMethodInfo): {
  subtitle: string;
  action: string;
} {
  const summary = paymentMethodSummary(info);
  return summary
    ? {
        subtitle: `La tuya, ${summary}.`,
        action: PAYMENT_METHOD_COPY.row.change,
      }
    : {
        subtitle: 'Todavía no has indicado la tuya.',
        action: PAYMENT_METHOD_COPY.row.set,
      };
}

// ── El formulario ───────────────────────────────────────────────────────────

export interface PaymentMethodForm {
  kind: PaymentMethodKind | null;
  /** Lo que se escribe; vacío = se queda la cuenta guardada. NUNCA se rellena con la guardada. */
  iban: string;
  /** El guardado, o el nombre de quien paga si no hay nada. */
  holder: string;
}

/** Lo que se pinta al abrir: la forma guardada, el IBAN VACÍO y el titular guardado (o el nombre de la persona). */
export function formFromInfo(
  info: PaymentMethodInfo,
  payerName: string,
): PaymentMethodForm {
  return {
    kind: info.kind,
    iban: '',
    holder: info.holder ?? payerName,
  };
}

/** ¿Hay algo escrito que no esté guardado? (decide el «¿Salir sin guardar?»). */
export function isDirty(
  info: PaymentMethodInfo,
  form: PaymentMethodForm,
  payerName: string,
): boolean {
  const base = formFromInfo(info, payerName);
  if (form.kind !== base.kind) return true;
  // Solo cuenta con domiciliación: con otro medio, lo escrito en el IBAN no viaja.
  if (!isDirectDebit(form.kind)) return false;
  return (
    normalizeIban(form.iban) !== '' || form.holder.trim() !== base.holder.trim()
  );
}

/**
 * Lo mismo que `sticpa_fp_validate`: forma elegida; con domiciliación, un IBAN válido (vacío = el guardado; si no hay ninguno, error) y un titular (vacío =
 * el guardado; si no hay ninguno, error). Con otro medio, ni IBAN ni titular se miran.
 */
export function paymentMethodErrors(
  info: PaymentMethodInfo,
  form: PaymentMethodForm,
): PaymentMethodErrors {
  const e: PaymentMethodErrors = {};
  if (!form.kind) {
    e.kind = PAYMENT_METHOD_ERRORS.kind;
    return e;
  }
  if (!isDirectDebit(form.kind)) return e;
  const written = normalizeIban(form.iban);
  if (written === '' ? !info.ibanMasked : !isSepaIban(written))
    e.iban = PAYMENT_METHOD_ERRORS.iban;
  if (form.holder.trim() === '' && !info.holder)
    e.holder = PAYMENT_METHOD_ERRORS.holder;
  return e;
}

/** El cuerpo del `PUT` (sin `clientId`: lo pone el hook): con otro medio, solo la forma (el IBAN y el titular guardados no se tocan). */
export function buildPaymentMethodWrite(
  form: PaymentMethodForm,
): Omit<PaymentMethodWrite, 'clientId'> {
  if (!form.kind) throw new Error('Falta la forma de pago');
  if (!isDirectDebit(form.kind)) return { kind: form.kind };
  const iban = normalizeIban(form.iban);
  const holder = form.holder.trim();
  return {
    kind: form.kind,
    ...(iban ? { iban } : {}),
    ...(holder ? { holder } : {}),
  };
}

// ── Lo que se dice al guardar ───────────────────────────────────────────────

/** El «Listo…» de guardado, con lo que ha pasado con lo pendiente de cobro (mismas frases que el plugin). */
export function savedMessage(r: PaymentMethodSaved): string {
  const parts = ['Listo: tu forma de pago está guardada.'];
  const n = r.updated.payments;
  if (n > 0)
    parts.push(
      n === 1
        ? 'Hemos puesto la cuenta nueva en 1 pago pendiente de cobro.'
        : `Hemos puesto la cuenta nueva en ${n} pagos pendientes de cobro.`,
    );
  if (r.updated.inProgress > 0)
    parts.push(
      'Hay un recibo que ya está en curso (en remesa o devuelto): ese no se cambia, y tesorería lo revisará con vosotros.',
    );
  if (r.flagged > 0)
    parts.push('Hemos avisado a tesorería de que ya no quieres domiciliar.');
  return parts.join(' ');
}
