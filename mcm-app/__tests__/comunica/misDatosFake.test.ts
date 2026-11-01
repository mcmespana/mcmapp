/**
 * «Mis datos» de familias en el servidor falso (plan 12, tarea 2), con las
 * reglas del servidor de verdad (`comunicaMiddleware:src/app/profile-details*`).
 */
import { ComunicaApiError } from '@/services/comunica/client';
import { createFakeServer } from '@/services/comunica/fake';
import type { PersonaId } from '@/services/comunica/fake/fixtures';

const server = (persona: PersonaId, patch = {}) =>
  createFakeServer({ latencyMs: 0, persona, ...patch });
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => e.code,
  );
const reason = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => e.reason,
  );

describe('falso de «Mis datos»', () => {
  it('secciones por audiencia: el miembro tiene MCM, el hijo y el familiar no', async () => {
    const elena = server('member');
    const me = elena.data.personas.member.personId;
    const d = await elena.getProfileDetails(me);
    expect(d.sections).toContain('mcm');
    expect(d.mcm?.stage).toBe('com');
    // Miembro sin ser monitora: la nota suave.
    expect(d.emailNote).toBe('mcm_email_soft');

    const rosa = server('guardianTwo');
    const self = await rosa.getProfileDetails(
      rosa.data.personas.guardianTwo.personId,
    );
    expect(self.sections).not.toContain('mcm');
    expect(self.mcm).toBeNull();
    expect(self.sections).toContain('health');
    const lucia = await rosa.getProfileDetails('f-fam-lucia');
    expect(lucia.sections).not.toContain('mcm');
    expect(lucia.consents).toEqual({
      dataProtection: null,
      healthData: null,
      photos: null,
    });
    // El otro hijo: soporte y expedición del DNI.
    const other = await rosa.getProfileDetails('f-fam-sin-nombre');
    expect(other.documentSupportNumber).toBe('BAA123456');
    expect(other.documentIssueDate).toBe('2023-06-01');
  });

  it('monitor con correo de Gmail: el aviso', async () => {
    const s = server('monitor');
    const d = await s.getProfileDetails(s.data.personas.monitor.personId);
    expect(d.emailNote).toBe('mcm_email_warning');
    expect(d.photoUrl).toMatch(/^https:\/\//);
  });

  it('un pid ajeno es 403; con el CRM caído, 503 (nunca vacío)', async () => {
    const s = server('guardianOne');
    expect(await code(s.getProfileDetails('f-fam-lucia'))).toBe('forbidden');
    expect(await code(s.getProfileHealth('f-fam-lucia'))).toBe('forbidden');
    expect(await code(s.getProfileDetails('no-existe'))).toBe('forbidden');
    s.setControls({ failRoute: 'personal' });
    expect(
      await code(s.getProfileDetails(s.data.personas.guardianOne.personId)),
    ).toBe('crm_unavailable');
    s.setControls({ failRoute: null, crmDown: true });
    expect(
      await code(
        s.updateProfileDetails(s.data.personas.guardianOne.personId, {
          clientId: id(1),
          changes: { contact: { mobile: '1' } },
        }),
      ),
    ).toBe('crm_unavailable');
  });

  it('solo escribe lo que cambia y devuelve lo releído', async () => {
    const s = server('guardianTwo');
    const r = await s.updateProfileDetails('f-fam-lucia', {
      clientId: id(2),
      changes: {
        contact: {
          mobile: '611 222 333',
          email: 'familia.messeguer@correo.es',
        },
      },
    });
    expect(r.status).toBe('applied');
    expect(r.details.contact.mobile).toBe('611 222 333');
    // El correo no cambiaba: no cuenta.
    expect(s.detailWrites()).toEqual({ 'contact.mobile': 1 });
    // Mismo clientId: no se duplica.
    await s.updateProfileDetails('f-fam-lucia', {
      clientId: id(2),
      changes: { contact: { mobile: '611 222 333' } },
    });
    expect(s.detailWrites()).toEqual({ 'contact.mobile': 1 });
  });

  it('las autorizaciones solo se escriben si llegan', async () => {
    const s = server('guardianTwo');
    const r = await s.updateProfileDetails('f-fam-lucia', {
      clientId: id(3),
      changes: { consents: { photos: false } },
    });
    expect(r.details.consents).toEqual({
      dataProtection: null,
      healthData: null,
      photos: false,
    });
  });

  it('estricto: correo mal, MCM de otra audiencia y claves de más', async () => {
    const s = server('guardianTwo');
    expect(
      await reason(
        s.updateProfileDetails('f-fam-lucia', {
          clientId: id(4),
          changes: { contact: { email: 'a@b' } },
        }),
      ),
    ).toBe('bad_email');
    expect(
      await reason(
        s.updateProfileDetails('f-fam-lucia', {
          clientId: id(5),
          changes: { mcm: { shirtSize: 'M' } },
        }),
      ),
    ).toBe('section_not_allowed');
    expect(
      await reason(
        s.updateProfileDetails('f-fam-lucia', {
          clientId: id(6),
          changes: { identity: { firstName: 'X' } },
        } as never),
      ),
    ).toBe('bad_body');
  });

  it('identityFill: solo lo vacío, y el documento con su letra', async () => {
    const s = server('guardianNone');
    const me = s.data.personas.guardianNone.personId;
    expect(
      await reason(
        s.updateProfileDetails(me, {
          clientId: id(7),
          changes: {
            identityFill: { documentType: 'nif', documentNumber: '12345678A' },
          },
        }),
      ),
    ).toBe('bad_document');
    const r = await s.updateProfileDetails(me, {
      clientId: id(8),
      changes: {
        identityFill: { documentType: 'nif', documentNumber: '12345678Z' },
      },
    });
    expect(r.details.identity.documentNumber).toBe('12345678Z');
    // Ya tiene valor: no se cambia desde aquí.
    expect(
      await reason(
        s.updateProfileDetails(me, {
          clientId: id(9),
          changes: { identityFill: { firstName: 'Otra' } },
        }),
      ),
    ).toBe('identity_already_set');
  });

  it('la salud: por su ruta, y nunca en el resultado', async () => {
    const s = server('guardianTwo');
    const h = await s.getProfileHealth('f-fam-lucia');
    expect(h.health.allergies).toBe('Polen de olivo');
    const r = await s.updateProfileHealth('f-fam-lucia', {
      clientId: id(10),
      health: { allergies: 'Ninguna' },
    });
    expect(JSON.stringify(r)).not.toContain('Ninguna');
    expect((await s.getProfileHealth('f-fam-lucia')).health.allergies).toBe(
      'Ninguna',
    );
    expect(s.detailWrites()).toEqual({ 'health.allergies': 1 });
  });

  it('reset() lo deja como al principio', async () => {
    const s = server('guardianTwo');
    await s.updateProfileDetails('f-fam-lucia', {
      clientId: id(11),
      changes: { contact: { mobile: '1' } },
    });
    s.reset();
    s.setControls({ latencyMs: 0, persona: 'guardianTwo' });
    expect((await s.getProfileDetails('f-fam-lucia')).contact.mobile).toBe(
      null,
    );
    expect(s.detailWrites()).toEqual({});
  });
});
