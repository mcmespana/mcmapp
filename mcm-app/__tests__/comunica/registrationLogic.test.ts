/**
 * Inscripciones (plan 14, tareas 1, 3 y 11), lógica pura: el IBAN, validar y armar el alta, el orden de la lista, el pago en una línea y cuándo se ofrece pagar,
 * los avisos con los textos del plugin, el contrato y el mapa de enlaces.
 */
import {
  SignupWrite,
  type PaymentState,
  type RegistrationCard,
  type SignupForm,
} from '@/services/comunica/contract';
import { nativeHrefFor } from '@/services/comunica/links';
import { formatIban, isValidIban, normalizeIban } from '@/utils/comunica/iban';
import { euro, paymentLine, payAction } from '@/utils/comunica/paymentLine';
import {
  cardDay,
  isClosed,
  orderRegistrations,
  schoolLine,
  whenLine,
} from '@/utils/comunica/registrationList';
import {
  REGISTRATION_TEXT,
  savedNote,
  statusNote,
} from '@/utils/comunica/registrationNotes';
import {
  buildSignup,
  EMPTY_DRAFT,
  firstErrorField,
  needsPayment,
  questionTitle,
  signupErrors,
} from '@/utils/comunica/signupForm';

const TODAY = '2026-11-01';
const CLIENT = '11111111-1111-4111-8111-111111111111';
const VALID_IBAN = 'ES9121000418450200051332';

describe('IBAN', () => {
  it('uno español y uno alemán valen; un dígito cambiado, uno español de 23 y letras raras, no', () => {
    expect(isValidIban(VALID_IBAN)).toBe(true);
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('ES9121000418450200051333')).toBe(false);
    expect(isValidIban('ES912100041845020005133')).toBe(false);
    expect(isValidIban('ES91 2100 0418 4502 0005 133')).toBe(false);
    expect(isValidIban('')).toBe(false);
    expect(isValidIban('1234')).toBe(false);
    expect(isValidIban(null)).toBe(false);
  });
  it('espacios, guiones y minúsculas se limpian', () => {
    expect(isValidIban('es91 2100 0418 4502 0005 1332')).toBe(true);
    expect(isValidIban('ES91-2100-0418-4502-0005-1332')).toBe(true);
    expect(normalizeIban(' es91 2100 ')).toBe('ES912100');
  });
  it('se agrupa de cuatro en cuatro al escribir', () => {
    expect(formatIban('es9121000418')).toBe('ES91 2100 0418');
    expect(formatIban(VALID_IBAN)).toBe('ES91 2100 0418 4502 0005 1332');
    expect(formatIban('')).toBe('');
  });
});

describe('el alta: validar y armar el envío', () => {
  const card = { key: 'card' as const, label: 'Tarjeta' };
  const dd = { key: 'direct_debit' as const, label: 'Domiciliación' };
  const form = (over: Partial<SignupForm> = {}): SignupForm => ({
    generatedAt: '2026-11-01T10:00:00Z',
    event: {
      id: 'e',
      name: 'E',
      startDate: null,
      endDate: null,
      description: null,
    },
    blocked: null,
    questions: [
      { n: 1, prompt: '¿Dormís?', options: ['Sí', 'No'] },
      { n: 2, prompt: null, options: ['Bus', 'Coche'] },
    ],
    price: 45,
    paymentMethods: [dd, card],
    specialNeeds: {
      label: 'Necesidades especiales',
      options: [
        { value: '0', label: 'No' },
        { value: '1', label: 'Sí' },
      ],
      yesValue: '1',
      descriptionLabel: 'Descripción',
    },
    ...over,
  });
  it('sin contestar una pregunta no se envía (y es lo primero que se muestra)', () => {
    const e = signupErrors(form(), {
      ...EMPTY_DRAFT,
      answers: { 1: 1 },
      method: 'card',
    });
    expect(e).toEqual({
      answers: 'Contesta a todas las preguntas de la actividad.',
    });
    expect(firstErrorField(e)).toBe('answers');
  });
  it('con precio y medios, sin medio no se envía', () => {
    const e = signupErrors(form(), { ...EMPTY_DRAFT, answers: { 1: 1, 2: 2 } });
    expect(e).toEqual({ payment: 'Elige cómo vas a pagar.' });
  });
  it('domiciliación pide un IBAN válido; tarjeta no pide nada más', () => {
    const base = { ...EMPTY_DRAFT, answers: { 1: 1, 2: 2 } as const };
    expect(
      signupErrors(form(), { ...base, method: 'direct_debit', iban: 'ES00' }),
    ).toEqual({ iban: 'El IBAN no parece válido.' });
    expect(
      signupErrors(form(), {
        ...base,
        method: 'direct_debit',
        iban: VALID_IBAN,
      }),
    ).toEqual({});
    expect(signupErrors(form(), { ...base, method: 'card' })).toEqual({});
  });
  it('sin precio o sin medios no se pide cómo pagar; sin preguntas, nada que contestar', () => {
    expect(needsPayment(form({ price: null }))).toBe(false);
    expect(needsPayment(form({ paymentMethods: [] }))).toBe(false);
    expect(
      signupErrors(form({ price: null, questions: [] }), EMPTY_DRAFT),
    ).toEqual({});
  });
  it('el envío lleva el número de opción desde 1 y NUNCA el IBAN sin domiciliación', () => {
    const w = buildSignup(
      form(),
      {
        ...EMPTY_DRAFT,
        answers: { 1: 2, 2: 1 },
        method: 'card',
        iban: VALID_IBAN,
      },
      CLIENT,
      'e',
    );
    expect(w.answers).toEqual([
      { n: 1, option: 2 },
      { n: 2, option: 1 },
    ]);
    expect(w.payment).toEqual({ method: 'card' });
    expect(JSON.stringify(w)).not.toContain('ES91');
    expect(SignupWrite.safeParse(w).success).toBe(true);
  });
  it('con domiciliación viaja el IBAN limpio y en mayúsculas', () => {
    const w = buildSignup(
      form(),
      {
        ...EMPTY_DRAFT,
        answers: { 1: 1, 2: 1 },
        method: 'direct_debit',
        iban: 'es91 2100 0418 4502 0005 1332',
      },
      CLIENT,
      'e',
    );
    expect(w.payment).toEqual({ method: 'direct_debit', iban: VALID_IBAN });
  });
  it('sin precio, `payment` es null; la descripción solo con «sí»', () => {
    const f = form({ price: null, questions: [] });
    expect(
      buildSignup(f, { ...EMPTY_DRAFT, method: 'card' }, CLIENT, 'e').payment,
    ).toBeNull();
    const no = buildSignup(
      f,
      { ...EMPTY_DRAFT, specialNeeds: '0', specialNeedsDescription: 'x' },
      CLIENT,
      'e',
    );
    expect(no.specialNeedsDescription).toBeNull();
    const yes = buildSignup(
      f,
      { ...EMPTY_DRAFT, specialNeeds: '1', specialNeedsDescription: ' Gafas ' },
      CLIENT,
      'e',
    );
    expect(yes).toMatchObject({
      specialNeeds: '1',
      specialNeedsDescription: 'Gafas',
    });
  });
  it('el contrato rechaza un IBAN sin domiciliación, claves de más y personas en el cuerpo', () => {
    const ok = {
      clientId: CLIENT,
      eventId: 'e',
      answers: [],
      payment: { method: 'card' },
    };
    expect(SignupWrite.safeParse(ok).success).toBe(true);
    expect(
      SignupWrite.safeParse({
        ...ok,
        payment: { method: 'card', iban: VALID_IBAN },
      }).success,
    ).toBe(false);
    expect(
      SignupWrite.safeParse({
        ...ok,
        payment: { method: 'direct_debit', iban: VALID_IBAN },
      }).success,
    ).toBe(true);
    expect(SignupWrite.safeParse({ ...ok, personId: 'x' }).success).toBe(false);
    expect(SignupWrite.safeParse({ ...ok, payerId: 'x' }).success).toBe(false);
  });
  it('el título de la pregunta: ella misma, o «Elige una opción» (con número si hay dos sin texto)', () => {
    expect(questionTitle({ n: 1, prompt: '¿Dormís?' }, 2)).toBe('¿Dormís?');
    expect(questionTitle({ n: 1, prompt: null }, 1)).toBe('Elige una opción');
    expect(questionTitle({ n: 2, prompt: null }, 2)).toBe(
      'Elige una opción (2)',
    );
  });
});

describe('Mis inscripciones: el orden', () => {
  const card = (over: Partial<RegistrationCard> = {}): RegistrationCard => ({
    id: 'r',
    title: 'T',
    eventId: 'e',
    eventStart: '2026-11-10',
    eventEnd: '2026-11-10',
    signedOn: '2026-10-01',
    schoolLevel: null,
    classLabel: null,
    status: { label: 'Confirmada', tone: 'ok' },
    eventHidden: false,
    ...over,
  });
  it('lo abierto por fecha ascendente; luego lo cerrado del más reciente al más antiguo; `danger` va a lo cerrado', () => {
    const o = orderRegistrations(
      [
        card({ id: 'a', eventStart: '2026-12-01', eventEnd: '2026-12-01' }),
        card({ id: 'b', eventStart: '2026-11-05', eventEnd: '2026-11-05' }),
        card({ id: 'p1', eventStart: '2026-09-01', eventEnd: '2026-09-01' }),
        card({ id: 'p2', eventStart: '2026-10-15', eventEnd: '2026-10-15' }),
        card({
          id: 'x',
          eventStart: '2026-11-20',
          eventEnd: '2026-11-20',
          status: { label: 'Rechazada', tone: 'danger' },
        }),
      ],
      TODAY,
    );
    expect(o.open.map((c) => c.id)).toEqual(['b', 'a']);
    expect(o.closed.map((c) => c.id)).toEqual(['x', 'p2', 'p1']);
  });
  it('sin fecha de evento, la del alta; lo que no tiene fecha, al final', () => {
    const c = card({
      eventStart: null,
      eventEnd: null,
      signedOn: '2026-10-20',
    });
    expect(cardDay(c)).toBe('2026-10-20');
    const none = card({
      id: 'z',
      eventStart: null,
      eventEnd: null,
      signedOn: null,
    });
    const o = orderRegistrations([none, card({ id: 'a' })], TODAY);
    expect(o.open.map((x) => x.id)).toEqual(['a', 'z']);
  });
  it('«Otros eventos» aparte; abierto solo si no hay nada más', () => {
    const o = orderRegistrations(
      [card({ id: 'h', eventHidden: true }), card({ id: 'v' })],
      TODAY,
    );
    expect(o.others.map((c) => c.id)).toEqual(['h']);
    expect(o.othersOpenByDefault).toBe(false);
    expect(
      orderRegistrations([card({ id: 'h', eventHidden: true })], TODAY)
        .othersOpenByDefault,
    ).toBe(true);
    expect(orderRegistrations([], TODAY).othersOpenByDefault).toBe(false);
  });
  it('cerrado: pasó por el fin del evento o es `danger`', () => {
    expect(isClosed(card({ eventEnd: '2026-10-31' }), TODAY)).toBe(true);
    expect(isClosed(card({ eventEnd: TODAY }), TODAY)).toBe(false);
    expect(
      isClosed(card({ status: { label: 'Cancelada', tone: 'danger' } }), TODAY),
    ).toBe(true);
  });
  it('la línea de cuándo: fechas del evento o «Te apuntaste el …» (de un hijo: «Lucía se apuntó el …»); y el curso con su clase', () => {
    expect(
      whenLine(
        card({ eventStart: '2026-07-01', eventEnd: '2026-07-10' }),
        null,
      ),
    ).toBe('del 1 al 10 de julio de 2026');
    const noDates = card({
      eventStart: null,
      eventEnd: null,
      signedOn: '2026-03-14',
    });
    expect(whenLine(noDates, null)).toBe('Te apuntaste el 14 de marzo de 2026');
    expect(whenLine(noDates, 'Lucía')).toBe(
      'Lucía se apuntó el 14 de marzo de 2026',
    );
    expect(schoolLine({ schoolLevel: '2.º ESO', classLabel: 'Clase B' })).toBe(
      '2.º ESO · Clase B',
    );
    expect(schoolLine({ schoolLevel: null, classLabel: null })).toBeNull();
  });
});

describe('el pago en una línea', () => {
  const p = (over: Partial<PaymentState>): PaymentState => ({
    state: 'pending',
    amount: 35,
    method: 'transfer',
    methodLabel: 'Transferencia',
    date: null,
    paymentId: null,
    ...over,
  });
  it('los importes con coma y dos decimales', () => {
    expect(euro(110)).toBe('110,00 €');
    expect(euro(35.5)).toBe('35,50 €');
    expect(euro(1250)).toBe('1.250,00 €');
  });
  it('pagado, domiciliado, devuelto, pendiente (con y sin medio) y sin pago', () => {
    expect(
      paymentLine(
        p({
          state: 'paid',
          amount: 110,
          method: 'card',
          methodLabel: 'Tarjeta',
          date: '2026-10-02',
          paymentId: 'x',
        }),
      ),
    ).toEqual({
      text: '110,00 € · Pagado · Tarjeta · 2 de octubre de 2026',
      viewPaymentId: 'x',
      notice: null,
    });
    expect(
      paymentLine(
        p({
          state: 'direct_debit',
          amount: 60,
          method: 'direct_debit',
          methodLabel: 'Domiciliación',
          date: '2026-10-16',
        }),
      )?.text,
    ).toBe('60,00 € · Se cobra por domiciliación el 16 de octubre de 2026');
    const ret = paymentLine(p({ state: 'returned', amount: 110 }));
    expect(ret?.text).toBe('110,00 € · No se pudo cobrar');
    expect(ret?.notice).toEqual({
      tone: 'danger',
      text: 'Este pago no se pudo cobrar. Puedes pagarlo con tarjeta o hablar con tu delegación.',
    });
    expect(paymentLine(p({}))?.text).toBe(
      '35,00 € · Pendiente de pagar · Transferencia',
    );
    expect(
      paymentLine(p({ method: 'card', methodLabel: 'Tarjeta' }))?.text,
    ).toBe('35,00 € · Pendiente de pagar');
    expect(
      paymentLine(
        p({ state: 'no_commitment', method: null, methodLabel: null }),
      )?.text,
    ).toBe('35,00 € · Pendiente de pagar');
    expect(paymentLine(p({ state: 'none', amount: null }))).toBeNull();
  });
  it('con transferencia, Bizum o efectivo: «¿Ya lo has pagado?»; con tarjeta, no; recién vuelto del pago, «esperando al banco»', () => {
    for (const m of ['transfer', 'bizum', 'cash'] as const)
      expect(paymentLine(p({ method: m }))?.notice?.text).toBe(
        '¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.',
      );
    expect(paymentLine(p({ method: 'card' }))?.notice).toBeNull();
    expect(
      paymentLine(p({ method: 'card' }), { waiting: true })?.notice?.text,
    ).toBe(
      'Estamos esperando la confirmación del banco. En unos minutos lo verás como pagado.',
    );
  });
  it('cuándo se ofrece pagar con tarjeta', () => {
    const ok = { label: 'Confirmada', tone: 'ok' as const };
    const reg = (
      payment: PaymentState,
      status: {
        label: string;
        tone: 'ok' | 'warn' | 'danger' | 'neutral';
      } = ok,
      amount: number | null = 35,
    ) => ({ status, payment, amount });
    // Pendiente o devuelto con pago concreto.
    expect(
      payAction(reg(p({ paymentId: 'pay-1', method: 'card' })), {}),
    ).toEqual({ label: 'Pagar 35,00 € con tarjeta', paymentId: 'pay-1' });
    expect(
      payAction(
        reg(p({ state: 'returned', paymentId: 'pay-2', amount: 110 })),
        {},
      )?.paymentId,
    ).toBe('pay-2');
    // Pendiente sin id de pago: no hay qué pagar.
    expect(payAction(reg(p({ paymentId: null })), {})).toBeNull();
    // Sin compromiso: por la inscripción, si no ha pasado.
    expect(
      payAction(
        reg(p({ state: 'no_commitment', paymentId: null }), ok, 35),
        {},
      ),
    ).toEqual({ label: 'Pagar 35,00 € con tarjeta', paymentId: null });
    expect(
      payAction(reg(p({ state: 'no_commitment', paymentId: null }), ok, 35), {
        past: true,
      }),
    ).toBeNull();
    // `danger`, esperando al banco, pagado y domiciliado: no.
    expect(
      payAction(
        reg(p({ paymentId: 'x' }), { label: 'Rechazada', tone: 'danger' }),
        {},
      ),
    ).toBeNull();
    expect(payAction(reg(p({ paymentId: 'x' })), { waiting: true })).toBeNull();
    expect(payAction(reg(p({ state: 'paid', paymentId: 'x' })), {})).toBeNull();
    expect(
      payAction(reg(p({ state: 'direct_debit', paymentId: null })), {}),
    ).toBeNull();
    expect(
      payAction(reg(p({ paymentId: 'x', amount: null }), ok, null), {}),
    ).toBeNull();
  });
});

describe('avisos con los textos del plugin', () => {
  it('tras apuntarse, para uno mismo y para un hijo; sin «inscrito»', () => {
    expect(savedNote('signed', null)).toEqual({
      tone: 'ok',
      text: 'Listo: ya tienes tu plaza.',
    });
    expect(savedNote('signed', 'Lucía').text).toBe(
      'Listo: Lucía ya tiene su plaza.',
    );
    expect(savedNote('paid', null).text).toBe(
      'Pago hecho. Ya tienes tu plaza.',
    );
    expect(savedNote('saved', null).text).toBe('Cambios guardados.');
    expect(savedNote('cancelled', null)).toEqual({
      tone: 'info',
      text: 'Inscripción cancelada.',
    });
    expect(savedNote('closed', null).text).toContain('no se ha cambiado nada');
    expect(savedNote('payment_error', 'Lucía').text).toBe(
      'Lucía tiene su plaza, pero no hemos podido dejar anotado el pago. Tu delegación lo revisará; no hace falta repetir la inscripción.',
    );
    for (const k of [
      'signed',
      'paid',
      'saved',
      'cancelled',
      'closed',
      'payment_error',
    ] as const)
      expect(savedNote(k, 'Lucía').text.toLowerCase()).not.toMatch(
        /inscrit[oa]/,
      );
  });
  it('del estado: `danger` y `warn`; los demás, nada', () => {
    expect(statusNote({ label: 'Rechazada', tone: 'danger' })?.text).toBe(
      'Esta inscripción está en estado «Rechazada». Si crees que es un error, habla con tu delegación.',
    );
    expect(statusNote({ label: 'x', tone: 'warn' })?.text).toContain(
      'Todavía no está confirmada.',
    );
    expect(statusNote({ label: 'Confirmada', tone: 'ok' })).toBeNull();
    expect(statusNote({ label: '', tone: 'neutral' })).toBeNull();
  });
  it('el título para uno mismo y para un hijo, y el vacío', () => {
    expect(REGISTRATION_TEXT.titleOwn).toBe('Mis inscripciones');
    expect(REGISTRATION_TEXT.titleOf('Lucía')).toBe('Inscripciones de Lucía');
    expect(REGISTRATION_TEXT.emptyOf('Lucía')).toBe(
      'Todavía no hay inscripciones de Lucía',
    );
  });
});

describe('enlaces del plugin que llegan a las inscripciones', () => {
  const to = (d: Parameters<typeof nativeHrefFor>[0]) => nativeHrefFor(d);
  it('el listado, la ficha, modificar y el alta (también la vuelta del formulario avanzado)', () => {
    expect(to({ internalpage: 'list_stic_registrations' })).toEqual({
      pathname: '/comunica/inscripciones',
    });
    expect(
      to({
        internalpage: 'single_stic_registrations',
        action: 'detail',
        id: 'abcdef0123',
      }),
    ).toEqual({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: 'abcdef0123' },
    });
    expect(
      to({
        internalpage: 'single_stic_registrations',
        action: 'edit',
        id: 'abcdef0123',
      }),
    ).toEqual({
      pathname: '/comunica/inscripciones/[registrationId]/modificar',
      params: { registrationId: 'abcdef0123' },
    });
    expect(
      to({
        internalpage: 'single_stic_registrations',
        action: 'create',
        from: 'stic_events',
        id: 'abcdef0123',
      }),
    ).toEqual({
      pathname: '/comunica/actividades/[eventId]/inscribirme',
      params: { eventId: 'abcdef0123' },
    });
  });
  it('desactivadas o con forma rara: sin evento, a Eventos; `delete`, a la ficha; sin `id`, al listado', () => {
    expect(
      to({ internalpage: 'single_stic_registrations', action: 'create' }),
    ).toEqual({ pathname: '/comunica/actividades' });
    expect(
      to({
        internalpage: 'single_stic_registrations',
        action: 'delete' as 'edit',
        id: 'abcdef0123',
      }),
    ).toEqual({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: 'abcdef0123' },
    });
    expect(to({ internalpage: 'single_stic_registrations' })).toEqual({
      pathname: '/comunica/inscripciones',
    });
    expect(
      to({ internalpage: 'single_stic_registrations', action: 'edit' }),
    ).toEqual({ pathname: '/comunica/inscripciones' });
  });
});
