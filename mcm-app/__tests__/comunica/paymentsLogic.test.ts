/**
 * Pagos (plan 15, tareas 2, 3 y 10), lógica pura: los bloques y su orden, el chip y las líneas, los textos de la ficha, los céntimos y el importe que se
 * escribe, la máquina del pago con tarjeta, la URL de vuelta y el mapa de enlaces.
 */
import {
  CardAttemptCreate,
  PaymentDetail,
  type CardAttemptStatus,
  type Payment,
} from '@/services/comunica/contract';
import { nativeHrefFor } from '@/services/comunica/links';
import {
  CANCELLED_CHECKS_MS,
  confirmDelay,
  hostOf,
  INITIAL,
  isExternalScheme,
  outcome,
  parseBrowserReturn,
  parseReturnUrl,
  reduce,
  resultCopy,
  type Phase,
} from '@/utils/comunica/cardAttempt';
import {
  amountChanged,
  amountSpoken,
  canPay,
  centsToEuro,
  detailFacts,
  doubleCheckText,
  isManualPending,
  needsDoubleCheck,
  parseEuroAmount,
  paymentBlocks,
  paymentChip,
  paymentLines,
  rejectionNote,
} from '@/utils/comunica/payments';

const pay = (over: Partial<Payment> = {}): Payment => ({
  id: 'p',
  title: 'Campamento',
  date: '2026-11-10',
  amountCents: 3500,
  status: 'pending',
  statusLabel: 'Pendiente de pago',
  method: 'transfer',
  methodLabel: 'Transferencia',
  canPayByCard: true,
  ...over,
});

describe('céntimos y euros', () => {
  it('3500 → «35,00 €», con miles y con céntimos', () => {
    expect(centsToEuro(3500)).toBe('35,00 €');
    expect(centsToEuro(2050)).toBe('20,50 €');
    expect(centsToEuro(123456)).toBe('1.234,56 €');
  });
  it('en palabras para el lector de pantalla', () => {
    expect(amountSpoken(3500)).toBe('35 euros');
    expect(amountSpoken(100)).toBe('1 euro');
    expect(amountSpoken(3550)).toBe('35 euros con 50 céntimos');
    expect(amountSpoken(3501)).toBe('35 euros con 1 céntimo');
  });
});

describe('leer el importe que se escribe (sin sorpresas, sin tope)', () => {
  const ok = (s: string) => parseEuroAmount(s);
  it('«20,5», «20,50», «20.50» y «35» valen', () => {
    expect(ok('20,5')).toEqual({ ok: true, cents: 2050 });
    expect(ok('20,50')).toEqual({ ok: true, cents: 2050 });
    expect(ok('20.50')).toEqual({ ok: true, cents: 2050 });
    expect(ok('35')).toEqual({ ok: true, cents: 3500 });
    expect(ok(' 35 ')).toEqual({ ok: true, cents: 3500 });
  });
  it('con miles inequívocos: «1.234,56» y «1,234.56» valen', () => {
    expect(ok('1.234,56')).toEqual({ ok: true, cents: 123456 });
    expect(ok('1,234.56')).toEqual({ ok: true, cents: 123456 });
    expect(ok('12.345,6')).toEqual({ ok: true, cents: 1234560 });
  });
  it('«1.234» es ambiguo y se rechaza con su texto; sin tope: 1234 vale', () => {
    expect(ok('1.234')).toEqual({
      ok: false,
      message: 'Escribe el importe con coma para los céntimos: 1234 o 1234,00',
    });
    expect(ok('1234')).toEqual({ ok: true, cents: 123400 });
    expect(ok('1234,00')).toEqual({ ok: true, cents: 123400 });
    expect(ok('1000000')).toEqual({ ok: true, cents: 100000000 });
  });
  it('menos de 1 €, letras, vacío, más de dos decimales y separadores raros no valen', () => {
    expect(ok('0,99')).toEqual({
      ok: false,
      message: 'El importe mínimo es 1,00 €',
    });
    expect(ok('0')).toMatchObject({ ok: false });
    for (const bad of [
      'abc',
      '',
      '  ',
      '35,555',
      '35.5555',
      '1.2.3',
      '1,2,3',
      ',5',
      '5,',
      '1.234,5,6',
      '35 €',
      '-5',
      '1e3',
    ])
      expect(ok(bad)).toMatchObject({ ok: false });
    expect(ok('35,555')).toMatchObject({
      message: 'Escribe solo el importe, como 35 o 35,50',
    });
  });
  it('más del doble pide confirmar (no es un tope); un cambio se nota', () => {
    expect(needsDoubleCheck(7000, 3500)).toBe(false);
    expect(needsDoubleCheck(7001, 3500)).toBe(true);
    expect(doubleCheckText(350000, 3500)).toBe(
      'Vas a pagar 3.500,00 €, más de lo indicado (35,00 €). ¿Es correcto?',
    );
    expect(amountChanged(3500, 3500)).toBe(false);
    expect(amountChanged(2000, 3500)).toBe(true);
  });
});

describe('los bloques', () => {
  it('«Pendiente» (devuelto o pagable), «Domiciliación», «Pagado» y «Otros»; un bloque vacío no sale', () => {
    const b = paymentBlocks([
      pay({ id: 'a', status: 'pending' }),
      pay({ id: 'f', status: 'failed' }),
      pay({ id: 's', status: 'scheduled' }),
      pay({ id: 'd', status: 'paid' }),
      pay({ id: 'o', status: 'other' }),
    ]);
    expect(b.map((x) => [x.key, x.title])).toEqual([
      ['pending', 'Pendiente de pagar'],
      ['scheduled', 'Se cobrará por domiciliación'],
      ['paid', 'Pagado'],
      ['other', 'Otros'],
    ]);
    expect(b[0].payments.map((p) => p.id).sort()).toEqual(['a', 'f']);
    expect(paymentBlocks([pay({ status: 'paid' })]).map((x) => x.key)).toEqual([
      'paid',
    ]);
    expect(paymentBlocks([])).toEqual([]);
  });
  it('lo que viene por fecha ascendente (sin fecha, al final); lo pagado, lo último arriba', () => {
    const b = paymentBlocks([
      pay({ id: 'late', date: '2026-12-01' }),
      pay({ id: 'none', date: null }),
      pay({ id: 'soon', date: '2026-11-05' }),
      pay({ id: 'old', status: 'paid', date: '2026-09-01' }),
      pay({ id: 'new', status: 'paid', date: '2026-10-20' }),
    ]);
    expect(b[0].payments.map((p) => p.id)).toEqual(['soon', 'late', 'none']);
    expect(b[1].payments.map((p) => p.id)).toEqual(['new', 'old']);
  });
});

describe('el chip y las líneas de la tarjeta', () => {
  it('chip solo cuando dice algo nuevo: un devuelto en rojo con su etiqueta; «Comprobando el pago»; un pendiente normal, nada', () => {
    expect(
      paymentChip(pay({ status: 'failed', statusLabel: 'Devuelto' })),
    ).toEqual({ label: 'Devuelto', tone: 'negative' });
    expect(paymentChip(pay({ status: 'failed', statusLabel: '' }))).toEqual({
      label: 'No se pudo cobrar',
      tone: 'negative',
    });
    expect(
      paymentChip(pay({ confirmingSince: '2026-11-01T09:00:00Z' })),
    ).toEqual({ label: 'Comprobando el pago', tone: 'neutral' });
    expect(paymentChip(pay())).toBeNull();
    expect(paymentChip(pay({ status: 'paid' }))).toBeNull();
    expect(paymentChip(pay({ status: 'scheduled' }))).toBeNull();
  });
  it('el medio sale salvo si es tarjeta pendiente; «Para Lucía» cuando es de un hijo', () => {
    expect(paymentLines(pay())).toEqual(['Transferencia']);
    expect(
      paymentLines(pay({ method: 'card', methodLabel: 'Tarjeta' })),
    ).toEqual([]);
    expect(
      paymentLines(
        pay({ method: 'card', methodLabel: 'Tarjeta', status: 'paid' }),
      ),
    ).toEqual(['Tarjeta']);
    expect(paymentLines(pay({ forName: 'Lucía' }))).toEqual([
      'Para Lucía',
      'Transferencia',
    ]);
  });
  it('no se ofrece pagar mientras el banco confirma (no se paga dos veces)', () => {
    expect(canPay(pay())).toBe(true);
    expect(canPay(pay({ canPayByCard: false }))).toBe(false);
    expect(canPay(pay({ confirmingSince: '2026-11-01T09:00:00Z' }))).toBe(
      false,
    );
  });
});

describe('la ficha', () => {
  const detail = (over: Partial<PaymentDetail> = {}): PaymentDetail => ({
    generatedAt: '2026-11-01T10:00:00Z',
    ...pay(),
    ...over,
  });
  it('un devuelto: motivo, fecha y qué hacer (con y sin poder pagar)', () => {
    const d = detail({
      status: 'failed',
      rejection: { reason: 'Cuenta cerrada', date: '2026-10-10' },
    });
    expect(rejectionNote(d)).toBe(
      'Este recibo no se pudo cobrar: Cuenta cerrada. Ocurrió el 10 de octubre de 2026. Puedes pagarlo con tarjeta o hablar con tu delegación.',
    );
    expect(rejectionNote({ ...d, canPayByCard: false })).toBe(
      'Este recibo no se pudo cobrar: Cuenta cerrada. Ocurrió el 10 de octubre de 2026. Ponte en contacto con tu delegación para volver a intentarlo.',
    );
    expect(rejectionNote(detail({ status: 'failed' }))).toBe(
      'Este recibo no se pudo cobrar. Puedes pagarlo con tarjeta o hablar con tu delegación.',
    );
    expect(rejectionNote(detail())).toBeNull();
  });
  it('«¿Ya lo has pagado?» solo en transferencia, Bizum y efectivo pendientes', () => {
    for (const m of ['transfer', 'bizum', 'cash'] as const)
      expect(isManualPending({ status: 'pending', method: m })).toBe(true);
    expect(isManualPending({ status: 'pending', method: 'card' })).toBe(false);
    expect(isManualPending({ status: 'paid', method: 'transfer' })).toBe(false);
    expect(isManualPending({ status: 'failed', method: 'transfer' })).toBe(
      false,
    );
  });
  it('los datos en el orden del plugin: Tipo (no «Servicios»), Cuenta, Concepto (si no es el título), Descripción, Para y la referencia', () => {
    const f = detailFacts(
      detail({
        typeLabel: 'Congreso',
        accountMasked: '•••• 1332',
        bankingConcept: 'Cuota nov',
        inKindDescription: 'Folios',
        forName: 'Lucía',
        transactionCode: '123',
        method: 'card',
      }),
    );
    expect(f.map((x) => x.label)).toEqual([
      'Tipo',
      'Cuenta',
      'Concepto',
      'Descripción',
      'Para',
      'Nº de operación',
    ]);
    expect(detailFacts(detail({ typeLabel: 'Servicios' }))).toEqual([]);
    expect(detailFacts(detail({ bankingConcept: 'Campamento' }))).toEqual([]);
    expect(
      detailFacts(detail({ transactionCode: '9', method: 'transfer' }))[0]
        .label,
    ).toBe('Referencia');
  });
});

describe('el contrato', () => {
  it('el detalle no tiene más campo de cuenta que `accountMasked`', () => {
    const keys = Object.keys(PaymentDetail.shape);
    expect(keys.filter((k) => /account|iban/i.test(k))).toEqual([
      'accountMasked',
    ]);
  });
  it('un intento exige un origen (nunca un donativo), mínimo 1 € y claves de más no pasan', () => {
    const base = {
      clientId: '11111111-1111-4111-8111-111111111111',
      source: { payment: 'p' },
      amountCents: 3500,
      channel: 'sheet',
    };
    expect(CardAttemptCreate.safeParse(base).success).toBe(true);
    expect(CardAttemptCreate.safeParse({ ...base, source: {} }).success).toBe(
      false,
    );
    expect(
      CardAttemptCreate.safeParse({ ...base, source: undefined }).success,
    ).toBe(false);
    expect(
      CardAttemptCreate.safeParse({ ...base, amountCents: 99 }).success,
    ).toBe(false);
    expect(
      CardAttemptCreate.safeParse({ ...base, donation: true }).success,
    ).toBe(false);
  });
});

describe('la máquina del pago con tarjeta', () => {
  const status = (
    state: CardAttemptStatus['state'],
    extra: Partial<CardAttemptStatus> = {},
  ): CardAttemptStatus => ({ attemptId: 'a1', state, ...extra });
  const run = (...events: Parameters<typeof reduce>[1][]) =>
    events.reduce<Phase>(reduce, INITIAL);
  it('resumen → creando → pagando → comprobando → pagado', () => {
    const p = run(
      { type: 'create' },
      { type: 'created', attemptId: 'a1' },
      { type: 'gateway', returned: 'ok' },
      {
        type: 'status',
        status: status('paid', { registrationId: 'r1' }),
        returned: 'ok',
        elapsedMs: 0,
      },
    );
    expect(p).toEqual({
      kind: 'result',
      result: 'paid',
      registrationId: 'r1',
      paymentId: undefined,
    });
  });
  it('«KO pero el CRM dice pagado» es pagado; «OK pero sin cobrar» es confirmando; el servidor manda', () => {
    expect(outcome(status('paid'), 'ko', 0).result).toBe('paid');
    expect(outcome(status('confirming'), 'ok', 0).result).toBe('confirming');
    expect(outcome(status('confirming'), 'ok', 180000).result).toBe('waiting');
    expect(outcome(status('failed'), 'ok', 0).result).toBe('failed');
  });
  it('KO sin cobro: fallido; cerrar a medias sin cobro: cancelado', () => {
    expect(outcome(status('started'), 'ko', 0).result).toBe('failed');
    expect(outcome(status('started'), 'closed', 0).result).toBe('cancelled');
    expect(outcome(status('abandoned'), 'closed', 0).result).toBe('cancelled');
  });
  it('confirmando se resuelve más tarde por sondeo; reintentar crea otro intento', () => {
    let p = run(
      { type: 'create' },
      { type: 'created', attemptId: 'a1' },
      { type: 'gateway', returned: 'ok' },
      {
        type: 'status',
        status: status('confirming'),
        returned: 'ok',
        elapsedMs: 0,
      },
    );
    expect(p).toMatchObject({ kind: 'result', result: 'confirming' });
    p = reduce(p, { type: 'poll', status: status('paid'), elapsedMs: 5000 });
    expect(p).toMatchObject({ result: 'paid' });
    const failed = run(
      { type: 'create' },
      { type: 'created', attemptId: 'a1' },
      { type: 'gateway', returned: 'ko' },
      {
        type: 'status',
        status: status('failed'),
        returned: 'ko',
        elapsedMs: 0,
      },
    );
    expect(reduce(failed, { type: 'retry' })).toEqual({ kind: 'creating' });
  });
  it('los eventos fuera de su fase no hacen nada (doble toque, sondeo tardío)', () => {
    expect(reduce(INITIAL, { type: 'gateway', returned: 'ok' })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: 'created', attemptId: 'x' })).toBe(INITIAL);
    const creating = reduce(INITIAL, { type: 'create' });
    expect(reduce(creating, { type: 'create' })).toBe(creating);
    expect(
      reduce(INITIAL, { type: 'poll', status: status('paid'), elapsedMs: 0 }),
    ).toBe(INITIAL);
  });
  it('si no se pudo crear, un resultado propio', () => {
    expect(run({ type: 'create' }, { type: 'createFailed' })).toEqual({
      kind: 'result',
      result: 'create_failed',
    });
  });
  it('desde la hoja abierta se puede arrancar otro intento (el navegador de reserva)', () => {
    const paying = run(
      { type: 'create' },
      { type: 'created', attemptId: 'a1' },
    );
    expect(reduce(paying, { type: 'create' })).toEqual({ kind: 'creating' });
  });
  it('el sondeo: 2, 4, 8, 15 y 30 s y cada 30 s hasta 3 min; cerrar a medias: 0, 3 y 8 s', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => confirmDelay(n, 1000))).toEqual([
      2000, 4000, 8000, 15000, 30000, 30000, 30000,
    ]);
    expect(confirmDelay(3, 180000)).toBeNull();
    expect(confirmDelay(0, 200000)).toBeNull();
    expect([...CANCELLED_CHECKS_MS]).toEqual([0, 3000, 8000]);
  });
});

describe('la URL de vuelta y lo que se abre fuera', () => {
  const P = 'https://mw.example.org/v1/card-return/att-1/';
  it('`ok` y `ko` tras el prefijo; basura, otro prefijo y vacío, nada', () => {
    expect(parseReturnUrl(`${P}ok`, P)).toBe('ok');
    expect(parseReturnUrl(`${P}ko`, P)).toBe('ko');
    expect(parseReturnUrl(`${P}ok?x=1`, P)).toBe('ok');
    expect(parseReturnUrl(`${P}ok/`, P)).toBe('ok');
    expect(parseReturnUrl(`${P}basura`, P)).toBeNull();
    expect(parseReturnUrl(`${P}`, P)).toBeNull();
    expect(
      parseReturnUrl('https://mw.example.org/v1/card-return/att-2/ok', P),
    ).toBeNull();
    expect(parseReturnUrl('https://evil.example.org/ok', P)).toBeNull();
    expect(parseReturnUrl(`${P}ok`, '')).toBeNull();
  });
  it('un esquema que no es http(s) se abre fuera; about: y http(s), no', () => {
    for (const u of [
      'bizum://pay?x=1',
      'intent://x#Intent;end',
      'mailto:a@b.es',
      'tel:123',
      'com.bank.app://confirm',
    ])
      expect(isExternalScheme(u)).toBe(true);
    for (const u of [
      'https://bank.example.org/pay',
      'http://x.es',
      'about:blank',
      '',
    ])
      expect(isExternalScheme(u)).toBe(false);
  });
  it('la vuelta del navegador de reserva', () => {
    expect(
      parseBrowserReturn('mcmapp://comunica/pagos/vuelta?intento=att-1&r=ok'),
    ).toEqual({ attemptId: 'att-1', returned: 'ok' });
    expect(
      parseBrowserReturn('mcmapp://comunica/pagos/vuelta?intento=att-1&r=ko')
        ?.returned,
    ).toBe('ko');
    expect(
      parseBrowserReturn('mcmapp://comunica/pagos/vuelta?intento=att-1&r=x'),
    ).toBeNull();
    expect(
      parseBrowserReturn('mcmapp://comunica/pagos/vuelta?r=ok'),
    ).toBeNull();
    expect(parseBrowserReturn('https://x.es/?intento=1&r=ok')).toBeNull();
  });
  it('el dominio de la cabecera', () => {
    expect(hostOf('https://mw.example.org/v1/card-launch/a')).toBe(
      'mw.example.org',
    );
    expect(hostOf('no es una url')).toBe('');
  });
});

describe('los textos del resultado', () => {
  it('pagado, desde una inscripción (para uno mismo y para un hijo) y desde Pagos', () => {
    expect(
      resultCopy('paid', { child: null, fromRegistration: true }),
    ).toMatchObject({
      title: 'Pago hecho. Ya tienes tu plaza.',
      primary: 'Ver la inscripción',
    });
    expect(
      resultCopy('paid', { child: 'Lucía', fromRegistration: true }).title,
    ).toBe('Pago hecho. Lucía ya tiene su plaza.');
    expect(
      resultCopy('paid', { child: null, fromRegistration: false }),
    ).toMatchObject({ title: 'Pago hecho.', primary: 'Volver a Pagos' });
  });
  it('sin confirmar, esperando, KO y cancelado', () => {
    expect(
      resultCopy('confirming', { child: null, fromRegistration: false }).body,
    ).toBe('Si aún lo ves pendiente, el banco está terminando de confirmarlo.');
    expect(
      resultCopy('waiting', { child: null, fromRegistration: false }).title,
    ).toBe('Estamos esperando la confirmación del banco');
    const ko = resultCopy('failed', { child: null, fromRegistration: false });
    expect(ko.title).toBe('No hemos podido completar el pago');
    expect(ko.body).toContain('No se ha realizado ningún cargo.');
    expect(ko.body).toContain('delegación');
    expect(ko.body).not.toContain('administrador');
    expect([ko.primary, ko.secondary]).toEqual([
      'Reintentar el pago',
      'Ahora no',
    ]);
    const c = resultCopy('cancelled', { child: null, fromRegistration: false });
    expect(c.title).toBe('No has terminado el pago');
    expect(c.primary).toBe('Volver a intentarlo');
  });
});

describe('enlaces del plugin que llegan a Pagos', () => {
  const to = (d: Parameters<typeof nativeHrefFor>[0]) => nativeHrefFor(d);
  it('el listado y la ficha', () => {
    expect(to({ internalpage: 'list_stic_payments' })).toEqual({
      pathname: '/comunica/pagos',
    });
    expect(
      to({
        internalpage: 'single_stic_payments',
        action: 'detail',
        id: 'abcdef0123',
      }),
    ).toEqual({
      pathname: '/comunica/pagos/[id]',
      params: { id: 'abcdef0123' },
    });
  });
  it('pagar un pago; sin nada, al listado; el rebote KO con su nota', () => {
    expect(
      to({ internalpage: 'single_stic_payment_form', id: 'abcdef0123' }),
    ).toEqual({
      pathname: '/comunica/pagos/pagar',
      params: { pago: 'abcdef0123' },
    });
    expect(to({ internalpage: 'single_stic_payment_form' })).toEqual({
      pathname: '/comunica/pagos',
    });
    expect(to({ internalpage: 'single_stic_payment_error' })).toEqual({
      pathname: '/comunica/pagos',
      params: { nota: 'error' },
    });
  });
  it('lo desactivado (crear, editar, borrar, compromisos) va al listado', () => {
    for (const action of ['create', 'edit', 'delete'] as const)
      expect(
        to({ internalpage: 'single_stic_payments', action, id: 'abcdef0123' }),
      ).toEqual({ pathname: '/comunica/pagos' });
    expect(to({ internalpage: 'list_stic_payment_commitments' })).toEqual({
      pathname: '/comunica/pagos',
    });
    expect(
      to({
        internalpage: 'single_stic_payment_commitments',
        action: 'detail',
        id: 'abcdef0123',
      }),
    ).toEqual({ pathname: '/comunica/pagos' });
  });
});
