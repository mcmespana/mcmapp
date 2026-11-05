// services/comunica/fake/profilePaymentMethod.ts
//
// «Forma de pago» en el servidor falso (05/11/2026). Va aparte de `index.ts` y comparte con él el estado a través de `ctx`. Se porta como el servidor
// de verdad y el plugin (`comunicaAreaPrivada:inc/stic-forma-pago.php`, cuyos vectores de prueba repite `__tests__/comunica/paymentMethodFake.test.ts`):
//
//   · Todas las rutas empiezan por `allowedProfile` (plan 11): `pid` es quien ha entrado o uno de sus hijos; si no, 403. Pero la forma de pago es de QUIEN
//     PAGA: se lee y se escribe SIEMPRE la de quien ha entrado, nunca la de `pid` (un menor no tiene una propia). `forName` dice a quién se mira si no es uno
//     mismo (`null` para un hijo sin nombre).
//   · El IBAN nunca sale entero: `ibanMasked` («ES93 •••• 8644»; con ocho caracteres o menos, «••••»). Vacío u omitido al guardar = se conserva el que había.
//     El GET lleva `generatedAt` (`PaymentMethodRead`); `current` de lo guardado, no.
//   · Con domiciliación: IBAN válido (módulo 97) y de un país SEPA, y titular no vacío (vacío = el guardado); si no, `validation` con `invalid_iban` / `invalid_holder`. Con
//     transferencia o Bizum el IBAN y el titular guardados NO se borran. Una clave que no se ofrece, `invalid_kind`.
//   · SOLO se lleva la cuenta nueva a lo que no se ha cobrado, y SOLO cuando la persona ESCRIBIÓ un IBAN (`propagar`). Un compromiso se toca únicamente si es
//     una domiciliación vigente, con algún pago «No remesado» y NINGÚN otro pago en curso (lo pagado y lo anulado son historia). Cualquier otro estado
//     (remesado, impagado, vacío o desconocido) → se deja como está y se cuenta en `inProgress`. Un compromiso apagado a mano (`active = 0`) cuenta como terminado.
//     Todo o nada por compromiso: si no se escribe, sus pagos tampoco (`partial`); uno cuyos pagos no se pueden leer enteros no se toca y también es `partial`.
//     Solo se escribe lo que cambia (un compromiso o un pago que ya tiene esa cuenta no se reescribe). Las cuentas, siempre TAPADAS en las notas.
//   · Dejar la domiciliación NO cambia ninguna cuenta ni medio: se añade una nota a cada compromiso domiciliado vigente con algo sin remesar o en curso, una
//     sola vez por medio (`flagged`).
//   · Mismo `clientId` = mismo resultado, sin volver a escribir.
//
// Los compromisos y pagos de ejemplo (Marta) enseñan «solo lo no cobrado». El estado vive POR datos (`WeakMap`): `reset()` del falso lo deja como al principio.

import {
  PaymentMethodInfo,
  PaymentMethodKind,
  PaymentMethodRead,
  PaymentMethodSaved,
  PaymentMethodWrite,
  type RouteName,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { allowedProfile, FAKE_CHILDREN } from './profiles';
import { isSepaIban, maskIban } from '@/utils/comunica/iban';

export interface PaymentMethodCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  today: () => string;
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
  controls: () => { profilesDown: boolean; newChildNext: boolean };
}

export type PaymentMethodKeys =
  | 'getPaymentMethod'
  | 'savePaymentMethod'
  | 'paymentMethodState'
  | 'breakPaymentMethod';
type PaymentMethodApi = Pick<
  ComunicaApi,
  Exclude<PaymentMethodKeys, 'paymentMethodState' | 'breakPaymentMethod'>
>;

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

/** Lo que se ofrece, en este orden y con estas etiquetas fijas. */
export const PAYMENT_METHOD_OPTIONS: {
  kind: PaymentMethodKind;
  label: string;
}[] = [
  { kind: 'domiciliacion', label: 'Domiciliación bancaria' },
  { kind: 'transferencia', label: 'Transferencia' },
  { kind: 'bizum', label: 'Bizum' },
];
const labelOf = (kind: PaymentMethodKind) =>
  PAYMENT_METHOD_OPTIONS.find((o) => o.kind === kind)!.label;

// ── Qué compromisos se pueden tocar (la regla del propietario, 05/11/2026) ──

export type CommitmentState =
  | 'tocable'
  | 'sin_pendientes'
  | 'en_curso'
  | 'no_domiciliado'
  | 'terminado'
  /** No se pudieron leer todos sus pagos: no se toca y se avisa. */
  | 'ilegible';

export interface ClassifiedCommitment {
  state: CommitmentState;
  /** Los pagos «No remesado» que se pueden tocar. */
  pending: string[];
}

/** ¿Una fecha del CRM está vacía (o es el «cero» de MySQL)? */
const noDate = (d: string | null | undefined) => {
  const v = (d ?? '').trim();
  return v === '' || v.startsWith('0000');
};

/**
 * ¿Se le puede cambiar la cuenta a este compromiso? Pura. `pays`: `id`, `status` y `method` de cada pago suyo. `history`: los estados que son historia y
 * no cuentan como «en curso».
 */
export function classifyCommitment(
  c: { method: string; endDate?: string | null; active?: string | null },
  pays: readonly { id: string; status: string; method: string }[],
  today: string,
  history: readonly string[] = ['paid', 'cancelled'],
): ClassifiedCommitment {
  const out = (state: CommitmentState, pending: string[] = []) => ({
    state,
    pending,
  });
  if (c.method.trim().toLowerCase() !== 'direct_debit')
    return out('no_domiciliado');
  const end = (c.endDate ?? '').trim();
  if (!noDate(end) && end.slice(0, 10) <= today) return out('terminado');
  // Un compromiso con `active = 0` y sin fecha está apagado a mano: ante la duda, no se toca.
  if ((c.active ?? '').trim() === '0') return out('terminado');
  const pending: string[] = [];
  for (const p of pays) {
    const status = p.status.trim().toLowerCase();
    if (status === 'not_remitted') {
      // Un «No remesado» que no es una domiciliación (el recurrente por tarjeta también nace así) no es de este cambio; como no se sabe qué es, en curso.
      if (p.method.trim().toLowerCase() !== 'direct_debit')
        return out('en_curso');
      pending.push(p.id);
      continue;
    }
    if (history.map((h) => h.toLowerCase()).includes(status)) continue;
    // Remesado, impagado, a recobrar… o un estado que no conocemos: no se toca nada de este compromiso.
    return out('en_curso');
  }
  const ids = pending.filter((id) => id !== '');
  return ids.length ? out('tocable', ids) : out('sin_pendientes');
}

/** Añade una línea a la descripción, sin repetir la misma. */
export const appendNote = (description: string, note: string) =>
  description.includes(note)
    ? description
    : `${description}${description ? '\n' : ''}${note}`;

/** Las entidades que de verdad llegan en un nombre (`html_entity_decode` del plugin, sin traer una tabla entera). */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
};

/**
 * El nombre del titular, limpio (`sticpa_fp_clean_holder`): sin entidades, sin etiquetas bien formadas («<b>x</b>» → «x»), sin los `<` y `>` que queden sueltos,
 * sin espacios de más (tampoco los duros: `&nbsp;` no es un titular «lleno») y con un máximo de 255. «Marta <3 Pérez» pierde solo el signo, no el resto del nombre.
 */
export function cleanHolder(raw: string): string {
  const decoded = raw.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (m, dec, hex, name) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return ENTITIES[String(name).toLowerCase()] ?? m;
    },
  );
  return decoded
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/[\s\u00A0]+/g, ' ')
    .trim()
    .slice(0, 255);
}

/** «2026-11-05» → «05/11/2026». */
const ddmmyyyy = (day: string) => day.split('-').reverse().join('/');

// ── Los datos de ejemplo ────────────────────────────────────────────────────

// Dos IBAN españoles con los dígitos de control buenos (los de los vectores del plugin).
export const FAKE_IBAN_A = 'ES9300494898982516218644';
export const FAKE_IBAN_B = 'ES9121000418450200051332';

interface Stored {
  kind: PaymentMethodKind | null;
  /** Sin espacios. NUNCA sale entero. */
  iban: string;
  holder: string;
}

interface FakeCommitment {
  id: string;
  /** `direct_debit`, `transfer`, `card`… (la clave del CRM, que la app no ve). */
  method: string;
  endDate: string | null;
  /** `1` o `0` como lo da el CRM; `0` sin fecha de fin = apagado a mano. */
  active: string;
  bankAccount: string;
  description: string;
  paymentIds: string[];
}
interface FakePay {
  id: string;
  status: string;
  method: string;
  bankAccount: string;
}

/** Quien paga → su ficha. Sin entrada, «Todavía no has indicado cómo pagas». */
const STORED_SEED: Record<string, Stored> = {
  'f-per-familia': {
    kind: 'domiciliacion',
    iban: FAKE_IBAN_A,
    holder: 'Marta Villarroya Pons',
  },
  // Pasó a transferencia y su IBAN de antes no se borró.
  'f-per-monitora-madre': {
    kind: 'transferencia',
    iban: FAKE_IBAN_B,
    holder: 'Laura Gil',
  },
};

const commitment = (
  id: string,
  over: Partial<FakeCommitment>,
  pays: [string, string, string?][],
): { c: FakeCommitment; pays: FakePay[] } => ({
  c: {
    id,
    method: 'direct_debit',
    endDate: null,
    active: '1',
    bankAccount: FAKE_IBAN_A,
    description: '',
    paymentIds: pays.map(([pid]) => pid),
    ...over,
  },
  pays: pays.map(([pid, status, method]) => ({
    id: pid,
    status,
    method: method ?? 'direct_debit',
    bankAccount: over.bankAccount ?? FAKE_IBAN_A,
  })),
});

/** Lo que Marta paga: todos los casos de «solo lo no cobrado». */
const MARTA_COMMITMENTS = [
  // 1 pago hecho + 1 sin remesar → se toca.
  commitment('com-campamento', { description: 'Campamento de verano' }, [
    ['cp-camp-1', 'paid'],
    ['cp-camp-2', 'not_remitted'],
  ]),
  // Todo pagado → no se toca.
  commitment('com-cuota-pasada', {}, [
    ['cp-cuota-1', 'paid'],
    ['cp-cuota-2', 'paid'],
  ]),
  // Un recibo ya en remesa → se deja como está y se cuenta.
  commitment('com-pascua', {}, [
    ['cp-pascua-1', 'not_remitted'],
    ['cp-pascua-2', 'remitted'],
  ]),
  // No es una domiciliación → no se toca.
  commitment('com-transfer', { method: 'transfer_received', bankAccount: '' }, [
    ['cp-transfer-1', 'pending', 'transfer_received'],
  ]),
  // Terminado → no se toca.
  commitment('com-terminado', { endDate: '2026-01-31' }, [
    ['cp-term-1', 'not_remitted'],
  ]),
  // Dos sin remesar → se tocan los dos.
  commitment('com-mensual', {}, [
    ['cp-mens-1', 'not_remitted'],
    ['cp-mens-2', 'not_remitted'],
  ]),
  // Apagado a mano (sin fecha de fin) → no se toca.
  commitment('com-apagado', { active: '0' }, [['cp-apag-1', 'not_remitted']]),
];

interface State {
  stored: Map<string, Stored>;
  commitments: Map<string, FakeCommitment[]>;
  payments: Map<string, FakePay>;
  failCommitments: Set<string>;
  /** Compromisos de los que no se pueden leer todos los pagos. */
  unreadable: Set<string>;
  commitmentsDown: boolean;
}
const states = new WeakMap<FakeData, State>();

/** Lo que el falso enseña a los tests. */
export interface PaymentMethodLog {
  /** La ficha, los compromisos y los pagos de quien paga (el IBAN, entero: es el falso). */
  paymentMethodState(payerId: string): {
    stored: Readonly<Stored>;
    commitments: readonly {
      id: string;
      method: string;
      bankAccount: string;
      description: string;
      payments: readonly Readonly<FakePay>[];
    }[];
  };
  /** Hace fallar la escritura de estos compromisos, o que el CRM no conteste al leer los compromisos. */
  breakPaymentMethod(patch: {
    failCommitments?: string[];
    /** De estos compromisos no se pueden leer todos los pagos (el recorrido va a medias). */
    unreadable?: string[];
    /** Pone la cuenta de estos pagos (para que un pago vaya por detrás de su compromiso). */
    payAccounts?: Record<string, string>;
    commitmentsDown?: boolean;
  }): void;
}

export function paymentMethodRoutes(
  ctx: PaymentMethodCtx,
): PaymentMethodApi & PaymentMethodLog {
  const state = (): State => {
    const d = ctx.data();
    let s = states.get(d);
    if (!s) {
      s = {
        stored: new Map(
          Object.entries(STORED_SEED).map(([k, v]) => [k, { ...v }]),
        ),
        commitments: new Map(),
        payments: new Map(),
        failCommitments: new Set(),
        unreadable: new Set(),
        commitmentsDown: false,
      };
      s.commitments.set(
        'f-per-familia',
        MARTA_COMMITMENTS.map(({ c }) => ({ ...c })),
      );
      for (const { pays } of MARTA_COMMITMENTS)
        for (const p of pays) s.payments.set(p.id, { ...p });
      states.set(d, s);
    }
    return s;
  };
  /** Quien paga: SIEMPRE quien ha entrado, nunca el `pid`. */
  const meId = () => ctx.data().personas[ctx.persona()].personId;
  const storedOf = (payer: string): Stored => {
    const s = state();
    let st = s.stored.get(payer);
    if (!st) {
      st = { kind: null, iban: '', holder: '' };
      s.stored.set(payer, st);
    }
    return st;
  };
  const nameOf = (id: string): string | null => {
    const p = ctx.data().people.find((x) => x.id === id);
    if (p) return p.firstName;
    return (
      Object.values(FAKE_CHILDREN)
        .flat()
        .find((c) => c?.id === id)?.firstName ?? null
    );
  };
  const view = (st: Stored, who: { id: string; self: boolean }) =>
    PaymentMethodInfo.parse({
      kind: st.kind,
      options: PAYMENT_METHOD_OPTIONS,
      ibanMasked: st.iban ? maskIban(st.iban) : null,
      holder: st.holder || null,
      forName: who.self ? null : nameOf(who.id),
    });

  /** Los compromisos de quien paga, clasificados. `null` si «el CRM no contesta». */
  const scan = (payer: string) => {
    const s = state();
    if (s.commitmentsDown) return null;
    return (s.commitments.get(payer) ?? []).map((c) => {
      // Solo se piden los pagos si puede ser tocable: lo que no es una domiciliación vigente no necesita ni mirarse.
      let cls = classifyCommitment(c, [], ctx.today());
      if (cls.state === 'sin_pendientes') {
        cls = s.unreadable.has(c.id)
          ? { state: 'ilegible', pending: [] }
          : classifyCommitment(
              c,
              c.paymentIds.map((id) => s.payments.get(id)!),
              ctx.today(),
            );
      }
      return { c, class: cls };
    });
  };

  /** Lleva la cuenta nueva a lo que aún no se ha cobrado. Solo escribe lo que cambia. */
  const propagate = (payer: string, iban: string) => {
    const res = {
      commitments: 0,
      payments: 0,
      inProgress: 0,
      errors: 0,
      noAnswer: false,
    };
    const found = scan(payer);
    if (!found) return { ...res, noAnswer: true };
    const s = state();
    for (const { c, class: k } of found) {
      if (k.state === 'en_curso') {
        res.inProgress += 1;
        continue;
      }
      if (k.state === 'ilegible') {
        // No se pudo comprobar que no haya un recibo ya remesado: no se toca y se dice.
        res.errors += 1;
        continue;
      }
      if (k.state !== 'tocable') continue;
      if (c.bankAccount !== iban) {
        if (s.failCommitments.has(c.id)) {
          // Si el compromiso no se actualiza, sus pagos tampoco: o todo o nada.
          res.errors += 1;
          continue;
        }
        // Sin enseñar ninguna cuenta entera: ni la vieja ni la nueva.
        const note = `[Área privada ${ddmmyyyy(ctx.today())}] Cuenta de cobro cambiada por la propia persona (de ${maskIban(c.bankAccount) || 'sin cuenta'} a ${maskIban(iban)}).`;
        c.bankAccount = iban;
        c.description = appendNote(c.description, note);
        res.commitments += 1;
      }
      for (const id of k.pending) {
        const pay = s.payments.get(id)!;
        if (pay.bankAccount === iban) continue;
        pay.bankAccount = iban;
        res.payments += 1;
      }
    }
    return res;
  };

  /** Dejó la domiciliación: una nota por compromiso, una sola vez por medio. Devuelve cuántos se marcaron. */
  const flag = (payer: string, label: string) => {
    const found = scan(payer);
    if (!found) return 0;
    const s = state();
    let marked = 0;
    for (const { c, class: k } of found) {
      if (!['tocable', 'en_curso', 'ilegible'].includes(k.state)) continue;
      if (c.description.includes(`ha pedido pasar a «${label}»`)) continue;
      if (s.failCommitments.has(c.id)) continue;
      c.description = appendNote(
        c.description,
        `[Área privada ${ddmmyyyy(ctx.today())}] La persona ha pedido pasar a «${label}». Revisar este compromiso antes de la próxima remesa.`,
      );
      marked += 1;
    }
    return marked;
  };

  return {
    paymentMethodState(payerId) {
      const s = state();
      const st = storedOf(payerId);
      return {
        stored: { ...st },
        commitments: (s.commitments.get(payerId) ?? []).map((c) => ({
          id: c.id,
          method: c.method,
          bankAccount: c.bankAccount,
          description: c.description,
          payments: c.paymentIds.map((id) => ({ ...s.payments.get(id)! })),
        })),
      };
    },
    breakPaymentMethod(patch) {
      const s = state();
      if (patch.failCommitments)
        s.failCommitments = new Set(patch.failCommitments);
      if (patch.unreadable) s.unreadable = new Set(patch.unreadable);
      for (const [id, account] of Object.entries(patch.payAccounts ?? {})) {
        const pay = s.payments.get(id);
        if (pay) pay.bankAccount = account;
      }
      if (patch.commitmentsDown !== undefined)
        s.commitmentsDown = patch.commitmentsDown;
    },

    async getPaymentMethod(pid) {
      await ctx.gate('paymentMethod');
      const who = allowedProfile(ctx, pid);
      return PaymentMethodRead.parse({
        ...view(storedOf(meId()), who),
        generatedAt: ctx.nowIso(),
      });
    },

    async savePaymentMethod(pid, body) {
      await ctx.gate('updatePaymentMethod', true);
      const who = allowedProfile(ctx, pid);
      const parsed = PaymentMethodWrite.safeParse(body);
      if (!parsed.success) {
        const kind = (body as { kind?: unknown } | null)?.kind;
        if (!PaymentMethodKind.safeParse(kind).success)
          throw validation('invalid_kind', 'Elige cómo quieres pagar');
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      }
      const w = parsed.data;
      // Mismo `clientId`: no se escribe otra vez; el mismo resultado.
      if (ctx.seen.has(w.clientId))
        return PaymentMethodSaved.parse(ctx.seen.get(w.clientId));

      const payer = meId();
      const st = storedOf(payer);
      let iban = st.iban;
      let holder = st.holder;
      let propagateIban = false;
      if (w.kind === 'domiciliacion') {
        // El servidor limpia todo lo que no es letra o cifra.
        const written = (w.iban ?? '')
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase();
        const candidate = written !== '' ? written : st.iban;
        if (candidate === '' || !isSepaIban(candidate))
          throw validation('invalid_iban', 'Ese IBAN no parece válido');
        const h = cleanHolder(w.holder ?? '') || cleanHolder(st.holder);
        if (h === '')
          throw validation('invalid_holder', 'Escribe el nombre del titular');
        iban = candidate;
        holder = h;
        propagateIban = written !== '';
      }
      // Con otro medio, el IBAN y el titular que hubiera se quedan como estaban: un dato bancario no se pierde por cambiar de idea.
      st.kind = w.kind;
      st.iban = iban;
      st.holder = holder;
      let writes = 1;

      let partial = false;
      let updated = { commitments: 0, payments: 0, inProgress: 0 };
      let flagged = 0;
      if (propagateIban) {
        const r = propagate(payer, iban);
        partial = r.noAnswer || r.errors > 0;
        updated = {
          commitments: r.commitments,
          payments: r.payments,
          inProgress: r.inProgress,
        };
        writes += r.commitments + r.payments;
      } else if (w.kind !== 'domiciliacion') {
        flagged = flag(payer, labelOf(w.kind));
        writes += flagged;
      }
      ctx.bumpWrites(writes);
      const result = PaymentMethodSaved.parse({
        ok: true,
        partial,
        updated,
        flagged,
        current: view(st, who),
      });
      ctx.seen.set(w.clientId, result);
      return result;
    },
  };
}
