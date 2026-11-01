/**
 * «Mis datos» (plan 12, tareas 1 y 2): el contrato y el servidor falso, portado como el de verdad.
 *
 *   · Las secciones las decide la audiencia (el miembro, siete; el hijo y el familiar, sin MCM) y el aviso del correo, también.
 *   · `pid` ajeno → 403 en las cuatro rutas. El `PATCH` es estricto; solo escribe lo que cambia (contador por campo) y no repite con el mismo `clientId`.
 *   · Las autorizaciones sin contestar se quedan sin contestar; la identidad solo se rellena si está vacía y con el documento con su letra.
 *   · La salud va aparte y NUNCA sale en los datos.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import { PersonDetails, ROUTES } from '@/services/comunica/contract';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import { uuidV4 } from '@/utils/comunica/uuid';

const server = (persona: PersonaId, patch = {}) =>
  createFakeServer({ latencyMs: 0, persona, ...patch });
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) =>
      `${e.code}:${e.status}${e.reason ? `:${e.reason}` : ''}`,
  );
const idOf = (s: ReturnType<typeof server>, persona: PersonaId) =>
  s.data.personas[persona].personId;
const patch = (changes: object) => ({ clientId: uuidV4(), changes }) as never;

describe('contrato', () => {
  it('ninguna de las cinco rutas se guarda en el móvil', () => {
    for (const r of [
      'profileDetails',
      'updateProfileDetails',
      'profileHealth',
      'updateProfileHealth',
      'uploadProfilePhoto',
    ] as const)
      expect(ROUTES[r].persist).toBe(false);
    expect(ROUTES.uploadProfilePhoto).toMatchObject({
      method: 'PUT',
      path: '/v1/profiles/:pid/photo',
    });
    expect(ROUTES.profileDetails.path).toBe('/v1/profiles/:pid/details');
    expect(ROUTES.updateProfileHealth.method).toBe('PUT');
  });
  it('un consentimiento solo admite true o false; una clave de más no pasa', () => {
    const ok = PersonDetails.shape;
    expect(ok.sections).toBeDefined();
    const s = server('family');
    return expect(
      code(
        s.updateProfileDetails(
          idOf(s, 'family'),
          patch({ consents: { photos: null } }),
        ),
      ),
    ).resolves.toBe('validation:422:bad_body');
  });
});

describe('secciones, audiencia y aviso del correo', () => {
  it('el miembro ve las siete; la nota suave si no es monitor', async () => {
    const s = server('memberNoKids');
    const d = await s.getProfileDetails(idOf(s, 'memberNoKids'));
    expect(d.sections).toEqual([
      'identity',
      'contact',
      'address',
      'photo',
      'mcm',
      'health',
      'consents',
    ]);
    expect(d.mcm).not.toBeNull();
    expect(d.emailNote).toBe('mcm_email_soft');
  });
  it('la monitora con correo de Gmail tiene el aviso fuerte', async () => {
    const s = server('monitorMom');
    const d = await s.getProfileDetails(idOf(s, 'monitorMom'));
    expect(d.emailNote).toBe('mcm_email_warning');
    expect(d.mcm?.stage).toBe('com');
  });
  it('el familiar a secas y su hijo, sin MCM y sin nota', async () => {
    const s = server('family');
    for (const pid of [idOf(s, 'family'), 'f-hijo-lucia']) {
      const d = await s.getProfileDetails(pid);
      expect(d.sections).not.toContain('mcm');
      expect(d.mcm).toBeNull();
      expect(d.emailNote).toBeNull();
    }
  });
  it('el hijo con las tres autorizaciones sin contestar y el otro con soporte y expedición', async () => {
    const s = server('family');
    expect((await s.getProfileDetails('f-hijo-lucia')).consents).toEqual({
      dataProtection: null,
      healthData: null,
      photos: null,
    });
    const other = await s.getProfileDetails('f-hijo-sin-nombre');
    expect(other.documentSupportNumber).toBe('BAA123456');
    expect(other.documentIssueDate).toBe('2021-03-15');
    expect(other.identity.firstName).toBe('');
  });
  it('quien paga y no tiene DNI llega sin documento', async () => {
    const s = server('familyNone');
    const d = await s.getProfileDetails(idOf(s, 'familyNone'));
    expect(d.identity.documentNumber).toBeNull();
    expect(d.contact.email).toBeNull();
  });
});

describe('el pid se comprueba en cada ruta', () => {
  it('uno ajeno es 403 (nunca 404) en leer y escribir, datos y salud', async () => {
    const s = server('family');
    const other = idOf(s, 'memberNoKids');
    expect(await code(s.getProfileDetails(other))).toBe('forbidden:403');
    expect(
      await code(s.updateProfileDetails(other, patch({ gender: 'male' }))),
    ).toBe('forbidden:403');
    expect(await code(s.getProfileHealth(other))).toBe('forbidden:403');
    expect(
      await code(
        s.updateProfileHealth(other, {
          clientId: uuidV4(),
          health: { other: 'x' },
        }),
      ),
    ).toBe('forbidden:403');
  });
  it('la hija de la monitora, sí', async () => {
    const s = server('monitorMom');
    expect(await code(s.getProfileDetails('f-hija-ines'))).toBe('ok');
  });
});

describe('PATCH: estricto, solo lo que cambia, sin repetir', () => {
  it('una clave de más (identidad, salud, otra) es validation', async () => {
    const s = server('family');
    const me = idOf(s, 'family');
    for (const bad of [
      { identity: { firstName: 'x' } },
      { health: { other: 'x' } },
      { foo: 1 },
      { contact: { nope: 'x' } },
    ])
      expect(await code(s.updateProfileDetails(me, patch(bad)))).toBe(
        'validation:422:bad_body',
      );
  });
  it('mcm de quien no la tiene: validation', async () => {
    const s = server('family');
    expect(
      await code(
        s.updateProfileDetails(
          'f-hijo-lucia',
          patch({ mcm: { stage: 'com' } }),
        ),
      ),
    ).toBe('validation:422:section_not_allowed');
  });
  it('formatos y opciones', async () => {
    const s = server('memberNoKids');
    const me = idOf(s, 'memberNoKids');
    expect(
      await code(
        s.updateProfileDetails(me, patch({ contact: { email: 'mal' } })),
      ),
    ).toBe('validation:422:bad_email');
    expect(
      await code(
        s.updateProfileDetails(me, patch({ address: { postalCode: '123' } })),
      ),
    ).toBe('validation:422:bad_postal_code');
    expect(
      await code(s.updateProfileDetails(me, patch({ gender: 'otro' }))),
    ).toBe('validation:422:bad_option');
    expect(
      await code(
        s.updateProfileDetails(me, patch({ mcm: { memberSince: 1800 } })),
      ),
    ).toBe('validation:422:bad_year');
    expect(s.writeCount).toBe(0);
  });
  it('guardar solo el móvil escribe un campo; lo mismo otra vez, ninguno; el mismo clientId, tampoco', async () => {
    const s = server('family');
    const me = idOf(s, 'family');
    const first = patch({ contact: { mobile: '699000111' } }) as {
      clientId: string;
    };
    const r = await s.updateProfileDetails(me, first as never);
    expect(r.status).toBe('applied');
    expect(r.details.contact.mobile).toBe('699000111');
    expect(s.detailWrites()).toEqual({ mobile: 1 });
    await s.updateProfileDetails(
      me,
      patch({ contact: { mobile: '699000111' } }),
    );
    expect(s.detailWrites()).toEqual({ mobile: 1 });
    await s.updateProfileDetails(me, {
      ...first,
      changes: { contact: { mobile: '600000000' } },
    } as never);
    expect(s.detailWrites()).toEqual({ mobile: 1 });
    expect(s.writeCount).toBe(1);
  });
  it('responde con los datos releídos y sin la salud', async () => {
    const s = server('family');
    const r = await s.updateProfileDetails(
      'f-hijo-lucia',
      patch({ gender: 'male' }),
    );
    expect(r.details.gender).toBe('male');
    expect(JSON.stringify(r.details)).not.toContain('Sin gluten');
    expect(Object.keys(r.details)).not.toContain('health');
  });
  it('encender una autorización no toca las demás (siguen sin contestar)', async () => {
    const s = server('family');
    const r = await s.updateProfileDetails(
      'f-hijo-lucia',
      patch({ consents: { photos: true } }),
    );
    expect(r.details.consents).toEqual({
      dataProtection: null,
      healthData: null,
      photos: true,
    });
    expect(s.detailWrites()).toEqual({ 'consents.photos': 1 });
  });
  it('mcm de un miembro cambia sus campos', async () => {
    const s = server('memberNoKids');
    const r = await s.updateProfileDetails(
      idOf(s, 'memberNoKids'),
      patch({
        mcm: { stage: 'com', comLevel: 'conocimiento', memberSince: 2012 },
      }),
    );
    expect(r.details.mcm).toMatchObject({
      stage: 'com',
      comLevel: 'conocimiento',
      memberSince: 2012,
      lcIncorporationYear: 2018,
    });
  });
});

describe('identityFill', () => {
  it('quien no tiene documento lo escribe (en mayúsculas); a la segunda, ya está puesto', async () => {
    const s = server('familyNone');
    const me = idOf(s, 'familyNone');
    const r = await s.updateProfileDetails(
      me,
      patch({
        identityFill: {
          documentType: 'nif',
          documentNumber: '12345678z',
        },
      }),
    );
    expect(r.details.identity).toMatchObject({
      documentType: 'nif',
      documentNumber: '12345678Z',
    });
    expect(
      await code(
        s.updateProfileDetails(
          me,
          patch({ identityFill: { documentNumber: '87654321X' } }),
        ),
      ),
    ).toBe('validation:422:identity_already_set');
  });
  it('un documento con la letra mal, validation; quien ya lo tiene, no puede', async () => {
    const s = server('familyNone');
    expect(
      await code(
        s.updateProfileDetails(
          idOf(s, 'familyNone'),
          patch({
            identityFill: { documentType: 'nif', documentNumber: '12345678A' },
          }),
        ),
      ),
    ).toBe('validation:422:bad_document');
    const t = server('family');
    expect(
      await code(
        t.updateProfileDetails(
          idOf(t, 'family'),
          patch({ identityFill: { firstName: 'Otra' } }),
        ),
      ),
    ).toBe('validation:422:identity_already_set');
  });
});

describe('salud', () => {
  it('se lee aparte y se escribe solo lo que llega', async () => {
    const s = server('family');
    expect((await s.getProfileHealth('f-hijo-lucia')).health).toEqual({
      foodIntolerances: 'Sin gluten',
      allergies: null,
      illnesses: null,
      treatments: null,
      other: null,
    });
    await s.updateProfileHealth('f-hijo-lucia', {
      clientId: uuidV4(),
      health: { allergies: 'Polen' },
    });
    expect((await s.getProfileHealth('f-hijo-lucia')).health).toMatchObject({
      foodIntolerances: 'Sin gluten',
      allergies: 'Polen',
    });
    expect(s.detailWrites()).toEqual({ 'health.allergies': 1 });
  });
  it('el resultado de escribirla no lleva la salud', async () => {
    const s = server('family');
    const r = await s.updateProfileHealth('f-hijo-lucia', {
      clientId: uuidV4(),
      health: { other: 'Asma' },
    });
    expect(JSON.stringify(r)).not.toContain('Asma');
  });
  it('una clave que no es de salud, validation', async () => {
    const s = server('family');
    expect(
      await code(
        s.updateProfileHealth('f-hijo-lucia', {
          clientId: uuidV4(),
          health: { email: 'x' },
        } as never),
      ),
    ).toBe('validation:422:bad_body');
  });
});

describe('fallos del CRM', () => {
  it('con el CRM caído las escrituras fallan y las lecturas siguen', async () => {
    const s = server('family', { crmDown: true });
    expect(await code(s.getProfileDetails(idOf(s, 'family')))).toBe('ok');
    expect(
      await code(
        s.updateProfileDetails(idOf(s, 'family'), patch({ gender: 'male' })),
      ),
    ).toBe('crm_unavailable:503');
    expect(
      await code(
        s.updateProfileHealth(idOf(s, 'family'), {
          clientId: uuidV4(),
          health: { other: 'x' },
        }),
      ),
    ).toBe('crm_unavailable:503');
  });
  it('sin red, todo falla', async () => {
    const s = server('family', { offline: true });
    expect(await code(s.getProfileDetails(idOf(s, 'family')))).toMatch(
      /^network/,
    );
  });
  it('reset deja los datos como al principio', async () => {
    const s = server('family');
    await s.updateProfileDetails('f-hijo-lucia', patch({ gender: 'male' }));
    s.reset();
    s.setControls({ latencyMs: 0, persona: 'family' });
    expect((await s.getProfileDetails('f-hijo-lucia')).gender).toBe('female');
    expect(s.detailWrites()).toEqual({});
  });
});
