/**
 * «Forma de pago» (05/11/2026): el contrato y la lógica pura.
 *
 *   · Los esquemas aceptan lo que toca y rechazan lo demás (estrictos: un IBAN entero no cuela en la lectura, ni un campo de más en el cuerpo).
 *   · Las dos rutas están en el catálogo y NADA se guarda en el móvil.
 *   · IBAN: módulo 97, país SEPA y tapado («ES93 •••• 8644»).
 *   · Lo que se enseña, se valida y se manda: el resumen, la fila de «Datos de Lucía», los errores por campo y el cuerpo del `PUT`.
 */
import {
  PaymentMethodInfo,
  PaymentMethodKind,
  PaymentMethodRead,
  PaymentMethodSaved,
  PaymentMethodWrite,
  ROUTES,
} from '@/services/comunica/contract';
import {
  isSepaIban,
  isValidIban,
  maskIban,
  normalizeIban,
} from '@/utils/comunica/iban';
import {
  buildPaymentMethodWrite,
  currentLine,
  FIELD_OF_REASON,
  formFromInfo,
  isDirty,
  memberRow,
  PAYMENT_METHOD_COPY,
  PAYMENT_METHOD_ERRORS,
  paymentMethodErrors,
  paymentMethodSummary,
  savedMessage,
} from '@/utils/comunica/paymentMethod';

// Los de los vectores del plugin (`FormaPagoTest.php`): dígitos de control buenos.
const IBAN_A = 'ES9300494898982516218644';
const IBAN_B = 'ES9121000418450200051332';
const ID = '3b241101-e2bb-4255-8caf-4136c566a962';

const OPTIONS = [
  { kind: 'domiciliacion', label: 'Domiciliación bancaria' },
  { kind: 'transferencia', label: 'Transferencia' },
  { kind: 'bizum', label: 'Bizum' },
] as const;
const info = (over: Partial<PaymentMethodInfo> = {}): PaymentMethodInfo => ({
  kind: null,
  options: [...OPTIONS],
  ibanMasked: null,
  holder: null,
  forName: null,
  ...over,
});
const saved = (over: Partial<PaymentMethodSaved> = {}): PaymentMethodSaved => ({
  ok: true,
  partial: false,
  updated: { commitments: 0, payments: 0, inProgress: 0 },
  flagged: 0,
  current: info(),
  ...over,
});

describe('contrato de «Forma de pago»', () => {
  it('las tres claves, y solo esas', () => {
    expect(PaymentMethodKind.options).toEqual([
      'domiciliacion',
      'transferencia',
      'bizum',
    ]);
    expect(PaymentMethodKind.safeParse('cargo_cuenta').success).toBe(false);
    expect(PaymentMethodKind.safeParse('efectivo').success).toBe(false);
  });

  it('la lectura admite lo guardado y lo que no hay', () => {
    expect(
      PaymentMethodInfo.parse(
        info({
          kind: 'domiciliacion',
          ibanMasked: 'ES93 •••• 8644',
          holder: 'Marta',
        }),
      ).ibanMasked,
    ).toBe('ES93 •••• 8644');
    expect(PaymentMethodInfo.parse(info()).kind).toBeNull();
  });

  it('la lectura es estricta: ni un IBAN entero ni un campo de más', () => {
    expect(
      PaymentMethodInfo.safeParse({ ...info(), iban: IBAN_A }).success,
    ).toBe(false);
    expect(
      PaymentMethodInfo.safeParse({ ...info(), kind: 'cargo_cuenta' }).success,
    ).toBe(false);
    const { forName: _forName, ...sinNombre } = info();
    expect(PaymentMethodInfo.safeParse(sinNombre).success).toBe(false);
  });

  it('el GET lleva además `generatedAt` (`PaymentMethodRead`), también estricto', () => {
    const read = { ...info(), generatedAt: '2026-11-05T10:00:00+01:00' };
    expect(PaymentMethodRead.parse(read).generatedAt).toBe(read.generatedAt);
    // Sin hora, con una hora sin zona o con un IBAN entero, no vale.
    expect(PaymentMethodRead.safeParse(info()).success).toBe(false);
    expect(
      PaymentMethodRead.safeParse({
        ...read,
        generatedAt: '2026-11-05 10:00:00',
      }).success,
    ).toBe(false);
    expect(PaymentMethodRead.safeParse({ ...read, iban: IBAN_A }).success).toBe(
      false,
    );
    // `current` de lo guardado NO lleva hora: el estricto de a secas no admite una lectura.
    expect(PaymentMethodInfo.safeParse(read).success).toBe(false);
  });

  it('el cuerpo: forma obligatoria, IBAN y titular opcionales, un `clientId` uuid y nada más', () => {
    expect(
      PaymentMethodWrite.parse({ clientId: ID, kind: 'transferencia' }).kind,
    ).toBe('transferencia');
    expect(
      PaymentMethodWrite.safeParse({
        clientId: ID,
        kind: 'domiciliacion',
        iban: IBAN_A,
        holder: 'Marta',
      }).success,
    ).toBe(true);
    for (const bad of [
      { kind: 'bizum' },
      { clientId: 'no-es-uuid', kind: 'bizum' },
      { clientId: ID, kind: 'cargo_cuenta' },
      { clientId: ID, kind: 'bizum', iban: 'x'.repeat(61) },
      { clientId: ID, kind: 'bizum', holder: 'x'.repeat(256) },
      // Quién paga no viaja nunca en el cuerpo.
      { clientId: ID, kind: 'bizum', payerId: 'f-per-otro' },
    ])
      expect(PaymentMethodWrite.safeParse(bad).success).toBe(false);
  });

  it('la respuesta de guardar trae lo releído y los recuentos', () => {
    expect(PaymentMethodSaved.parse(saved()).partial).toBe(false);
    expect(
      PaymentMethodSaved.safeParse({
        ...saved(),
        updated: { commitments: -1, payments: 0, inProgress: 0 },
      }).success,
    ).toBe(false);
    expect(
      PaymentMethodSaved.safeParse({ ...saved(), ok: false }).success,
    ).toBe(false);
    expect(
      PaymentMethodSaved.safeParse({ ...saved(), current: undefined }).success,
    ).toBe(false);
  });

  it('las dos rutas están en el catálogo y NADA se guarda en el móvil', () => {
    expect(ROUTES.paymentMethod).toMatchObject({
      method: 'GET',
      path: '/v1/profiles/:pid/payment-method',
      persist: false,
    });
    expect(ROUTES.updatePaymentMethod).toMatchObject({
      method: 'PUT',
      path: '/v1/profiles/:pid/payment-method',
      persist: false,
    });
    expect(ROUTES.paymentMethod.response).toBe(PaymentMethodRead);
    expect(ROUTES.updatePaymentMethod.response).toBe(PaymentMethodSaved);
  });
});

describe('IBAN', () => {
  it('módulo 97: los buenos pasan y uno con los dígitos de control malos, no', () => {
    expect(isValidIban(IBAN_A)).toBe(true);
    expect(isValidIban('es93 0049 4898 9825 1621 8644')).toBe(true);
    expect(isValidIban('ES0000000000000000000000')).toBe(false);
    expect(isValidIban('ES1234')).toBe(false);
  });

  it('SEPA: España, Alemania y Reino Unido sí; Brasil pasa el módulo 97 pero no vale para domiciliar', () => {
    expect(isSepaIban(IBAN_A)).toBe(true);
    expect(isSepaIban('DE89370400440532013000')).toBe(true);
    expect(isSepaIban('GB82WEST12345698765432')).toBe(true);
    expect(isValidIban('BR1800360305000010009795493C1')).toBe(true);
    expect(isSepaIban('BR1800360305000010009795493C1')).toBe(false);
  });

  it('tapado: los cuatro primeros, un hueco y los cuatro últimos; con ocho o menos, «••••»', () => {
    expect(maskIban(IBAN_A)).toBe('ES93 •••• 8644');
    expect(maskIban('es91 2100 0418 4502 0005 1332')).toBe('ES91 •••• 1332');
    expect(maskIban('ES1234')).toBe('••••');
    expect(maskIban('ES123456')).toBe('••••');
    expect(maskIban('')).toBe('');
    expect(maskIban(IBAN_A)).not.toContain('2516');
    expect(normalizeIban(maskIban(IBAN_A))).not.toBe(IBAN_A);
  });
});

describe('lo que se enseña de lo guardado', () => {
  it('«Ahora mismo» con domiciliación lleva la cuenta tapada y el titular', () => {
    const i = info({
      kind: 'domiciliacion',
      ibanMasked: 'ES93 •••• 8644',
      holder: 'Marta Pérez',
    });
    expect(currentLine(i)).toBe(
      'Ahora mismo: Domiciliación bancaria · ES93 •••• 8644 · titular: Marta Pérez.',
    );
  });

  it('con transferencia, la cuenta y el titular que hubiera NO se enseñan', () => {
    const i = info({
      kind: 'transferencia',
      ibanMasked: 'ES93 •••• 8644',
      holder: 'Marta Pérez',
    });
    expect(currentLine(i)).toBe('Ahora mismo: Transferencia.');
    expect(paymentMethodSummary(i)).toBe('Transferencia');
  });

  it('sin nada guardado (o una clave que ya no se ofrece): «Todavía no has indicado cómo pagas.»', () => {
    expect(currentLine(info())).toBe('Todavía no has indicado cómo pagas.');
    expect(
      paymentMethodSummary(
        info({ kind: 'domiciliacion', options: [OPTIONS[1], OPTIONS[2]] }),
      ),
    ).toBe('');
  });

  it('la fila de «Datos de Lucía»: la tuya + «Cambiar», o «Indicarla»', () => {
    expect(
      memberRow(
        info({
          kind: 'domiciliacion',
          ibanMasked: 'ES93 •••• 8644',
          holder: 'Marta',
        }),
      ),
    ).toEqual({
      subtitle:
        'La tuya, Domiciliación bancaria · ES93 •••• 8644 · titular: Marta.',
      action: 'Cambiar',
    });
    expect(memberRow(info())).toEqual({
      subtitle: 'Todavía no has indicado la tuya.',
      action: 'Indicarla',
    });
  });

  it('el contexto de un menor dice «tu» y el nombre dos veces', () => {
    const c = PAYMENT_METHOD_COPY.contextFor('Lucía');
    expect(`${c.before}${c.strong}${c.after}`).toBe(
      'Es tu forma de pago, no la de Lucía: con ella se cobran las actividades de Lucía.',
    );
  });
});

describe('el formulario', () => {
  it('empieza con la forma guardada, el IBAN VACÍO y el titular guardado o el nombre de quien paga', () => {
    const i = info({
      kind: 'domiciliacion',
      ibanMasked: 'ES93 •••• 8644',
      holder: 'Marta Pérez',
    });
    expect(formFromInfo(i, 'Marta Villarroya')).toEqual({
      kind: 'domiciliacion',
      iban: '',
      holder: 'Marta Pérez',
    });
    expect(formFromInfo(info(), 'Pablo Soler')).toEqual({
      kind: null,
      iban: '',
      holder: 'Pablo Soler',
    });
  });

  it('solo hay cambios si cambia algo (el nombre por defecto no lo es)', () => {
    const i = info();
    const base = formFromInfo(i, 'Pablo');
    expect(isDirty(i, base, 'Pablo')).toBe(false);
    expect(isDirty(i, { ...base, kind: 'bizum' }, 'Pablo')).toBe(true);
    // Con otro medio, lo escrito en el IBAN no viaja: no cuenta como cambio.
    expect(isDirty(i, { ...base, kind: null, iban: IBAN_A }, 'Pablo')).toBe(
      false,
    );
    expect(
      isDirty(i, { ...base, kind: 'domiciliacion', iban: IBAN_A }, 'Pablo'),
    ).toBe(true);
  });

  it('hay que elegir una forma', () => {
    expect(paymentMethodErrors(info(), formFromInfo(info(), 'P'))).toEqual({
      kind: 'Elige cómo quieres pagar.',
    });
  });

  it('con domiciliación: IBAN válido (módulo 97 y SEPA) y titular', () => {
    const none = info();
    const f = (iban: string, holder = 'Marta') => ({
      kind: 'domiciliacion' as const,
      iban,
      holder,
    });
    expect(paymentMethodErrors(none, f('ES0000000000000000000000'))).toEqual({
      iban: PAYMENT_METHOD_ERRORS.iban,
    });
    expect(
      paymentMethodErrors(none, f('BR1800360305000010009795493C1')),
    ).toEqual({ iban: PAYMENT_METHOD_ERRORS.iban });
    expect(paymentMethodErrors(none, f(''))).toEqual({
      iban: PAYMENT_METHOD_ERRORS.iban,
    });
    expect(paymentMethodErrors(none, f(IBAN_A, '   '))).toEqual({
      holder: PAYMENT_METHOD_ERRORS.holder,
    });
    expect(
      paymentMethodErrors(none, f('es93 0049 4898 9825 1621 8644')),
    ).toEqual({});
  });

  it('con un IBAN y un titular ya guardados, dejarlos vacíos vale (se quedan los de antes)', () => {
    const had = info({
      kind: 'domiciliacion',
      ibanMasked: 'ES93 •••• 8644',
      holder: 'Marta',
    });
    expect(
      paymentMethodErrors(had, { kind: 'domiciliacion', iban: '', holder: '' }),
    ).toEqual({});
    // Pero uno escrito y malo, no.
    expect(
      paymentMethodErrors(had, {
        kind: 'domiciliacion',
        iban: 'ES1234',
        holder: 'Marta',
      }),
    ).toEqual({ iban: PAYMENT_METHOD_ERRORS.iban });
  });

  it('con transferencia o Bizum, ni IBAN ni titular se miran', () => {
    for (const kind of ['transferencia', 'bizum'] as const)
      expect(
        paymentMethodErrors(info(), { kind, iban: 'basura', holder: '' }),
      ).toEqual({});
  });

  it('el cuerpo del `PUT`: con otro medio, solo la forma; con domiciliación, el IBAN limpio solo si se escribió', () => {
    expect(
      buildPaymentMethodWrite({ kind: 'bizum', iban: IBAN_A, holder: 'Marta' }),
    ).toEqual({ kind: 'bizum' });
    expect(
      buildPaymentMethodWrite({
        kind: 'domiciliacion',
        iban: 'es93 0049 4898 9825 1621 8644',
        holder: '  Marta Pérez ',
      }),
    ).toEqual({ kind: 'domiciliacion', iban: IBAN_A, holder: 'Marta Pérez' });
    expect(
      buildPaymentMethodWrite({
        kind: 'domiciliacion',
        iban: '',
        holder: 'Marta',
      }),
    ).toEqual({ kind: 'domiciliacion', holder: 'Marta' });
    expect(() =>
      buildPaymentMethodWrite({ kind: null, iban: '', holder: '' }),
    ).toThrow();
  });

  it('los motivos del servidor señalan su campo', () => {
    expect(FIELD_OF_REASON).toEqual({
      invalid_kind: 'kind',
      invalid_iban: 'iban',
      invalid_holder: 'holder',
    });
  });
});

describe('los mensajes de guardado (las frases del plugin)', () => {
  it('«Listo» a secas si no ha habido nada que llevar a lo pendiente', () => {
    expect(savedMessage(saved())).toBe(
      'Listo: tu forma de pago está guardada.',
    );
  });

  it('los pagos cambiados, en singular y en plural', () => {
    expect(
      savedMessage(
        saved({ updated: { commitments: 1, payments: 1, inProgress: 0 } }),
      ),
    ).toBe(
      'Listo: tu forma de pago está guardada. Hemos puesto la cuenta nueva en 1 pago pendiente de cobro.',
    );
    expect(
      savedMessage(
        saved({ updated: { commitments: 2, payments: 3, inProgress: 0 } }),
      ),
    ).toContain('Hemos puesto la cuenta nueva en 3 pagos pendientes de cobro.');
  });

  it('un recibo en curso y el aviso a tesorería, con el texto de la revisión', () => {
    const t = savedMessage(
      saved({
        updated: { commitments: 2, payments: 3, inProgress: 1 },
        flagged: 2,
      }),
    );
    expect(t).toBe(
      'Listo: tu forma de pago está guardada. ' +
        'Hemos puesto la cuenta nueva en 3 pagos pendientes de cobro. ' +
        'Hay un recibo que ya está en curso (en remesa o devuelto): ese no se cambia, y tesorería lo revisará con vosotros. ' +
        'Hemos avisado a tesorería de que ya no quieres domiciliar.',
    );
    expect(t).not.toContain('ya está en remesa o se ha devuelto');
  });

  it('el parcial, los errores y «no se puede leer» son los del plugin', () => {
    expect(PAYMENT_METHOD_ERRORS.partial).toBe(
      'Tu forma de pago está guardada, pero no hemos podido cambiar la cuenta en algún pago pendiente. Avisa a tesorería de tu delegación para que lo revise.',
    );
    expect(PAYMENT_METHOD_ERRORS.kind).toBe('Elige cómo quieres pagar.');
    expect(PAYMENT_METHOD_ERRORS.iban).toBe(
      'Ese IBAN no parece válido. Revisa que lo hayas copiado entero.',
    );
    expect(PAYMENT_METHOD_ERRORS.holder).toBe(
      'Escribe el nombre del titular de la cuenta.',
    );
    expect(PAYMENT_METHOD_ERRORS.generic).toBe(
      'No hemos podido guardarlo. Inténtalo de nuevo en un momento.',
    );
    expect(PAYMENT_METHOD_COPY.unreadable).toBe(
      'No hemos podido leer tu forma de pago ahora mismo. Vuelve a intentarlo en un momento.',
    );
  });
});
