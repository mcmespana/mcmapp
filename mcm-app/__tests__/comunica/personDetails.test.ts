/**
 * «Mis datos» (plan 12), lógica pura: qué se manda (SOLO lo que cambia), qué se ve, qué formatos no dejan guardar, el documento con su letra y los
 * títulos. Los textos, orden y secciones, contra lo que dice el plugin.
 */
import type { HealthInfo, PersonDetails } from '@/services/comunica/contract';
import { fullDay } from '@/utils/comunica/dates';
import {
  isValidCif,
  isValidDni,
  isValidDocument,
} from '@/utils/comunica/documentId';
import {
  detailChanges,
  detailErrors,
  fillable,
  formFromDetails,
  healthChanges,
  missingToPay,
  visibility,
} from '@/utils/comunica/personDetails';
import { dataTitle } from '@/utils/comunica/profiles';
import { DATOS_COPY, HEALTH_FIELDS } from '@/components/comunica/datos/copy';
import { nativeHrefFor } from '@/services/comunica/links';

const OPT = [{ value: 'a', label: 'A' }];
const base = (over: Partial<PersonDetails> = {}): PersonDetails => ({
  generatedAt: '2026-11-01T10:00:00.000Z',
  sections: [
    'identity',
    'contact',
    'address',
    'photo',
    'mcm',
    'health',
    'consents',
  ],
  identity: {
    firstName: 'Marta',
    lastName: 'Villarroya',
    documentType: 'nif',
    documentNumber: '12345678Z',
    birthDate: '1980-02-14',
  },
  gender: 'female',
  documentSupportNumber: null,
  documentIssueDate: null,
  emailNote: null,
  contact: { email: 'marta@ejemplo.org', mobile: '600', emergencyPhone: null },
  address: {
    street: 'Calle 1',
    city: 'V',
    province: 'C',
    postalCode: '12001',
    region: null,
  },
  photoUrl: null,
  mcm: {
    stage: 'com',
    comLevel: 'crecimiento',
    shirtSize: 'M',
    groupName: 'Búhos',
    localMcm: null,
    scarf: 'green',
    lcIncorporationYear: null,
    memberSince: 2009,
  },
  consents: { dataProtection: true, healthData: null, photos: null },
  options: {
    gender: OPT,
    documentType: OPT,
    stage: OPT,
    comLevel: OPT,
    shirtSize: OPT,
    localMcm: OPT,
    region: OPT,
  },
  ...over,
});

describe('detailChanges: solo lo que cambia', () => {
  it('sin tocar nada, nada', () => {
    const d = base();
    expect(detailChanges(d, formFromDetails(d))).toEqual({});
  });
  it('solo el correo cambiado → { contact: { email } }', () => {
    const d = base();
    const f = { ...formFromDetails(d), email: ' nuevo@ejemplo.org ' };
    expect(detailChanges(d, f)).toEqual({
      contact: { email: 'nuevo@ejemplo.org' },
    });
  });
  it('vaciar un texto es null (sin indicar), no una cadena vacía', () => {
    const d = base();
    const f = { ...formFromDetails(d), mobile: '  ' };
    expect(detailChanges(d, f)).toEqual({ contact: { mobile: null } });
  });
  it('un desplegable vuelve a «Sin indicar» (null)', () => {
    const d = base();
    const f = { ...formFromDetails(d), gender: null };
    expect(detailChanges(d, f)).toEqual({ gender: null });
  });
  it('autorización sin contestar y sin tocar → ausente; encenderla → true; encender y apagar → false; apagar la que estaba → false', () => {
    const d = base();
    const f = formFromDetails(d);
    expect(detailChanges(d, f).consents).toBeUndefined();
    expect(detailChanges(d, { ...f, photos: true }).consents).toEqual({
      photos: true,
    });
    expect(detailChanges(d, { ...f, photos: false }).consents).toEqual({
      photos: false,
    });
    expect(detailChanges(d, { ...f, dataProtection: false }).consents).toEqual({
      dataProtection: false,
    });
    // Nunca se manda `null`: lo que ya estaba sin contestar sigue sin contestar.
    expect(
      detailChanges(d, { ...f, healthData: null }).consents,
    ).toBeUndefined();
  });
  it('lo escondido por la etapa conserva su valor y no se manda', () => {
    const d = base();
    // Etapa COM → se ve «Nivel COM»; cambiar la etapa a LC lo esconde: no viaja aunque el valor «cambie».
    const f = { ...formFromDetails(d), stage: 'lc', comLevel: 'conocimiento' };
    expect(detailChanges(d, f).mcm).toEqual({ stage: 'lc' });
    // El año de LC solo con «LC Incorporado»: sin esa etapa no viaja.
    expect(detailChanges(d, { ...f, lcYear: '2019' }).mcm).toEqual({
      stage: 'lc',
    });
    expect(
      detailChanges(d, { ...f, stage: 'lc_incorporated', lcYear: '2019' }).mcm,
    ).toEqual({
      stage: 'lc_incorporated',
      lcIncorporationYear: 2019,
    });
  });
  it('quien no tiene bloque MCM (un hijo) no manda nada de MCM', () => {
    const d = base({
      sections: [
        'identity',
        'contact',
        'address',
        'photo',
        'health',
        'consents',
      ],
      mcm: null,
    });
    expect(detailChanges(d, formFromDetails(d)).mcm).toBeUndefined();
  });
  it('soporte y expedición solo se mandan si ya tenían valor', () => {
    const none = base();
    expect(
      detailChanges(none, { ...formFromDetails(none), supportNumber: 'X1' }),
    ).toEqual({});
    const has = base({
      documentSupportNumber: 'BAA1',
      documentIssueDate: '2021-03-15',
    });
    const f = {
      ...formFromDetails(has),
      supportNumber: 'BAA2',
      issueDate: '2022-01-01',
    };
    expect(detailChanges(has, f)).toEqual({
      documentSupportNumber: 'BAA2',
      documentIssueDate: '2022-01-01',
    });
  });
  it('el año «desde» se escribe como número y se vacía como null', () => {
    const d = base();
    const f = formFromDetails(d);
    expect(detailChanges(d, { ...f, memberSince: '2010' }).mcm).toEqual({
      memberSince: 2010,
    });
    expect(detailChanges(d, { ...f, memberSince: '' }).mcm).toEqual({
      memberSince: null,
    });
  });
  it('el pañuelo «desconocido» no se manda (solo se lee)', () => {
    const d = base();
    d.mcm!.scarf = 'unknown';
    expect(detailChanges(d, formFromDetails(d))).toEqual({});
  });
});

describe('completar=pago (regla 9)', () => {
  const empty = base({
    identity: {
      firstName: 'Carmen',
      lastName: '',
      documentType: null,
      documentNumber: null,
      birthDate: null,
    },
    contact: { email: null, mobile: null, emergencyPhone: null },
    sections: ['identity', 'contact', 'address', 'photo', 'health', 'consents'],
    mcm: null,
  });
  it('solo se pueden escribir los datos de identidad que están vacíos', () => {
    expect(fillable(empty, true)).toEqual({
      firstName: false,
      lastName: true,
      documentType: true,
      documentNumber: true,
    });
    expect(fillable(empty, false)).toEqual({
      firstName: false,
      lastName: false,
      documentType: false,
      documentNumber: false,
    });
    expect(fillable(base(), true)).toEqual({
      firstName: false,
      lastName: false,
      documentType: false,
      documentNumber: false,
    });
  });
  it('identityFill solo con completar y solo lo vacío; el documento en mayúsculas', () => {
    const f = {
      ...formFromDetails(empty),
      fillFirstName: 'Otra',
      fillLastName: 'Roca',
      fillDocumentType: 'nif',
      fillDocumentNumber: '12345678z',
    };
    expect(detailChanges(empty, f)).toEqual({});
    expect(detailChanges(empty, f, { fill: true }).identityFill).toEqual({
      lastName: 'Roca',
      documentType: 'nif',
      documentNumber: '12345678Z',
    });
  });
  it('el documento mal escrito no deja guardar (NIF con letra mala); pasaporte, libre', () => {
    const f = {
      ...formFromDetails(empty),
      fillDocumentType: 'nif',
      fillDocumentNumber: '12345678A',
    };
    expect(detailErrors(empty, f, { fill: true }).fillDocumentNumber).toBe(
      'El número de documento no es válido.',
    );
    expect(
      detailErrors(
        empty,
        { ...f, fillDocumentNumber: '12345678Z' },
        { fill: true },
      ),
    ).toEqual({});
    expect(
      detailErrors(
        empty,
        { ...f, fillDocumentType: 'passport', fillDocumentNumber: 'AB123' },
        { fill: true },
      ),
    ).toEqual({});
  });
  it('«te faltan datos»: nombre, apellidos, correo y documento', () => {
    expect(missingToPay(empty)).toBe(true);
    expect(missingToPay(base())).toBe(false);
    expect(
      missingToPay(
        base({ contact: { email: null, mobile: null, emergencyPhone: null } }),
      ),
    ).toBe(true);
  });
});

describe('detailErrors: los formatos', () => {
  const d = base();
  const f = formFromDetails(d);
  it('nada es obligatorio: todo vacío no da error', () => {
    expect(
      detailErrors(d, {
        ...f,
        email: '',
        mobile: '',
        postalCode: '',
        memberSince: '',
      }),
    ).toEqual({});
  });
  it('correo con el patrón del plugin', () => {
    for (const ok of [
      'a@b.co',
      'nombre.apellido+x@mi-dominio.org',
      "o'brien@x.es".replace("'", '’'),
    ])
      expect(detailErrors(d, { ...f, email: ok }).email).toBeUndefined();
    for (const bad of ['a', 'a@b', 'a b@c.es', '@x.es', 'a@.es'])
      expect(detailErrors(d, { ...f, email: bad }).email).toBeTruthy();
  });
  it('código postal de cinco cifras', () => {
    expect(
      detailErrors(d, { ...f, postalCode: '12001' }).postalCode,
    ).toBeUndefined();
    for (const bad of ['1200', '120011', '1200a'])
      expect(
        detailErrors(d, { ...f, postalCode: bad }).postalCode,
      ).toBeTruthy();
  });
  it('años: 2019 sí; 19, 20199 y letras no; y entre 1900 y 2100', () => {
    expect(
      detailErrors(d, { ...f, memberSince: '2019' }).memberSince,
    ).toBeUndefined();
    for (const bad of ['19', '20199', 'abcd', '1800', '2101'])
      expect(
        detailErrors(d, { ...f, memberSince: bad }).memberSince,
      ).toBeTruthy();
  });
  it('el año de LC solo se mira si se ve', () => {
    expect(detailErrors(d, { ...f, lcYear: '19' }).lcYear).toBeUndefined();
    expect(
      detailErrors(d, { ...f, stage: 'lc_incorporated', lcYear: '19' }).lcYear,
    ).toBeTruthy();
  });
});

describe('visibility', () => {
  it('COM enseña «Nivel COM»; LC Incorporado, el año; soporte y expedición solo con valor', () => {
    const d = base();
    const f = formFromDetails(d);
    expect(visibility(d, f)).toMatchObject({
      comLevel: true,
      lcYear: false,
      support: false,
      issueDate: false,
    });
    expect(visibility(d, { ...f, stage: 'lc_incorporated' })).toMatchObject({
      comLevel: false,
      lcYear: true,
    });
    const has = base({
      documentSupportNumber: 'BAA1',
      documentIssueDate: '2021-03-15',
    });
    expect(visibility(has, formFromDetails(has))).toMatchObject({
      support: true,
      issueDate: true,
    });
  });
  it('las secciones son las que manda el servidor', () => {
    const d = base({ sections: ['identity', 'contact'] });
    expect([...visibility(d, formFromDetails(d)).sections]).toEqual([
      'identity',
      'contact',
    ]);
  });
});

describe('salud: solo los textos que cambian', () => {
  const h: HealthInfo = {
    foodIntolerances: 'Sin gluten',
    allergies: null,
    illnesses: null,
    treatments: null,
    other: null,
  };
  it('nada si no cambia; solo lo cambiado; vaciar es null', () => {
    const form = {
      foodIntolerances: 'Sin gluten',
      allergies: '',
      illnesses: '',
      treatments: '',
      other: '',
    };
    expect(healthChanges(h, form)).toEqual({});
    expect(healthChanges(h, { ...form, allergies: ' Polen ' })).toEqual({
      allergies: 'Polen',
    });
    expect(healthChanges(h, { ...form, foodIntolerances: '' })).toEqual({
      foodIntolerances: null,
    });
  });
});

describe('documento con su letra (validateId del plugin)', () => {
  it('DNI y NIE con letra buena y mala', () => {
    expect(isValidDni('12345678Z')).toBe(true);
    expect(isValidDni('12345678z')).toBe(true);
    expect(isValidDni('12345678A')).toBe(false);
    expect(isValidDni('X1234567L')).toBe(true);
    expect(isValidDni('X1234567A')).toBe(false);
    expect(isValidDni('1234')).toBe(false);
  });
  it('CIF con su control', () => {
    expect(isValidCif('A58818501')).toBe(true);
    expect(isValidCif('A58818502')).toBe(false);
    expect(isValidCif('1234')).toBe(false);
  });
  it('pasaporte y otros, libres (con algo escrito)', () => {
    expect(isValidDocument('passport', 'AB 123')).toBe(true);
    expect(isValidDocument('passport', '  ')).toBe(false);
    expect(isValidDocument('nif', '12345678Z')).toBe(true);
    expect(isValidDocument('cif', 'A58818501')).toBe(true);
  });
});

describe('títulos y fechas', () => {
  it('«Mis datos», «Datos de María» para «María José» y «Datos del participante» sin nombre', () => {
    expect(dataTitle({ firstName: 'Lucía' }, true)).toBe('Mis datos');
    expect(dataTitle({ firstName: 'María José' }, false)).toBe(
      'Datos de María',
    );
    expect(dataTitle({ firstName: null }, false)).toBe(
      'Datos del participante',
    );
  });
  it('la fecha de nacimiento en lenguaje humano', () => {
    expect(fullDay('2014-05-05')).toBe('5 de mayo de 2014');
    expect(fullDay('1980-12-31')).toBe('31 de diciembre de 1980');
  });
});

describe('textos del plugin', () => {
  it('las autorizaciones, en su orden y con sus enlaces', () => {
    expect(
      DATOS_COPY.consents.items.map((c) => [c.key, c.statement, c.url]),
    ).toEqual([
      [
        'dataProtection',
        'Acepto las condiciones sobre protección de datos',
        'https://comunica.movimientoconsolacion.com/legal-rgpd',
      ],
      [
        'healthData',
        'Acepto las condiciones sobre el uso de mis datos de salud',
        'https://comunica.movimientoconsolacion.com/legal-salud',
      ],
      [
        'photos',
        'Acepto las condiciones sobre la cesión de imágenes',
        'https://comunica.movimientoconsolacion.com/legal-imagenes',
      ],
    ]);
  });
  it('la salud, sus cinco textos en el orden del plugin', () => {
    expect(HEALTH_FIELDS.map((k) => DATOS_COPY.health[k].label)).toEqual([
      'Intolerancias alimentarias',
      'Alergias',
      'Enfermedades',
      'Tratamientos habituales',
      'Otros datos de salud',
    ]);
  });
  it('las secciones, en el orden del plugin', () => {
    expect(Object.values(DATOS_COPY.sections)).toEqual([
      'Datos personales',
      'Datos de contacto',
      'Dirección',
      'Foto',
      'MCM',
      'Información sanitaria',
      'Autorizaciones legales',
    ]);
  });
  it('los saludos', () => {
    expect(DATOS_COPY.greetingOwn('Marta')).toBe(
      'Hola Marta 👋, estos son los datos que tenemos.',
    );
    expect(DATOS_COPY.greetingChild('Lucía')).toBe(
      'Estos son los datos que tenemos de Lucía.',
    );
  });
});

describe('enlaces del plugin que llegan a «Mis datos»', () => {
  it('la ficha, la del perfil y la genérica van a los datos de a quien se ve', () => {
    for (const internalpage of [
      'single_stic_comunica_perfil',
      'single_stic_profile',
    ])
      expect(nativeHrefFor({ internalpage, action: 'detail' })).toEqual({
        pathname: '/comunica/datos',
      });
  });
  it('la del laico (retirada) y la del familiar son de uno mismo', () => {
    for (const internalpage of [
      'single_stic_comunica_laico',
      'single_stic_tutor_profile',
    ])
      expect(nativeHrefFor({ internalpage })).toEqual({
        pathname: '/comunica/datos',
        params: { yo: '1' },
      });
  });
});
