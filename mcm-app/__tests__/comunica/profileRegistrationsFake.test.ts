/**
 * Inscripciones (plan 14, tarea 2): el servidor falso, portado como el de verdad.
 *
 *   · `pid` ajeno → 403. EL GUARD ES EL SERVIDOR: duplicado, audiencia, plazo y formulario avanzado; después, respuestas y pago.
 *   · Mismo `clientId` = misma inscripción. Curso: no se cancela. El IBAN nunca se guarda ni vuelve.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import { ROUTES } from '@/services/comunica/contract';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import { uuidV4 } from '@/utils/comunica/uuid';

const IBAN = 'ES9121000418450200051332';
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
const signup = (s: Server, pid: string, over: Record<string, unknown> = {}) =>
  s.signUp(pid, {
    clientId: uuidV4(),
    eventId: 'pev-convi',
    answers: [
      { n: 1, option: 1 },
      { n: 2, option: 2 },
    ],
    payment: { method: 'card' },
    specialNeeds: null,
    ...over,
  } as never);

describe('contrato', () => {
  it('la lista se guarda; la ficha y el alta, no (teléfonos, importes, guard de duplicados)', () => {
    expect(ROUTES.profileRegistrations.persist).toBe(true);
    for (const r of [
      'profileRegistration',
      'profileSignupForm',
      'profileSignUp',
      'updateRegistration',
      'cancelRegistration',
      'advancedForm',
    ] as const)
      expect(ROUTES[r].persist).toBe(false);
  });
});

describe('el pid se comprueba', () => {
  it('uno ajeno es 403 en todas', async () => {
    const s = server();
    const other = s.data.personas.memberNoKids.personId;
    expect(await code(s.getProfileRegistrations(other))).toBe('forbidden:403');
    expect(await code(s.getProfileRegistration(other, 'x'))).toBe(
      'forbidden:403',
    );
    expect(await code(s.getSignupForm(other, 'pev-convi'))).toBe(
      'forbidden:403',
    );
    expect(await code(signup(s, other))).toBe('forbidden:403');
    expect(await code(s.getAdvancedFormUrl(other, 'pev-fwa'))).toBe(
      'forbidden:403',
    );
  });
  it('la inscripción de un hermano no se ve con otro pid: 404', async () => {
    const s = server();
    expect(
      await code(s.getProfileRegistration(NICO, 'reg-lucia-sesiones')),
    ).toBe('not_found:404:registration_not_found');
  });
});

describe('la lista y la ficha', () => {
  it('todas las del perfil, con su estado y la de un evento oculto marcada', async () => {
    const s = server();
    const l = await s.getProfileRegistrations(LUCIA);
    expect(l.items.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        'reg-lucia-sesiones',
        'reg-lucia-oculta',
        'reg-lucia-rechazada',
        'reg-lucia-pasada',
        'reg-lucia-curso',
      ]),
    );
    expect(l.items.find((c) => c.id === 'reg-lucia-oculta')?.eventHidden).toBe(
      true,
    );
    expect(l.items.find((c) => c.id === 'reg-lucia-rechazada')?.status).toEqual(
      { label: 'Rechazada', tone: 'danger' },
    );
  });
  it('el pago en cada estado y las fechas siguen al reloj', async () => {
    const s = server('family', { clock: '2026-12-01T10:00:00Z' });
    const paid = await s.getProfileRegistration(LUCIA, 'reg-lucia-pasada');
    expect(paid.payment).toMatchObject({
      state: 'paid',
      amount: 110,
      methodLabel: 'Tarjeta',
      date: '2026-11-01',
      paymentId: 'pay-lucia-110',
    });
    expect(
      (await s.getProfileRegistration(NICO, 'reg-nico-dd')).payment,
    ).toMatchObject({ state: 'direct_debit', date: '2026-12-15' });
    expect(
      (await s.getProfileRegistration(NICO, 'reg-nico-devuelto')).payment.state,
    ).toBe('returned');
    expect(
      (await s.getProfileRegistration(NICO, 'reg-nico-transfer')).payment,
    ).toMatchObject({ state: 'pending', method: 'transfer', amount: 35 });
    expect(
      (await s.getProfileRegistration(NICO, 'reg-nico-card')).payment,
    ).toMatchObject({
      state: 'pending',
      method: 'card',
      paymentId: 'pay-pend-1',
    });
  });
  it('con tutores, y la descripción de necesidades especiales', async () => {
    const s = server();
    const d = await s.getProfileRegistration(NICO, 'reg-nico-card');
    expect(d.contacts.length).toBe(2);
    expect(d.specialNeedsDescription).toContain('gafas');
    expect(d.attendees).toBe(2);
    expect(d.status.tone).toBe('warn');
  });
});

describe('derechos de modificar y cancelar', () => {
  it('abierta: se puede todo, con hasta cuándo', async () => {
    const s = server();
    const d = await s.getProfileRegistration(LUCIA, 'reg-lucia-sesiones');
    expect(d.manage).toMatchObject({
      canEdit: true,
      canCancel: true,
      reason: null,
    });
    expect(d.edit?.specialNeeds.yesValue).toBe('1');
  });
  it('un curso: se modifica pero no se cancela, con su motivo (y cancelar es conflict)', async () => {
    const s = server();
    const d = await s.getProfileRegistration(LUCIA, 'reg-lucia-curso');
    expect(d.manage).toMatchObject({
      canEdit: true,
      canCancel: false,
      reason: 'Para darte de baja del curso, habla con tu delegación.',
    });
    expect(
      await code(
        s.cancelRegistration(LUCIA, 'reg-lucia-curso', { clientId: uuidV4() }),
      ),
    ).toBe('conflict:409:window_closed');
    expect(s.writeCount).toBe(0);
  });
  it('plazo cerrado, rechazada y pasada: ni modificar ni cancelar y no se toca nada', async () => {
    const s = server();
    for (const [pid, id] of [
      [NICO, 'reg-nico-devuelto'],
      [LUCIA, 'reg-lucia-rechazada'],
      [LUCIA, 'reg-lucia-pasada'],
    ] as const) {
      const d = await s.getProfileRegistration(pid, id);
      expect(d.manage.canEdit).toBe(false);
      expect(d.edit).toBeNull();
      expect(
        await code(
          s.updateRegistration(pid, id, { clientId: uuidV4(), answers: [] }),
        ),
      ).toBe('conflict:409:window_closed');
    }
    expect(
      (await s.getProfileRegistration(NICO, 'reg-nico-devuelto')).manage.reason,
    ).toContain('El plazo de inscripción ya ha terminado');
    expect(s.writeCount).toBe(0);
  });
  it('cancelar no borra: queda «Cancelada», el evento vuelve a poder apuntarse y no se toca el pago; el mismo clientId, una sola vez', async () => {
    const s = server();
    const clientId = uuidV4();
    await s.cancelRegistration(LUCIA, 'reg-lucia-sesiones', { clientId });
    await s.cancelRegistration(LUCIA, 'reg-lucia-sesiones', { clientId });
    expect(s.writeCount).toBe(1);
    const d = await s.getProfileRegistration(LUCIA, 'reg-lucia-sesiones');
    expect(d.status).toEqual({ label: 'Cancelada', tone: 'danger' });
    expect(d.manage.canCancel).toBe(false);
    const ev = await s.getProfileEvent(LUCIA, 'pev-sesiones');
    expect(ev.myRegistrationId).toBeNull();
  });
});

describe('apuntarse: el guard es el servidor', () => {
  it('con tarjeta: crea la inscripción y devuelve el pago pendiente', async () => {
    const s = server();
    const r = await signup(s, LUCIA);
    expect(r).toMatchObject({ status: 'applied', payment: 'noted' });
    expect(r.cardPaymentId).toBe(`pay-${r.registrationId}`);
    const d = await s.getProfileRegistration(LUCIA, r.registrationId);
    expect(d.answers).toEqual(['Sí', 'Coche propio']);
    expect(d.payment).toMatchObject({
      state: 'pending',
      amount: 45,
      method: 'card',
    });
    // Y el evento ya sale con plaza.
    expect((await s.getProfileEvent(LUCIA, 'pev-convi')).myRegistrationId).toBe(
      r.registrationId,
    );
  });
  it('con domiciliación: IBAN válido; el IBAN no se guarda ni vuelve en ninguna respuesta', async () => {
    const s = server();
    const r = await signup(s, LUCIA, {
      payment: { method: 'direct_debit', iban: IBAN },
    });
    expect(r.cardPaymentId).toBeNull();
    const d = await s.getProfileRegistration(LUCIA, r.registrationId);
    expect(d.payment.state).toBe('direct_debit');
    expect(
      JSON.stringify([r, d, await s.getProfileRegistrations(LUCIA)]),
    ).not.toContain('ES91');
    expect(JSON.stringify(s.data)).not.toContain('ES91');
  });
  it('IBAN mal, sin IBAN y sin medio: validation `payment`; respuestas sin contestar: `answers`', async () => {
    const s = server();
    expect(
      await code(
        signup(s, LUCIA, { payment: { method: 'direct_debit', iban: 'ES00' } }),
      ),
    ).toBe('validation:422:payment');
    expect(
      await code(signup(s, LUCIA, { payment: { method: 'direct_debit' } })),
    ).toBe('validation:422:payment');
    expect(await code(signup(s, LUCIA, { payment: null }))).toBe(
      'validation:422:payment',
    );
    expect(
      await code(signup(s, LUCIA, { answers: [{ n: 1, option: 1 }] })),
    ).toBe('validation:422:answers');
    expect(
      await code(
        signup(s, LUCIA, {
          answers: [
            { n: 1, option: 1 },
            { n: 2, option: 9 },
          ],
        }),
      ),
    ).toBe('validation:422:answers');
    expect(s.writeCount).toBe(0);
  });
  it('el cuerpo es estricto: ni el IBAN sin domiciliación ni personas', async () => {
    const s = server();
    expect(
      await code(signup(s, LUCIA, { payment: { method: 'card', iban: IBAN } })),
    ).toBe('validation:422:bad_body');
    expect(await code(signup(s, LUCIA, { personId: 'x' }))).toBe(
      'validation:422:bad_body',
    );
  });
  it('duplicado → conflict `already_registered`; otro dispositivo, igual; el mismo clientId devuelve lo mismo', async () => {
    const s = server();
    const clientId = uuidV4();
    const a = await signup(s, LUCIA, { clientId });
    const b = await signup(s, LUCIA, { clientId });
    expect(b).toEqual(a);
    expect(s.writeCount).toBe(1);
    expect(await code(signup(s, LUCIA))).toBe(
      'conflict:409:already_registered',
    );
    const t = server('family', { alreadyRegisteredElsewhere: true });
    expect(await code(signup(t, NICO))).toBe('conflict:409:already_registered');
  });
  it('audiencia, plazo y formulario avanzado', async () => {
    const s = server();
    expect(
      await code(
        signup(s, LUCIA, {
          eventId: 'pev-otra-del',
          answers: [],
          payment: null,
        }),
      ),
    ).toBe('forbidden:403:audience');
    expect(
      await code(
        signup(s, LUCIA, {
          eventId: 'pev-cerrada',
          answers: [],
          payment: null,
        }),
      ),
    ).toBe('conflict:409:window_closed');
    expect(
      await code(
        signup(s, LUCIA, {
          eventId: 'pev-no-abre',
          answers: [],
          payment: null,
        }),
      ),
    ).toBe('conflict:409:window_closed');
    expect(
      await code(
        signup(s, LUCIA, { eventId: 'pev-fwa', answers: [], payment: null }),
      ),
    ).toBe('conflict:409:advanced_form');
  });
  it('el formulario: bloqueos por su orden y medios solo con precio', async () => {
    const s = server();
    expect((await s.getSignupForm(LUCIA, 'pev-sesiones')).blocked).toEqual({
      reason: 'already_registered',
      registrationId: 'reg-lucia-sesiones',
    });
    expect(
      (await s.getSignupForm(LUCIA, 'pev-otra-del')).blocked,
    ).toMatchObject({
      reason: 'audience',
      title: 'Esta actividad no es para ti',
    });
    expect((await s.getSignupForm(LUCIA, 'pev-cerrada')).blocked).toMatchObject(
      { reason: 'window' },
    );
    expect((await s.getSignupForm(LUCIA, 'pev-fwa')).blocked).toEqual({
      reason: 'advanced_form',
    });
    const open = await s.getSignupForm(LUCIA, 'pev-convi');
    expect(open.blocked).toBeNull();
    expect(open.questions).toHaveLength(2);
    expect(open.price).toBe(45);
    expect(open.paymentMethods.map((m) => m.key)).toEqual([
      'direct_debit',
      'card',
    ]);
    const free = await s.getSignupForm(LUCIA, 'pev-sinc');
    expect(free.price).toBeNull();
    expect(free.paymentMethods).toEqual([]);
    expect(await code(s.getSignupForm(LUCIA, 'nope'))).toBe(
      'not_found:404:event_not_found',
    );
  });
  it('mandos: el CRM no genera el pago; falla el pago (la inscripción se queda)', async () => {
    const a = await signup(server('family', { noCardPayment: true }), LUCIA);
    expect(a).toMatchObject({ payment: 'noted', cardPaymentId: null });
    const s = server('family', { paymentFails: true });
    const b = await signup(s, LUCIA);
    expect(b).toMatchObject({ payment: 'error', cardPaymentId: null });
    expect(
      (await s.getProfileRegistration(LUCIA, b.registrationId)).payment.state,
    ).toBe('none');
  });
  it('sin precio: nada que pagar y sin medio', async () => {
    const s = server();
    const r = await signup(s, LUCIA, {
      eventId: 'pev-sinc',
      answers: [],
      payment: null,
    });
    expect(r.payment).toBe('none');
  });
});

describe('modificar y el formulario avanzado', () => {
  it('modificar solo respuestas y necesidades; lo contestado sale marcado; el mismo clientId, una vez', async () => {
    const s = server();
    const r = await signup(s, LUCIA);
    const before = await s.getProfileRegistration(LUCIA, r.registrationId);
    expect(before.edit?.questions.map((q) => q.current)).toEqual([1, 2]);
    const clientId = uuidV4();
    const body = {
      clientId,
      answers: [
        { n: 1, option: 2 },
        { n: 2, option: 3 },
      ],
      specialNeeds: '1',
      specialNeedsDescription: 'Celíaca',
    } as never;
    await s.updateRegistration(LUCIA, r.registrationId, body);
    await s.updateRegistration(LUCIA, r.registrationId, body);
    expect(s.writeCount).toBe(2);
    const after = await s.getProfileRegistration(LUCIA, r.registrationId);
    expect(after.answers).toEqual(['No', 'Otro']);
    expect(after.specialNeedsDescription).toBe('Celíaca');
    expect(
      await code(
        s.updateRegistration(LUCIA, r.registrationId, {
          clientId: uuidV4(),
          answers: [],
          status: 'cancelled',
        } as never),
      ),
    ).toBe('validation:422:bad_body');
    expect(
      await code(
        s.updateRegistration(LUCIA, r.registrationId, {
          clientId: uuidV4(),
          answers: [{ n: 1, option: 1 }],
        }),
      ),
    ).toBe('validation:422:answers');
  });
  it('el formulario avanzado da su URL; en otro evento o ya apuntado, conflict', async () => {
    const s = server();
    const { url } = await s.getAdvancedFormUrl(LUCIA, 'pev-fwa');
    expect(url).toMatch(/^https:\/\//);
    expect(await code(s.getAdvancedFormUrl(LUCIA, 'pev-convi'))).toBe(
      'conflict:409:advanced_form',
    );
  });
  it('sin red falla; con el CRM caído, las escrituras fallan y las lecturas siguen', async () => {
    expect(
      await code(
        server('family', { offline: true }).getProfileRegistrations(LUCIA),
      ),
    ).toMatch(/^network/);
    const s = server('family', { crmDown: true });
    expect(await code(s.getProfileRegistrations(LUCIA))).toBe('ok');
    expect(await code(signup(s, LUCIA))).toBe('crm_unavailable:503');
  });
});
