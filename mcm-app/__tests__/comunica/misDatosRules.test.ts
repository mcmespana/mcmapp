/**
 * «Mis datos» de familias (plan 12, tareas 3 y 4): el motor de formularios,
 * el spec (orden y textos del plugin), el documento y los cuerpos del
 * contrato. Todo puro.
 */
import fs from 'fs';
import path from 'path';
import {
  formChanges,
  validateForm,
  visibleFields,
  type FormValues,
} from '@/utils/comunica/forms';
import { isValidDocument } from '@/utils/comunica/documentId';
import {
  detailsTitle,
  humanDate,
  writesFrom,
} from '@/utils/comunica/personDetails';
import { personDetailsSpec } from '@/utils/comunica/personDetailsSpec';
import {
  DETAIL_SECTIONS,
  HealthWrite,
  PersonDetailsWrite,
} from '@/services/comunica/contract';

const ALL = [...DETAIL_SECTIONS];
const member = (patch = {}) =>
  personDetailsSpec({
    sections: ALL,
    viewingChild: false,
    firstName: 'Marta',
    emailNote: null,
    ...patch,
  });

const base: FormValues = {
  'contact.email': 'marta@correo.es',
  'contact.mobile': '600111222',
  'mcm.stage': 'lc',
  'mcm.comLevel': 'crecimiento',
  'consents.photos': null,
  'consents.healthData': true,
  documentSupportNumber: null,
};

describe('orden y textos del plugin (single_stic_comunica_perfil.php)', () => {
  it('las secciones y sus etiquetas, en orden', () => {
    const spec = member({ emailNote: 'mcm_email_soft' });
    const labels = spec.map((s) => [
      s.title,
      s.fields.filter((f) => f.kind !== 'note').map((f) => f.label),
    ]);
    // Copiado a mano del plugin: si cambia, que sea a propósito.
    expect(labels).toEqual([
      [
        'Datos personales',
        [
          'Nombre',
          'Apellidos',
          'Tipo de identificación',
          'Número de identificación',
          'Fecha de nacimiento',
          'Género',
          'Número de soporte del DNI',
          'Fecha de expedición del DNI',
        ],
      ],
      [
        'Datos de contacto',
        ['Correo electrónico', 'Móvil', 'Contacto de emergencia'],
      ],
      [
        'Dirección',
        [
          'Calle y número',
          'Población',
          'Provincia',
          'Código postal',
          'Comunidad Autónoma',
        ],
      ],
      ['Foto', []],
      [
        'MCM',
        [
          'Etapa',
          'Pañuelo',
          'Nivel COM',
          'Año incorporación LC',
          'Talla de camiseta',
          'Grupo MCM',
          'MCM Local',
          'Pertenezco al MCM desde…',
        ],
      ],
      [
        'Información sanitaria',
        [
          'Intolerancias alimentarias',
          'Alergias',
          'Enfermedades',
          'Tratamientos habituales',
          'Otros datos de salud',
        ],
      ],
      [
        'Autorizaciones legales',
        [
          'Acepto las condiciones sobre protección de datos',
          'Acepto las condiciones sobre el uso de mis datos de salud',
          'Acepto las condiciones sobre la cesión de imágenes',
        ],
      ],
    ]);
  });

  it('el saludo, las notas del correo y lo bloqueado', () => {
    const notes = (spec: ReturnType<typeof member>) =>
      spec.flatMap((s) => s.fields.filter((f) => f.kind === 'note'));
    expect(notes(member())[0].label).toBe(
      'Hola **Marta** 👋, estos son los datos que tenemos.',
    );
    expect(
      notes(member({ viewingChild: true, firstName: 'Lucía' }))[0].label,
    ).toBe('Estos son los datos que tenemos de **Lucía**.');
    expect(
      notes(member({ emailNote: 'mcm_email_warning' })).map((n) => n.label),
    ).toContain(
      'Mejor utiliza tu correo **@movimientoconsolacion.com**: es el que usamos para todas las comunicaciones de monitores.',
    );
    expect(
      notes(member({ emailNote: 'mcm_email_soft' })).map((n) => n.label),
    ).toContain('Si tienes, usa el correo **@movimientoconsolacion.com**.');
    const locked = member()
      .flatMap((s) => s.fields)
      .filter((f) => f.kind === 'locked')
      .map((f) => f.key);
    expect(locked).toEqual([
      'identity.firstName',
      'identity.lastName',
      'identity.documentType',
      'identity.documentNumber',
      'identity.birthDate',
    ]);
  });

  it('sin la sección MCM para un hijo o un familiar', () => {
    const spec = member({ sections: ALL.filter((s) => s !== 'mcm') });
    expect(spec.map((s) => s.id)).not.toContain('mcm');
    expect(spec.map((s) => s.id)).toContain('health');
  });
});

describe('visibleFields', () => {
  const mcm = member().find((s) => s.id === 'mcm')!;
  const identity = member().find((s) => s.id === 'identity')!;
  const keys = (v: FormValues, c?: FormValues) =>
    visibleFields(mcm, v, c).map((f) => f.key);

  it('COM enseña «Nivel COM»; LC Incorporado, el año', () => {
    expect(keys({ 'mcm.stage': 'com' })).toContain('mcm.comLevel');
    expect(keys({ 'mcm.stage': 'lc' })).not.toContain('mcm.comLevel');
    expect(keys({ 'mcm.stage': 'lc_incorporated' })).toContain(
      'mcm.lcIncorporationYear',
    );
    expect(keys({ 'mcm.stage': 'com' })).not.toContain(
      'mcm.lcIncorporationYear',
    );
  });

  it('el soporte del DNI, solo si ya lo tenemos', () => {
    const k = (c: FormValues) =>
      visibleFields(identity, c, c).map((f) => f.key);
    expect(k({ documentSupportNumber: null })).not.toContain(
      'documentSupportNumber',
    );
    expect(k({ documentSupportNumber: '' })).not.toContain(
      'documentSupportNumber',
    );
    expect(k({ documentSupportNumber: 'BAA1' })).toContain(
      'documentSupportNumber',
    );
    // Borrarlo en pantalla no lo esconde (lo confirmado manda).
    expect(
      visibleFields(
        identity,
        { documentSupportNumber: '' },
        { documentSupportNumber: 'BAA1' },
      ).map((f) => f.key),
    ).toContain('documentSupportNumber');
  });
});

describe('formChanges: solo lo que cambia', () => {
  const spec = member();
  it('solo el correo', () => {
    expect(
      formChanges(spec, base, { ...base, 'contact.email': 'nuevo@correo.es' }),
    ).toEqual({ 'contact.email': 'nuevo@correo.es' });
    expect(writesFrom({ 'contact.email': 'nuevo@correo.es' }).details).toEqual({
      contact: { email: 'nuevo@correo.es' },
    });
  });

  it('nada cambiado, nada; espacios y vacío son lo mismo', () => {
    expect(formChanges(spec, base, base)).toEqual({});
    expect(
      formChanges(spec, base, { ...base, 'contact.mobile': ' 600111222 ' }),
    ).toEqual({});
    expect(
      formChanges(
        spec,
        { ...base, 'address.city': null },
        { ...base, 'address.city': '' },
      ),
    ).toEqual({});
  });

  it('una autorización sin contestar y sin tocar no viaja', () => {
    expect(formChanges(spec, base, base)).not.toHaveProperty([
      'consents.photos',
    ]);
    // Encender: `true`.
    expect(
      formChanges(spec, base, { ...base, 'consents.photos': true }),
    ).toEqual({ 'consents.photos': true });
    // Encender y apagar: `false`, a propósito.
    expect(
      formChanges(spec, base, { ...base, 'consents.photos': false }),
    ).toEqual({ 'consents.photos': false });
  });

  it('lo escondido por la etapa conserva su valor y no viaja', () => {
    const draft = { ...base, 'mcm.comLevel': 'conocimiento' };
    expect(formChanges(spec, base, draft)).toEqual({});
    expect(formChanges(spec, base, { ...draft, 'mcm.stage': 'com' })).toEqual({
      'mcm.stage': 'com',
      'mcm.comLevel': 'conocimiento',
    });
  });

  it('volver a «Sin indicar» manda null; los años, números', () => {
    const w = writesFrom({
      gender: null,
      'mcm.memberSince': '2019',
      'mcm.scarf': 'red',
      'health.allergies': 'Polen',
      'consents.photos': true,
    });
    expect(w.details).toEqual({
      gender: null,
      mcm: { memberSince: 2019, scarf: 'red' },
      consents: { photos: true },
    });
    expect(w.health).toEqual({ allergies: 'Polen' });
    // Los cuerpos caben en el contrato estricto.
    expect(
      PersonDetailsWrite.safeParse({
        clientId: '00000000-0000-4000-8000-000000000000',
        changes: w.details,
      }).success,
    ).toBe(true);
    expect(
      HealthWrite.safeParse({
        clientId: '00000000-0000-4000-8000-000000000000',
        health: w.health,
      }).success,
    ).toBe(true);
  });

  it('el contrato rechaza identidad sin `identityFill` y la salud en el PATCH', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect(
      PersonDetailsWrite.safeParse({
        clientId: id,
        changes: { identity: { firstName: 'X' } },
      }).success,
    ).toBe(false);
    expect(
      PersonDetailsWrite.safeParse({
        clientId: id,
        changes: { health: { allergies: 'x' } },
      }).success,
    ).toBe(false);
  });
});

describe('validateForm', () => {
  const spec = member();
  const err = (patch: FormValues) => validateForm(spec, { ...base, ...patch });

  it('correo con el patrón del plugin', () => {
    expect(err({ 'contact.email': 'a@b.es' })).toEqual({});
    expect(err({ 'contact.email': 'a.b+c@sub.dominio.org' })).toEqual({});
    expect(err({ 'contact.email': 'a@b' })).toHaveProperty(['contact.email']);
    expect(err({ 'contact.email': 'sin arroba' })).toHaveProperty([
      'contact.email',
    ]);
    // Nada es obligatorio.
    expect(err({ 'contact.email': '' })).toEqual({});
  });

  it('código postal de cinco cifras', () => {
    expect(err({ 'address.postalCode': '12001' })).toEqual({});
    expect(err({ 'address.postalCode': '1200' })).toHaveProperty([
      'address.postalCode',
    ]);
    expect(err({ 'address.postalCode': '1200a' })).toHaveProperty([
      'address.postalCode',
    ]);
  });

  it('años de cuatro cifras', () => {
    expect(err({ 'mcm.memberSince': '2019' })).toEqual({});
    for (const bad of ['19', '20199', 'abcd']) {
      expect(err({ 'mcm.memberSince': bad })).toHaveProperty([
        'mcm.memberSince',
      ]);
    }
    // Escondido (no es LC Incorporado): no se valida.
    expect(err({ 'mcm.lcIncorporationYear': '19' })).toEqual({});
  });

  it('el documento al completar para pagar', () => {
    const pay = member({
      fill: { documentType: true, documentNumber: true },
    });
    const v = (n: string, type = 'nif') =>
      validateForm(pay, {
        ...base,
        'identityFill.documentType': type,
        'identityFill.documentNumber': n,
      });
    expect(v('12345678Z')).toEqual({});
    expect(v('12345678A')).toHaveProperty(['identityFill.documentNumber']);
    expect(v('X1234567L', 'nie')).toEqual({});
  });
});

describe('isValidDocument (validateId del plugin)', () => {
  it('DNI y NIE con su letra', () => {
    expect(isValidDocument('nif', '12345678Z')).toBe(true);
    expect(isValidDocument('nif', '12345678z')).toBe(true);
    expect(isValidDocument('nif', '12345678A')).toBe(false);
    expect(isValidDocument('nie', 'X1234567L')).toBe(true);
    expect(isValidDocument('nie', 'X1234567A')).toBe(false);
  });
  it('CIF con su control', () => {
    expect(isValidDocument('cif', 'B12345674')).toBe(true);
    expect(isValidDocument('cif', 'B12345675')).toBe(false);
    expect(isValidDocument('cif', 'Q1234567D')).toBe(true);
  });
  it('pasaporte libre, pero no vacío', () => {
    expect(isValidDocument('passport', 'AB-123')).toBe(true);
    expect(isValidDocument('passport', '  ')).toBe(false);
  });
});

describe('título y fechas', () => {
  it('«Mis datos», «Datos de María» y sin nombre', () => {
    expect(detailsTitle(true, 'Marta')).toBe('Mis datos');
    expect(detailsTitle(false, 'María José')).toBe('Datos de María');
    expect(detailsTitle(false, '')).toBe('Datos del participante');
    expect(detailsTitle(false, null)).toBe('Datos del participante');
  });
  it('la fecha de nacimiento en lenguaje humano', () => {
    expect(humanDate('2014-05-05')).toBe('5 de mayo de 2014');
    expect(humanDate(null)).toBe('');
  });
});

describe('guardarraíles de «Mis datos»', () => {
  const ROOT = path.join(__dirname, '..', '..');
  const walk = (dir: string): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) return walk(p);
          return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
        })
      : [];
  const files = ['app', 'components', 'hooks'].flatMap((d) =>
    walk(path.join(ROOT, d)),
  );
  const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

  it('los datos y la salud de familias solo se piden en su hook', () => {
    const users = files
      .filter((f) =>
        /\.(getProfileDetails|getProfileHealth|updateProfileDetails|updateProfileHealth)\(/.test(
          fs.readFileSync(f, 'utf8'),
        ),
      )
      .map(rel);
    expect(users).toEqual(['hooks/comunica/usePersonDetails.ts']);
  });

  it('sus consultas nunca se guardan en el móvil', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'hooks/comunica/usePersonDetails.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/persist:\s*true/);
    expect(src.match(/persist:\s*false,/g)).toHaveLength(2);
    // Ni por la cola (guarda el cuerpo en disco).
    expect(src).not.toMatch(/useOutbox|enqueue/);
  });

  it('nada de `datos/` hace fetch, sube ni registra por su cuenta', () => {
    const datos = files.filter((f) =>
      /^(components\/comunica\/datos\/|app\/\(tabs\)\/comunica\/datos\/)/.test(
        rel(f),
      ),
    );
    expect(datos.length).toBeGreaterThan(0);
    for (const f of datos) {
      const src = fs.readFileSync(f, 'utf8');
      expect({
        f: rel(f),
        hit: /\bfetch\s*\(|FormData|logger\./.test(src),
      }).toEqual({
        f: rel(f),
        hit: false,
      });
    }
  });
});
