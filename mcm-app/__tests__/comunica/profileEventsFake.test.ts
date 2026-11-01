/**
 * Eventos y su ficha (plan 13, tarea 2): el servidor falso, portado como el de verdad.
 *
 *   · `pid` ajeno → 403. Listado: `signedUp` sin audiencia ni ocultos; `toSignUp` sin ocultos ni lo que no es para ese perfil.
 *   · Ficha: se sirve aunque no sea para ti (con el motivo), por id o por slug; lo inexistente, `not_found`.
 *   · Un 0 de plazas o de precio no sale; con información de la web no hay `description` (nunca las dos).
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import { ROUTES } from '@/services/comunica/contract';
import type { PersonaId } from '@/services/comunica/fake/fixtures';

const server = (persona: PersonaId, patch = {}) =>
  createFakeServer({ latencyMs: 0, persona, ...patch });
const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => `${e.code}:${e.status}`,
  );
const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe('contrato', () => {
  it('las tres rutas se guardan en el móvil (sin datos personales) y cuelgan del perfil', () => {
    for (const r of [
      'profileActivities',
      'profileEvent',
      'profileEventBySlug',
    ] as const) {
      expect(ROUTES[r].persist).toBe(true);
      expect(ROUTES[r].path).toContain('/v1/profiles/:pid/events');
    }
  });
});

describe('el pid se comprueba', () => {
  it('uno ajeno es 403 en las tres', async () => {
    const s = server('family');
    const other = s.data.personas.memberNoKids.personId;
    expect(await code(s.getProfileActivities(other))).toBe('forbidden:403');
    expect(await code(s.getProfileEvent(other, 'pev-convi'))).toBe(
      'forbidden:403',
    );
    expect(await code(s.getProfileEventBySlug(other, 'convivencia-com'))).toBe(
      'forbidden:403',
    );
  });
});

describe('listado', () => {
  it('Lucía: lo apuntado sale en `signedUp` (también lo oculto y lo rechazado) y no en `toSignUp`', async () => {
    const s = server('family');
    const l = await s.getProfileActivities('f-hijo-lucia');
    expect(ids(l.signedUp)).toEqual(
      expect.arrayContaining([
        'pev-sesiones',
        'pev-oculta-con',
        'pev-rechazada',
      ]),
    );
    for (const id of ids(l.signedUp)) expect(ids(l.toSignUp)).not.toContain(id);
  });
  it('lo oculto sin plaza no sale en «Para apuntarte»', async () => {
    const s = server('family');
    const l = await s.getProfileActivities('f-hijo-lucia');
    expect(ids(l.toSignUp)).not.toContain('pev-oculta-sin');
    expect(ids(l.toSignUp)).not.toContain('pev-oculta-con');
  });
  it('lo que no es para ese perfil (otra delegación, monitores, otro curso) no sale en `toSignUp`', async () => {
    const s = server('family');
    const l = await s.getProfileActivities('f-hijo-lucia');
    for (const id of ['pev-otra-del', 'pev-monitores', 'pev-otro-curso'])
      expect(ids(l.toSignUp)).not.toContain(id);
    // El otro curso sí es para el otro hijo.
    const other = await s.getProfileActivities('f-hijo-sin-nombre');
    expect(ids(other.toSignUp)).toContain('pev-otro-curso');
    expect(ids(other.toSignUp)).not.toContain('pev-otra-del');
  });
  it('la monitora ve lo de monitores', async () => {
    const s = server('monitorMom');
    const me = s.data.personas.monitorMom.personId;
    expect(ids((await s.getProfileActivities(me)).toSignUp)).toContain(
      'pev-monitores',
    );
  });
  it('la inscripción rechazada lleva su estado en rojo, no «Con plaza»', async () => {
    const s = server('family');
    const l = await s.getProfileActivities('f-hijo-lucia');
    const r = l.signedUp.find((c) => c.id === 'pev-rechazada')!;
    expect(r.myRegistrationStatus).toEqual({
      label: 'Rechazada',
      tone: 'danger',
    });
    expect(r.myRegistrationId).toBe('reg-lucia-rechazada');
  });
  it('las fechas siguen al reloj del falso (relativas a «hoy»)', async () => {
    const s = server('family', { clock: '2026-12-01T10:00:00Z' });
    const l = await s.getProfileActivities('f-hijo-sin-nombre');
    const c = l.toSignUp.find((x) => x.id === 'pev-convi')!;
    expect(c.startDate).toBe('2026-12-31');
    expect(c.window).toEqual({ opensOn: '2026-11-21', closesOn: '2026-12-21' });
  });
});

describe('ficha', () => {
  it('la de otra delegación se sirve con el motivo; la propia, `ok`', async () => {
    const s = server('family');
    const b = await s.getProfileEvent('f-hijo-lucia', 'pev-otra-del');
    expect(b.signup?.audience).toEqual({
      ok: false,
      reason: 'delegation',
      message: 'Esta actividad es solo para la delegación de Burriana.',
    });
    expect(
      (await s.getProfileEvent('f-hijo-lucia', 'pev-convi')).signup?.audience,
    ).toEqual({ ok: true });
  });
  it('lo oculto sin plaza se abre por enlace (y deja apuntarse)', async () => {
    const s = server('family');
    const d = await s.getProfileEvent('f-hijo-sin-nombre', 'pev-oculta-sin');
    expect(d.signup?.audience).toEqual({ ok: true });
  });
  it('por slug o por id; lo inexistente, not_found', async () => {
    const s = server('family');
    expect(
      (await s.getProfileEventBySlug('f-hijo-lucia', 'convivencia-com')).id,
    ).toBe('pev-convi');
    expect((await s.getProfileEventBySlug('f-hijo-lucia', 'pev-sinc')).id).toBe(
      'pev-sinc',
    );
    expect(await code(s.getProfileEvent('f-hijo-lucia', 'nope'))).toBe(
      'not_found:404',
    );
    expect(await code(s.getProfileEventBySlug('f-hijo-lucia', 'nope'))).toBe(
      'not_found:404',
    );
  });
  it('con información de la web: cuerpo, cartel, galería, adjuntos y página pública; sin descripción', async () => {
    const s = server('family');
    const d = await s.getProfileEvent('f-hijo-lucia', 'pev-convi');
    expect(d.body.length).toBeGreaterThan(0);
    expect(d.description).toBeNull();
    expect(d.cover).toEqual({ documentId: 'doc-cartel' });
    expect(d.gallery).toHaveLength(2);
    expect(d.attachments).toEqual([
      { documentId: 'doc-autorizacion', title: 'Autorización de salida' },
    ]);
    expect(d.publicUrl).toContain('/actividades/?e=convivencia-com');
    expect(d.share).toEqual({ url: d.publicUrl, kind: 'public' });
    expect(d.tagline).toBe('Un fin de semana para convivir');
    expect(d.body.map((b) => b.type)).toEqual(
      expect.arrayContaining([
        'heading',
        'paragraph',
        'notice',
        'list',
        'button',
        'image',
        'gallery',
        'video',
        'divider',
      ]),
    );
  });
  it('sin información de la web: la descripción con sus saltos y sin lema; el compartir es el del área', async () => {
    const s = server('family');
    const d = await s.getProfileEvent('f-hijo-lucia', 'pev-sinc');
    expect(d.body).toEqual([]);
    expect(d.description).toContain('\n');
    expect(d.tagline).toBeNull();
    expect(d.publicUrl).toBeNull();
    expect(d.share?.kind).toBe('area');
  });
  it('plazas y precio a 0 no llegan: null (y nunca 0 en ninguna ficha)', async () => {
    const s = server('family');
    const d = await s.getProfileEvent('f-hijo-lucia', 'pev-sinc');
    expect(d.capacity).toBeNull();
    expect(d.price).toBeNull();
    for (const id of [
      'pev-convi',
      'pev-sinc',
      'pev-fwa',
      'pev-sesiones',
      'pev-cerrada',
    ]) {
      const e = await s.getProfileEvent('f-hijo-lucia', id);
      expect(e.capacity).not.toBe(0);
      expect(e.price).not.toBe(0);
    }
    expect((await s.getProfileEvent('f-hijo-lucia', 'pev-convi')).price).toBe(
      45,
    );
  });
  it('el mapa: enlace propio si lo hay; si no, la búsqueda con la dirección o el lugar', async () => {
    const s = server('family');
    expect((await s.getProfileEvent('f-hijo-lucia', 'pev-fwa')).map).toEqual({
      url: 'https://maps.example.org/gredos',
    });
    expect((await s.getProfileEvent('f-hijo-lucia', 'pev-convi')).map).toEqual({
      query: 'Camino del Pinar 12, Benicàssim',
    });
    expect((await s.getProfileEvent('f-hijo-lucia', 'pev-sinc')).map).toEqual({
      query: 'Salón parroquial',
    });
  });
  it('el formulario avanzado y el id de la inscripción', async () => {
    const s = server('family');
    expect(
      (await s.getProfileEvent('f-hijo-lucia', 'pev-fwa')).hasAdvancedForm,
    ).toBe(true);
    expect(
      (await s.getProfileEvent('f-hijo-lucia', 'pev-sesiones'))
        .myRegistrationId,
    ).toBe('reg-lucia-sesiones');
    expect(
      (await s.getProfileEvent('f-hijo-sin-nombre', 'pev-sesiones'))
        .myRegistrationId,
    ).toBeNull();
  });
});

describe('archivos y fallos', () => {
  it('eventFileSource: una imagen estable por documento', () => {
    const s = server('family');
    const a = s.eventFileSource('p', 'e', 'doc-1');
    expect(a).toEqual(s.eventFileSource('p', 'e', 'doc-1'));
    expect(a.uri).not.toEqual(s.eventFileSource('p', 'e', 'doc-2').uri);
  });
  it('sin red falla; con el CRM caído las lecturas siguen', async () => {
    expect(
      await code(
        server('family', { offline: true }).getProfileActivities(
          'f-hijo-lucia',
        ),
      ),
    ).toMatch(/^network/);
    expect(
      await code(
        server('family', { crmDown: true }).getProfileActivities(
          'f-hijo-lucia',
        ),
      ),
    ).toBe('ok');
  });
});
