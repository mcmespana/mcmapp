/**
 * «Forma de pago» (05/11/2026): el servidor falso, portado como el de verdad y como el plugin (`comunicaAreaPrivada:tests/FormaPagoTest.php`, mismos vectores).
 *
 *   · La forma de pago es de QUIEN PAGA: se lee y se escribe la de quien ha entrado, nunca la de `pid`. Lo ajeno, 403 (nunca 404).
 *   · IBAN: módulo 97 y país SEPA; vacío = se queda el guardado; con transferencia o Bizum no se borra. Titular limpio (un espacio duro no es un titular).
 *   · SOLO se lleva la cuenta nueva a lo que no se ha cobrado, y solo cuando se ESCRIBIÓ un IBAN; solo se escribe lo que cambia; todo o nada por compromiso.
 *   · Dejar la domiciliación no cambia ninguna cuenta: deja una nota, una sola vez por medio.
 *   · Ninguna cuenta ENTERA en una descripción ni en una respuesta.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import {
  classifyCommitment,
  cleanHolder,
  FAKE_IBAN_A,
  FAKE_IBAN_B,
} from '@/services/comunica/fake/profilePaymentMethod';
import {
  PaymentMethodRead,
  PaymentMethodSaved,
} from '@/services/comunica/contract';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import { uuidV4 } from '@/utils/comunica/uuid';

const LUCIA = 'f-hijo-lucia';
const NICO = 'f-hijo-sin-nombre';
const MARTA = 'f-per-familia';
const server = (persona: PersonaId = 'family', patch = {}) =>
  createFakeServer({ latencyMs: 0, persona, ...patch });
type Server = ReturnType<typeof server>;
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) =>
      `${e.code}:${e.status}${e.reason ? `:${e.reason}` : ''}`,
  );
const me = (s: Server, p: PersonaId = 'family') => s.data.personas[p].personId;
const put = (
  s: Server,
  pid: string,
  body: { kind: string; iban?: string; holder?: string },
) => s.savePaymentMethod(pid, { clientId: uuidV4(), ...body } as never);
const domiciliar = (s: Server, iban: string, holder?: string) =>
  put(s, me(s), { kind: 'domiciliacion', iban, ...(holder ? { holder } : {}) });
const commitmentsOf = (s: Server, payer = MARTA) =>
  Object.fromEntries(
    s.paymentMethodState(payer).commitments.map((c) => [c.id, c]),
  );
const accountsOf = (s: Server) =>
  Object.fromEntries(
    s
      .paymentMethodState(MARTA)
      .commitments.flatMap((c) => c.payments)
      .map((p) => [p.id, p.bankAccount]),
  );
const SEPA_OTHER = 'DE89370400440532013000';

describe('qué compromisos se pueden tocar (la regla del propietario)', () => {
  const dd = { method: 'direct_debit', endDate: '' };
  const pay = (id: string, status: string, method = 'direct_debit') => ({
    id,
    status,
    method,
  });
  const T = '2026-11-05';

  it('uno con un pago sin remesar se toca, y solo ese pago', () => {
    expect(
      classifyCommitment(dd, [pay('p1', 'paid'), pay('p2', 'not_remitted')], T),
    ).toEqual({ state: 'tocable', pending: ['p2'] });
  });

  it('con todos los pagos hechos o anulados no se toca', () => {
    expect(
      classifyCommitment(dd, [pay('p1', 'paid'), pay('p2', 'cancelled')], T),
    ).toEqual({ state: 'sin_pendientes', pending: [] });
  });

  it('un recibo remesado, impagado, a recobrar, vacío o desconocido deja el compromiso como está', () => {
    for (const status of [
      'remitted',
      'unpaid',
      'to_recover',
      'lo_que_sea',
      '',
    ]) {
      expect(
        classifyCommitment(
          dd,
          [pay('p1', 'not_remitted'), pay('p2', status)],
          T,
        ),
      ).toEqual({ state: 'en_curso', pending: [] });
    }
  });

  it('solo las domiciliaciones vigentes: otro medio, uno terminado (también el que acaba hoy) o apagado a mano, no', () => {
    const p = [pay('p1', 'not_remitted')];
    expect(
      classifyCommitment({ method: 'transfer_received', endDate: '' }, p, T)
        .state,
    ).toBe('no_domiciliado');
    expect(
      classifyCommitment({ method: 'card', endDate: '' }, p, T).state,
    ).toBe('no_domiciliado');
    expect(
      classifyCommitment({ ...dd, endDate: '2026-11-05' }, p, T).state,
    ).toBe('terminado');
    expect(
      classifyCommitment({ ...dd, endDate: '2026-10-01' }, p, T).state,
    ).toBe('terminado');
    expect(
      classifyCommitment({ ...dd, endDate: '2026-12-31' }, p, T).state,
    ).toBe('tocable');
    expect(
      classifyCommitment({ ...dd, endDate: '0000-00-00' }, p, T).state,
    ).toBe('tocable');
    // `active = 0` explícito y sin fecha de fin: apagado a mano. Sin el dato, no se inventa.
    expect(classifyCommitment({ ...dd, active: '0' }, p, T).state).toBe(
      'terminado',
    );
    expect(classifyCommitment({ ...dd, active: '1' }, p, T).state).toBe(
      'tocable',
    );
    expect(classifyCommitment({ ...dd, active: null }, p, T).state).toBe(
      'tocable',
    );
  });

  it('un «No remesado» que no es una domiciliación (el recurrente por tarjeta) es algo en curso', () => {
    expect(
      classifyCommitment(dd, [pay('p1', 'not_remitted', 'card')], T).state,
    ).toBe('en_curso');
  });
});

describe('el titular, limpio', () => {
  it('sin espacios de más, duros incluidos, y sin entidades', () => {
    expect(cleanHolder('  Marta   Pérez  ')).toBe('Marta Pérez');
    expect(cleanHolder('&nbsp;')).toBe('');
    expect(cleanHolder('   ')).toBe('');
    expect(cleanHolder('Mar&amp;ta')).toBe('Mar&ta');
  });
  it('una etiqueta de verdad se va; un «<3» suelto pierde solo el signo, no el resto del nombre', () => {
    expect(cleanHolder('Marta <b>Pérez</b>')).toBe('Marta Pérez');
    expect(cleanHolder('Marta  <3  Pérez')).toBe('Marta 3 Pérez');
    expect(cleanHolder('Marta &lt;script&gt;alert(1)&lt;/script&gt;')).toBe(
      'Marta alert(1)',
    );
  });
  it('255 como mucho', () => {
    expect(cleanHolder('x'.repeat(300))).toHaveLength(255);
  });
});

describe('leer', () => {
  it('lo guardado, con la cuenta TAPADA y las tres formas en su orden', async () => {
    const s = server();
    const r = PaymentMethodRead.parse(await s.getPaymentMethod(me(s)));
    expect(r.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.kind).toBe('domiciliacion');
    expect(r.ibanMasked).toBe('ES93 •••• 8644');
    expect(r.holder).toBe('Marta Villarroya Pons');
    expect(r.options).toEqual([
      { kind: 'domiciliacion', label: 'Domiciliación bancaria' },
      { kind: 'transferencia', label: 'Transferencia' },
      { kind: 'bizum', label: 'Bizum' },
    ]);
    expect(r.forName).toBeNull();
    expect(JSON.stringify(r)).not.toContain(FAKE_IBAN_A);
    expect(JSON.stringify(r)).not.toContain('2516218644');
  });

  it('quien no ha indicado nada: forma, cuenta y titular a `null`', async () => {
    const s = server('familyOne');
    expect(await s.getPaymentMethod(me(s, 'familyOne'))).toMatchObject({
      kind: null,
      ibanMasked: null,
      holder: null,
    });
  });

  it('viendo a un hijo: es la de quien ha entrado (no la del hijo) y `forName` dice a quién se mira', async () => {
    const s = server();
    const own = await s.getPaymentMethod(me(s));
    const lucia = await s.getPaymentMethod(LUCIA);
    expect({ ...lucia, generatedAt: '' }).toEqual({
      ...own,
      generatedAt: '',
      forName: 'Lucía',
    });
    // Un hijo sin nombre: `null`, para que la pantalla no invente «no la de undefined».
    expect((await s.getPaymentMethod(NICO)).forName).toBeNull();
  });

  it('un perfil que no es de quien ha entrado: 403, nunca 404, al leer y al guardar', async () => {
    const s = server();
    expect(await code(s.getPaymentMethod('f-otra-persona'))).toBe(
      'forbidden:403',
    );
    expect(await code(put(s, 'f-otra-persona', { kind: 'bizum' }))).toBe(
      'forbidden:403',
    );
    // Ni el hijo de otra familia.
    expect(await code(s.getPaymentMethod('f-hijo-nico'))).toBe('forbidden:403');
  });

  it('el CRM caído en una lectura es `crm_unavailable` (la pantalla no pinta un formulario a ciegas)', async () => {
    const s = server('family', { failRoute: 'paymentMethod' });
    expect(await code(s.getPaymentMethod(me(s)))).toBe('crm_unavailable:503');
  });
});

describe('validar lo que se guarda', () => {
  it('una forma que no se ofrece: `invalid_kind`', async () => {
    const s = server();
    for (const kind of ['', 'efectivo', 'cargo_cuenta', 'direct_debit']) {
      expect(await code(put(s, me(s), { kind }))).toBe(
        'validation:422:invalid_kind',
      );
    }
  });

  it('domiciliación exige un IBAN válido y un titular', async () => {
    const s = server('familyOne');
    const pid = me(s, 'familyOne');
    const d = (iban: string, holder: string) =>
      put(s, pid, { kind: 'domiciliacion', iban, holder });
    expect(await code(d('ES0000000000000000000000', 'Pablo'))).toBe(
      'validation:422:invalid_iban',
    );
    expect(await code(d('', 'Pablo'))).toBe('validation:422:invalid_iban');
    expect(await code(d(FAKE_IBAN_A, '   '))).toBe(
      'validation:422:invalid_holder',
    );
    expect(await code(d(FAKE_IBAN_A, '&nbsp;'))).toBe(
      'validation:422:invalid_holder',
    );
    expect(s.writeCount).toBe(0);
  });

  it('un IBAN que no es de un país SEPA no vale para domiciliar (Brasil pasa el módulo 97)', async () => {
    const s = server('familyOne');
    const pid = me(s, 'familyOne');
    expect(
      await code(
        put(s, pid, {
          kind: 'domiciliacion',
          iban: 'BR1800360305000010009795493C1',
          holder: 'Pablo',
        }),
      ),
    ).toBe('validation:422:invalid_iban');
    for (const iban of [SEPA_OTHER, 'GB82WEST12345698765432']) {
      expect(
        await code(
          put(s, pid, { kind: 'domiciliacion', iban, holder: 'Pablo' }),
        ),
      ).toBe('ok');
    }
  });

  it('un IBAN bueno se guarda sin espacios ni minúsculas, y el titular, limpio', async () => {
    const s = server();
    const r = await domiciliar(
      s,
      'es91 2100 0418 4502 0005 1332',
      'Marta  <3  Pérez',
    );
    expect(r.current.ibanMasked).toBe('ES91 •••• 1332');
    expect(r.current.holder).toBe('Marta 3 Pérez');
    expect(s.paymentMethodState(MARTA).stored).toEqual({
      kind: 'domiciliacion',
      iban: FAKE_IBAN_B,
      holder: 'Marta 3 Pérez',
    });
  });

  it('dejar el IBAN vacío mantiene el que había y NO propaga; guardar solo el titular tampoco pisa los compromisos', async () => {
    const s = server();
    const r = await put(s, me(s), {
      kind: 'domiciliacion',
      iban: '',
      holder: 'Marta Pérez',
    });
    expect(r.current.holder).toBe('Marta Pérez');
    expect(s.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_A);
    expect(r.updated).toEqual({ commitments: 0, payments: 0, inProgress: 0 });
    expect(r.flagged).toBe(0);
    for (const c of Object.values(commitmentsOf(s)))
      expect(c.description).not.toContain('[Área privada');
  });

  it('con transferencia el IBAN y el titular que había NO se pierden', async () => {
    const s = server();
    const r = await put(s, me(s), { kind: 'transferencia', iban: 'basura' });
    expect(r.current.kind).toBe('transferencia');
    expect(r.current.ibanMasked).toBe('ES93 •••• 8644');
    expect(r.current.holder).toBe('Marta Villarroya Pons');
    expect(s.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_A);
  });

  it('el cuerpo que no es del contrato es `bad_body`', async () => {
    const s = server();
    expect(
      await code(
        s.savePaymentMethod(me(s), {
          clientId: 'no-es-uuid',
          kind: 'bizum',
        } as never),
      ),
    ).toBe('validation:422:bad_body');
  });
});

describe('llevar la cuenta nueva a lo que no se ha cobrado', () => {
  it('llega solo a lo no cobrado: 2 compromisos, 3 pagos, 1 en curso (que se deja y se cuenta)', async () => {
    const s = server();
    const r = PaymentMethodSaved.parse(await domiciliar(s, FAKE_IBAN_B));
    expect(r.partial).toBe(false);
    expect(r.updated).toEqual({ commitments: 2, payments: 3, inProgress: 1 });
    expect(r.flagged).toBe(0);

    const c = commitmentsOf(s);
    const touched = Object.values(c)
      .filter((x) => x.bankAccount === FAKE_IBAN_B)
      .map((x) => x.id)
      .sort();
    expect(touched).toEqual(['com-campamento', 'com-mensual']);
    // Cobrado, en remesa, otro medio, terminado y apagado: intactos.
    for (const id of [
      'com-cuota-pasada',
      'com-pascua',
      'com-terminado',
      'com-apagado',
    ])
      expect(c[id].bankAccount).toBe(FAKE_IBAN_A);
    expect(c['com-transfer'].bankAccount).toBe('');

    const a = accountsOf(s);
    const nuevos = Object.entries(a)
      .filter(([, v]) => v === FAKE_IBAN_B)
      .map(([k]) => k)
      .sort();
    expect(nuevos).toEqual(['cp-camp-2', 'cp-mens-1', 'cp-mens-2']);
    // Ni un pago hecho, ni uno de un compromiso con un recibo en remesa, ni uno apagado.
    for (const id of [
      'cp-camp-1',
      'cp-cuota-1',
      'cp-pascua-1',
      'cp-pascua-2',
      'cp-term-1',
      'cp-apag-1',
    ])
      expect(a[id]).toBe(FAKE_IBAN_A);
  });

  it('del compromiso solo se toca la cuenta y la descripción; del pago, solo la cuenta', async () => {
    const s = server();
    await domiciliar(s, FAKE_IBAN_B);
    const camp = commitmentsOf(s)['com-campamento'];
    expect(camp.method).toBe('direct_debit');
    expect(camp.payments.map((p) => [p.id, p.status, p.method])).toEqual([
      ['cp-camp-1', 'paid', 'direct_debit'],
      ['cp-camp-2', 'not_remitted', 'direct_debit'],
    ]);
  });

  it('la descripción lleva una nota con las cuentas TAPADAS y conserva lo que había', async () => {
    const s = server();
    s.setControls({ clock: '2026-11-05T10:00:00+01:00' });
    await domiciliar(s, FAKE_IBAN_B);
    const d = commitmentsOf(s)['com-campamento'].description;
    expect(d.startsWith('Campamento de verano\n')).toBe(true);
    expect(d).toContain(
      '[Área privada 05/11/2026] Cuenta de cobro cambiada por la propia persona (de ES93 •••• 8644 a ES91 •••• 1332).',
    );
    for (const c of Object.values(commitmentsOf(s))) {
      expect(c.description).not.toContain(FAKE_IBAN_A);
      expect(c.description).not.toContain(FAKE_IBAN_B);
    }
  });

  it('la fecha de la nota es la de Madrid, no la de UTC', async () => {
    const s = server();
    // 23:30 UTC del 5 es ya el 6 en Madrid.
    s.setControls({ clock: '2026-11-05T23:30:00Z' });
    await domiciliar(s, FAKE_IBAN_B);
    expect(commitmentsOf(s)['com-mensual'].description).toContain(
      '[Área privada 06/11/2026]',
    );
  });

  it('guardar dos veces la misma cuenta no reescribe nada (ni una nota «de ES91 a ES91»)', async () => {
    const s = server();
    await domiciliar(s, FAKE_IBAN_B);
    const antes = JSON.stringify(commitmentsOf(s));
    const r = await domiciliar(s, FAKE_IBAN_B);
    expect(r.updated).toEqual({ commitments: 0, payments: 0, inProgress: 1 });
    expect(r.partial).toBe(false);
    expect(JSON.stringify(commitmentsOf(s))).toBe(antes);
    expect(
      commitmentsOf(s)['com-campamento'].description.match(/\[Área privada/g),
    ).toHaveLength(1);
  });

  it('si el compromiso ya tiene la cuenta pero un pago no, solo se escribe ese pago', async () => {
    const s = server();
    await domiciliar(s, FAKE_IBAN_B);
    s.breakPaymentMethod({ payAccounts: { 'cp-mens-2': FAKE_IBAN_A } });
    const r = await domiciliar(s, FAKE_IBAN_B);
    expect(r.updated).toEqual({ commitments: 0, payments: 1, inProgress: 1 });
    expect(accountsOf(s)['cp-mens-2']).toBe(FAKE_IBAN_B);
  });

  it('si el compromiso no se escribe, sus pagos tampoco, y se dice `partial` (la ficha sí se guardó)', async () => {
    const s = server();
    s.breakPaymentMethod({ failCommitments: ['com-mensual'] });
    const r = await domiciliar(s, FAKE_IBAN_B);
    expect(r.partial).toBe(true);
    expect(r.updated).toEqual({ commitments: 1, payments: 1, inProgress: 1 });
    const a = accountsOf(s);
    expect(a['cp-camp-2']).toBe(FAKE_IBAN_B);
    expect(a['cp-mens-1']).toBe(FAKE_IBAN_A);
    expect(a['cp-mens-2']).toBe(FAKE_IBAN_A);
    expect(s.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_B);
    expect(r.current.ibanMasked).toBe('ES91 •••• 1332');
  });

  it('un compromiso cuyos pagos no se pueden leer enteros no se toca y es `partial`', async () => {
    const s = server();
    s.breakPaymentMethod({ unreadable: ['com-campamento'] });
    const r = await domiciliar(s, FAKE_IBAN_B);
    expect(r.partial).toBe(true);
    expect(commitmentsOf(s)['com-campamento'].bankAccount).toBe(FAKE_IBAN_A);
    expect(r.updated.commitments).toBe(1);
    expect(r.updated.payments).toBe(2);
  });

  it('si el CRM no contesta a los compromisos no se toca nada y es `partial` (la ficha sí se guardó)', async () => {
    const s = server();
    s.breakPaymentMethod({ commitmentsDown: true });
    const r = await domiciliar(s, FAKE_IBAN_B);
    expect(r.partial).toBe(true);
    expect(r.updated).toEqual({ commitments: 0, payments: 0, inProgress: 0 });
    for (const c of Object.values(commitmentsOf(s)))
      expect(c.description).not.toContain('[Área privada');
    expect(s.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_B);
  });
});

describe('dejar la domiciliación', () => {
  it('no cambia ninguna cuenta ni medio: una nota por compromiso domiciliado vigente con algo sin cobrar o en curso', async () => {
    const s = server();
    s.setControls({ clock: '2026-11-05T10:00:00+01:00' });
    const antes = accountsOf(s);
    const r = await put(s, me(s), { kind: 'transferencia' });
    expect(r.flagged).toBe(3);
    expect(r.updated).toEqual({ commitments: 0, payments: 0, inProgress: 0 });
    expect(r.partial).toBe(false);
    expect(accountsOf(s)).toEqual(antes);
    const c = commitmentsOf(s);
    const marcados = Object.values(c)
      .filter((x) =>
        x.description.includes('ha pedido pasar a «Transferencia»'),
      )
      .map((x) => x.id)
      .sort();
    // Campamento, Pascua (un recibo en curso) y la mensual. No: cobrado, otro medio, terminado ni apagado.
    expect(marcados).toEqual(['com-campamento', 'com-mensual', 'com-pascua']);
    expect(c['com-campamento'].description).toContain(
      '[Área privada 05/11/2026] La persona ha pedido pasar a «Transferencia». Revisar este compromiso antes de la próxima remesa.',
    );
    for (const x of Object.values(c)) {
      expect(x.method).toBe(
        x.id === 'com-transfer' ? 'transfer_received' : 'direct_debit',
      );
      if (x.method === 'direct_debit') expect(x.bankAccount).toBe(FAKE_IBAN_A);
    }
  });

  it('una sola vez por medio: guardar otra vez lo mismo no repite la nota; otro medio, sí', async () => {
    const s = server();
    await put(s, me(s), { kind: 'transferencia' });
    expect((await put(s, me(s), { kind: 'transferencia' })).flagged).toBe(0);
    expect(
      commitmentsOf(s)['com-campamento'].description.match(
        /ha pedido pasar a/g,
      ),
    ).toHaveLength(1);
    expect((await put(s, me(s), { kind: 'bizum' })).flagged).toBe(3);
  });

  it('con una domiciliación sin IBAN escrito no se marca nada', async () => {
    const s = server();
    expect(
      (await put(s, me(s), { kind: 'domiciliacion', holder: 'Marta' })).flagged,
    ).toBe(0);
  });
});

describe('de quien paga y nada más', () => {
  it('viendo a Lucía se escribe la ficha de quien ha entrado, no la de Lucía ni la de otra persona', async () => {
    const s = server();
    const otra = server('familyOne');
    const pablo = otra.paymentMethodState('f-per-familia-uno').stored;
    const r = await put(s, LUCIA, {
      kind: 'domiciliacion',
      iban: FAKE_IBAN_B,
      holder: 'Marta Pérez',
    });
    expect(r.current.forName).toBe('Lucía');
    expect(s.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_B);
    expect(s.paymentMethodState(LUCIA).stored).toEqual({
      kind: null,
      iban: '',
      holder: '',
    });
    expect(otra.paymentMethodState('f-per-familia-uno').stored).toEqual(pablo);
  });

  it('el IBAN nunca sale entero, ni al leer ni al guardar', async () => {
    const s = server();
    const r = await domiciliar(s, FAKE_IBAN_B);
    expect(JSON.stringify(r)).not.toContain(FAKE_IBAN_B);
    expect(JSON.stringify(r)).not.toContain('0418450200');
    const g = await s.getPaymentMethod(me(s));
    expect(JSON.stringify(g)).not.toContain(FAKE_IBAN_B);
  });

  it('mismo `clientId`: el mismo resultado y no se vuelve a escribir', async () => {
    const s = server();
    const body = {
      clientId: uuidV4(),
      kind: 'domiciliacion',
      iban: FAKE_IBAN_B,
    } as never;
    const a = await s.savePaymentMethod(me(s), body);
    const writes = s.writeCount;
    const b = await s.savePaymentMethod(me(s), body);
    expect(b).toEqual(a);
    expect(s.writeCount).toBe(writes);
  });

  it('con el CRM caído guardar da `crm_unavailable` y no se escribe nada; leer sigue', async () => {
    const s = server('family', { crmDown: true });
    expect(await code(domiciliar(s, FAKE_IBAN_B))).toBe('crm_unavailable:503');
    expect(s.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_A);
    expect(await code(s.getPaymentMethod(me(s)))).toBe('ok');
  });

  it('sin conexión todo falla como red', async () => {
    const s = server('family', { offline: true });
    expect(await code(s.getPaymentMethod(me(s)))).toBe('network:0');
  });

  it('`reset()` deja el estado como al principio', async () => {
    const s = server();
    await domiciliar(s, FAKE_IBAN_B);
    s.reset();
    s.setControls({ latencyMs: 0 });
    expect(s.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_A);
  });
});
