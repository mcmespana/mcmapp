/**
 * Pagos (plan 15, tarea 1): el servidor falso, portado como el de verdad.
 *
 *   · El dinero es DE QUIEN PAGA: viéndose a sí mismo, todo lo que paga (con `forName`); viendo a un hijo, solo lo de ese hijo. Lo de otra familia: 403.
 *   · `card-checkout` solo lee; `not_payable`, `missing_payer_data` y `nothing_to_pay`.
 *   · Los intentos son `simulated` (solo el falso); el estado lo decide el servidor: `ok` → pagado (o confirmando si el banco tarda), `ko` → fallido, cerrar → empezado.
 *   · El IBAN nunca sale entero.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import { PaymentDetail, ROUTES } from '@/services/comunica/contract';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import { uuidV4 } from '@/utils/comunica/uuid';

const LUCIA = 'f-hijo-lucia';
const NICO = 'f-hijo-sin-nombre';
const server = (persona: PersonaId = 'family', patch = {}) =>
  createFakeServer({ latencyMs: 0, persona, ...patch });
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) =>
      `${e.code}:${e.status}${e.reason ? `:${e.reason}` : ''}`,
  );
type Server = ReturnType<typeof server>;
const me = (s: Server, p: PersonaId = 'family') => s.data.personas[p].personId;
const attempt = (s: Server, pid: string, source: object, over: object = {}) =>
  s.createCardAttempt(pid, {
    clientId: uuidV4(),
    source,
    amountCents: 3500,
    channel: 'sheet',
    ...over,
  } as never);

describe('contrato', () => {
  it('ninguna lectura de pagos se guarda en el móvil', () => {
    for (const r of [
      'profilePayments',
      'profilePayment',
      'cardCheckout',
      'createCardAttempt',
      'checkCardAttempt',
    ] as const)
      expect(ROUTES[r].persist).toBe(false);
  });
});

describe('quién ve qué', () => {
  it('viéndose a sí mismo: todo lo que paga, con «Para Lucía»; viendo a un hijo, solo lo suyo y sin «Para»', async () => {
    const s = server();
    const own = await s.getProfilePayments(me(s));
    const ids = own.payments.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'pay-transfer-110',
        'pay-fee-20',
        'pay-pend-1',
        'pay-dd-60',
      ]),
    );
    expect(own.payments.find((p) => p.id === 'pay-transfer-110')?.forName).toBe(
      'Lucía',
    );
    expect(
      own.payments.find((p) => p.id === 'pay-fee-20')?.forName,
    ).toBeUndefined();
    const lucia = await s.getProfilePayments(LUCIA);
    expect(lucia.payments.every((p) => p.forName === undefined)).toBe(true);
    expect(lucia.payments.map((p) => p.id)).toContain('pay-transfer-110');
    expect(lucia.payments.map((p) => p.id)).not.toContain('pay-pend-1');
    expect(
      (await s.getProfilePayments(NICO)).payments.map((p) => p.id),
    ).toEqual(expect.arrayContaining(['pay-pend-1', 'pay-ret-1', 'pay-dd-60']));
  });
  it('lo de otra familia o de otro perfil: 403 (nunca 404)', async () => {
    const s = server();
    expect(await code(s.getProfilePayment(me(s), 'pay-other-1'))).toBe(
      'forbidden:403',
    );
    expect(await code(s.getProfilePayment(LUCIA, 'pay-pend-1'))).toBe(
      'forbidden:403',
    );
    expect(await code(s.getProfilePayment(me(s), 'no-existe'))).toBe(
      'forbidden:403',
    );
    expect(
      await code(s.getProfilePayments(s.data.personas.memberNoKids.personId)),
    ).toBe('forbidden:403');
    expect(
      await code(s.getCardCheckout(me(s), { payment: 'pay-other-1' })),
    ).toBe('forbidden:403');
  });
  it('un monitor ve el pago del Congreso', async () => {
    const s = server('monitorMom');
    expect(
      (await s.getProfilePayments(me(s, 'monitorMom'))).payments.map(
        (p) => p.title,
      ),
    ).toContain('Congreso de Monitores');
  });
});

describe('los pagos en todos los estados', () => {
  it('transferencia y Bizum pendientes, domiciliación devuelta con motivo, otra en remesa, tarjeta pagada, una «Especie» y una confirmando', async () => {
    const s = server();
    const all = (await s.getProfilePayments(me(s))).payments;
    const by = (id: string) => all.find((p) => p.id === id)!;
    expect(by('pay-transfer-110')).toMatchObject({
      status: 'pending',
      method: 'transfer',
      amountCents: 11000,
      canPayByCard: true,
    });
    expect(by('pay-bizum-25')).toMatchObject({
      method: 'bizum',
      methodLabel: 'Bizum',
    });
    expect(by('pay-rejected')).toMatchObject({
      status: 'failed',
      statusLabel: 'Rechazado',
      canPayByCard: true,
    });
    expect(by('pay-dd-60')).toMatchObject({
      status: 'scheduled',
      canPayByCard: false,
    });
    expect(by('pay-lucia-110')).toMatchObject({
      status: 'paid',
      method: 'card',
      canPayByCard: false,
    });
    expect(by('pay-especie')).toMatchObject({
      method: 'other',
      methodLabel: 'Especie',
      canPayByCard: true,
    });
    expect(by('pay-confirming')).toMatchObject({
      canPayByCard: false,
      confirmingSince: expect.any(String),
    });
  });
  it('la ficha: el devuelto con su motivo, la tarjeta con su nº de operación y la cuenta enmascarada', async () => {
    const s = server();
    const rej = await s.getProfilePayment(LUCIA, 'pay-rejected');
    expect(rej.rejection).toMatchObject({ reason: 'Fondos insuficientes' });
    const card = await s.getProfilePayment(LUCIA, 'pay-lucia-110');
    expect(card.transactionCode).toBe('260930123456');
    expect(card.registrationId).toBe('reg-lucia-pasada');
    expect(PaymentDetail.safeParse(card).success).toBe(true);
  });
  it('el IBAN nunca sale entero: como mucho 4 cifras visibles', async () => {
    const s = server();
    for (const id of ['pay-rejected']) {
      const d = await s.getProfilePayment(LUCIA, id);
      expect(d.accountMasked).toBeDefined();
      expect((d.accountMasked!.match(/\d/g) ?? []).length).toBeLessThanOrEqual(
        4,
      );
    }
    for (const pid of [me(s), LUCIA, NICO]) {
      const text = JSON.stringify(await s.getProfilePayments(pid));
      expect(text).not.toMatch(/ES\d{2}[\s]?\d{4}/);
    }
  });
  it('las fechas siguen al reloj del falso', async () => {
    const s = server('family', { clock: '2026-12-01T10:00:00Z' });
    expect((await s.getProfilePayment(NICO, 'pay-dd-60')).date).toBe(
      '2026-12-15',
    );
  });
});

describe('card-checkout: solo lee', () => {
  it('un pago pendiente: concepto, importe, quien paga y a quién; no crea nada', async () => {
    const s = server();
    const c = (await s.getCardCheckout(LUCIA, { payment: 'pay-transfer-110' }))
      .checkout;
    expect(c).toMatchObject({
      payable: true,
      concept: 'Campamento de verano',
      amountCents: 11000,
      returnTo: 'payments',
    });
    if (c.payable) {
      expect(c.payer.name).toContain('Marta');
      expect(c.forName).toBe('Lucía');
    }
    expect(s.writeCount).toBe(0);
  });
  it('viéndose a sí mismo no hay «para»; con inscripción vuelve a ella', async () => {
    const s = server();
    const own = (await s.getCardCheckout(me(s), { payment: 'pay-fee-20' }))
      .checkout;
    expect(own.payable && own.forName).toBeFalsy();
    const reg = (await s.getCardCheckout(NICO, { payment: 'pay-pend-1' }))
      .checkout;
    expect(reg).toMatchObject({
      payable: true,
      returnTo: { registration: 'reg-nico-card' },
    });
  });
  it('no pagable: pagado, domiciliado, confirmando', async () => {
    const s = server();
    for (const id of ['pay-lucia-110', 'pay-confirming'])
      expect(
        (await s.getCardCheckout(LUCIA, { payment: id })).checkout,
      ).toEqual({ payable: false, reason: 'not_payable' });
    expect(
      (await s.getCardCheckout(NICO, { payment: 'pay-dd-60' })).checkout,
    ).toEqual({ payable: false, reason: 'not_payable' });
  });
  it('el pagador sin documento: missing_payer_data', async () => {
    const s = server('familyNone');
    expect(
      (
        await s.getCardCheckout(me(s, 'familyNone'), {
          payment: 'pay-carmen-1',
        })
      ).checkout,
    ).toEqual({
      payable: false,
      reason: 'missing_payer_data',
    });
  });
  it('por inscripción: sin compromiso se paga por el precio; sin nada que pagar, rebote', async () => {
    const s = server();
    const c = (
      await s.getCardCheckout(LUCIA, { registration: 'reg-lucia-curso' })
    ).checkout;
    expect(c).toMatchObject({
      payable: true,
      amountCents: 30000,
      returnTo: { registration: 'reg-lucia-curso' },
    });
    expect(
      (await s.getCardCheckout(LUCIA, { registration: 'reg-lucia-sesiones' }))
        .checkout,
    ).toEqual({
      payable: false,
      reason: 'nothing_to_pay',
    });
    expect(
      await code(s.getCardCheckout(LUCIA, { registration: 'reg-nico-card' })),
    ).toBe('forbidden:403');
  });
});

describe('el intento de pago', () => {
  it('«Pagar»: `simulated`, y tras el `ok` el servidor lo da por cobrado: pagado con tarjeta, nº de operación y la inscripción también', async () => {
    const s = server();
    const a = await attempt(s, NICO, { payment: 'pay-pend-1' });
    expect(a).toMatchObject({ simulated: true });
    const st = await s.checkCardAttempt(NICO, a.attemptId, { returned: 'ok' });
    expect(st).toMatchObject({
      state: 'paid',
      paidCents: 3500,
      paymentId: 'pay-pend-1',
      registrationId: 'reg-nico-card',
    });
    const d = await s.getProfilePayment(NICO, 'pay-pend-1');
    expect(d).toMatchObject({
      status: 'paid',
      method: 'card',
      canPayByCard: false,
    });
    expect(d.transactionCode).toMatch(/^26110/);
    expect(
      (await s.getProfileRegistration(NICO, 'reg-nico-card')).payment.state,
    ).toBe('paid');
  });
  it('lo que se paga es lo que queda como pagado (un descuento, no un pago parcial)', async () => {
    const s = server();
    const a = await attempt(
      s,
      NICO,
      { payment: 'pay-pend-1' },
      { amountCents: 1500 },
    );
    await s.checkCardAttempt(NICO, a.attemptId, { returned: 'ok' });
    expect((await s.getProfilePayment(NICO, 'pay-pend-1')).amountCents).toBe(
      1500,
    );
  });
  it('el banco tarda: `confirming` (con «Comprobando el pago» y sin poder volver a pagar) hasta N comprobaciones', async () => {
    const s = server('family', { cardConfirmsAfter: 2 });
    const a = await attempt(s, NICO, { payment: 'pay-pend-1' });
    expect(
      (await s.checkCardAttempt(NICO, a.attemptId, { returned: 'ok' })).state,
    ).toBe('confirming');
    const mid = await s.getProfilePayment(NICO, 'pay-pend-1');
    expect(mid.confirmingSince).toBeDefined();
    expect(mid.canPayByCard).toBe(false);
    expect(await code(attempt(s, NICO, { payment: 'pay-pend-1' }))).toBe(
      'conflict:409:not_payable',
    );
    expect((await s.checkCardAttempt(NICO, a.attemptId, {})).state).toBe(
      'confirming',
    );
    expect((await s.checkCardAttempt(NICO, a.attemptId, {})).state).toBe(
      'paid',
    );
    const done = await s.getProfilePayment(NICO, 'pay-pend-1');
    expect(done.confirmingSince).toBeUndefined();
    expect(done.status).toBe('paid');
  });
  it('«Rechazar»: fallido y no se cobra nada; se puede reintentar con otro intento', async () => {
    const s = server();
    const a = await attempt(s, NICO, { payment: 'pay-pend-1' });
    expect(
      (await s.checkCardAttempt(NICO, a.attemptId, { returned: 'ko' })).state,
    ).toBe('failed');
    expect((await s.getProfilePayment(NICO, 'pay-pend-1')).status).toBe(
      'pending',
    );
    const b = await attempt(s, NICO, { payment: 'pay-pend-1' });
    expect(b.attemptId).not.toBe(a.attemptId);
  });
  it('cerrar a medias: `started` y nada cobrado', async () => {
    const s = server();
    const a = await attempt(s, NICO, { payment: 'pay-pend-1' });
    expect(
      (await s.checkCardAttempt(NICO, a.attemptId, { returned: 'closed' }))
        .state,
    ).toBe('started');
    expect((await s.checkCardAttempt(NICO, a.attemptId, {})).state).toBe(
      'started',
    );
    expect((await s.getProfilePayment(NICO, 'pay-pend-1')).status).toBe(
      'pending',
    );
  });
  it('por inscripción sin compromiso: nace el pago al cobrarse', async () => {
    const s = server();
    const a = await attempt(
      s,
      LUCIA,
      { registration: 'reg-lucia-curso' },
      { amountCents: 30000 },
    );
    const st = await s.checkCardAttempt(LUCIA, a.attemptId, { returned: 'ok' });
    expect(st).toMatchObject({
      state: 'paid',
      registrationId: 'reg-lucia-curso',
      paidCents: 30000,
    });
    expect(
      (await s.getProfileRegistration(LUCIA, 'reg-lucia-curso')).payment.state,
    ).toBe('paid');
  });
  it('nunca sin origen, con menos de 1 € ni con claves de más; mismo clientId, mismo intento; pagos ajenos, 403', async () => {
    const s = server();
    const base = { clientId: uuidV4(), amountCents: 3500, channel: 'sheet' };
    expect(
      await code(s.createCardAttempt(NICO, { ...base, source: {} } as never)),
    ).toBe('validation:422:bad_body');
    expect(
      await code(
        s.createCardAttempt(NICO, {
          ...base,
          source: { payment: 'pay-pend-1' },
          amountCents: 99,
        } as never),
      ),
    ).toBe('validation:422:bad_body');
    expect(
      await code(
        s.createCardAttempt(NICO, {
          ...base,
          source: { payment: 'pay-pend-1' },
          donation: 5,
        } as never),
      ),
    ).toBe('validation:422:bad_body');
    const first = await s.createCardAttempt(NICO, {
      ...base,
      source: { payment: 'pay-pend-1' },
    } as never);
    const again = await s.createCardAttempt(NICO, {
      ...base,
      source: { payment: 'pay-pend-1' },
    } as never);
    expect(again).toEqual(first);
    expect(await code(attempt(s, me(s), { payment: 'pay-other-1' }))).toBe(
      'forbidden:403',
    );
    expect(await code(s.checkCardAttempt(NICO, 'att-que-no-existe', {}))).toBe(
      'forbidden:403',
    );
  });
  it('un intento de un perfil no se comprueba desde otro', async () => {
    const s = server();
    const a = await attempt(s, NICO, { payment: 'pay-pend-1' });
    expect(await code(s.checkCardAttempt(LUCIA, a.attemptId, {}))).toBe(
      'forbidden:403',
    );
  });
  it('sin red falla; con el CRM caído, no se puede crear un intento y las lecturas siguen', async () => {
    expect(
      await code(server('family', { offline: true }).getProfilePayments(LUCIA)),
    ).toMatch(/^network/);
    const s = server('family', { crmDown: true });
    expect(await code(s.getProfilePayments(LUCIA))).toBe('ok');
    expect(await code(attempt(s, NICO, { payment: 'pay-pend-1' }))).toBe(
      'crm_unavailable:503',
    );
  });
});
