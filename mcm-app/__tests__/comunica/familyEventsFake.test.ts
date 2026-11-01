/**
 * Eventos de familias en el contrato y en el servidor falso (plan 13, tareas
 * 1 y 2): listado, ficha por id y por slug, archivos con permiso, audiencia y
 * ocultos, y los guardarraíles del contrato (ni una cadena de HTML).
 */
import {
  ActivityList,
  BodyBlock,
  EventDetail,
  PROFILE_PATH_PREFIX,
  ROUTES,
} from '@/services/comunica/contract';
import { ComunicaApiError } from '@/services/comunica/client';
import { createFakeServer } from '@/services/comunica/fake';
import { FAMILY_EVENT_IDS as ID } from '@/services/comunica/fake/familyEvents';

const CLOCK = '2026-11-02T10:00:00Z';
const server = () =>
  createFakeServer({ latencyMs: 0, persona: 'guardianTwo', clock: CLOCK });
const LUCIA = 'f-fam-lucia';
const ROSA = 'f-fam-rosa';

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => e.code,
  );

describe('contrato de eventos de familias', () => {
  it('las rutas cuelgan del perfil; el listado y la ficha se guardan', () => {
    for (const r of [
      'profileEvents',
      'profileEvent',
      'profileEventBySlug',
    ] as const) {
      expect(ROUTES[r].path.startsWith(PROFILE_PATH_PREFIX)).toBe(true);
    }
    expect(ROUTES.profileEvents.persist).toBe(true);
    expect(ROUTES.profileEvent.persist).toBe(true);
    expect(ROUTES.profileEventBySlug.persist).toBe(false);
  });

  it('parsea un ejemplo de cada bloque y rechaza un bloque con html', () => {
    const blocks: unknown[] = [
      { type: 'heading', level: 1, text: [{ t: 'text', v: 'A' }] },
      { type: 'paragraph', text: [{ t: 'bold', c: [{ t: 'text', v: 'x' }] }] },
      { type: 'notice', text: [{ t: 'break' }] },
      {
        type: 'list',
        ordered: true,
        start: 1,
        items: [[{ t: 'text', v: 'uno' }]],
        children: { '0': { ordered: false, items: [[{ t: 'text', v: 'a' }]] } },
      },
      { type: 'button', label: 'Ir', href: { url: 'https://x.org' } },
      { type: 'image', src: { documentId: 'd1' }, caption: 'c' },
      { type: 'gallery', images: [{ url: 'https://x.org/a.png' }] },
      {
        type: 'video',
        provider: 'youtube',
        id: 'abc',
        url: 'https://youtu.be/abc',
      },
      { type: 'divider' },
    ];
    for (const b of blocks) expect(BodyBlock.safeParse(b).success).toBe(true);
    expect(
      BodyBlock.safeParse({ type: 'paragraph', text: [], html: '<b>x</b>' })
        .success,
    ).toBe(false);
    expect(
      BodyBlock.safeParse({ type: 'html', html: '<p>x</p>' }).success,
    ).toBe(false);
  });

  it('ningún campo del contrato de eventos se llama html', () => {
    const keys = [
      ...Object.keys(EventDetail.shape),
      ...Object.keys(ActivityList.shape),
    ];
    expect(keys.filter((k) => /html/i.test(k))).toEqual([]);
  });
});

describe('servidor falso: eventos de familias', () => {
  it('un pid ajeno es 403 en todas las rutas (nunca 404)', async () => {
    const s = server();
    expect(await code(s.getActivities('f-fam-pablo'))).toBe('forbidden');
    expect(await code(s.getActivity('f-fam-pablo', ID.convivencia))).toBe(
      'forbidden',
    );
    expect(await code(s.getActivityBySlug('f-fam-pablo', ID.slug))).toBe(
      'forbidden',
    );
  });

  it('el oculto con plaza sale en «Te has apuntado»; el oculto sin plaza, en ninguno', async () => {
    const list = await server().getActivities(LUCIA);
    const signed = list.signedUp.map((e) => e.id);
    const toSign = list.toSignUp.map((e) => e.id);
    expect(signed).toContain(ID.ocultaConPlaza);
    expect(toSign).not.toContain(ID.ocultaSinPlaza);
    expect(signed).not.toContain(ID.ocultaSinPlaza);
  });

  it('«Para apuntarte» quita lo que no es para el perfil (delegación, perfil, curso)', async () => {
    const toSign = (await server().getActivities(LUCIA)).toSignUp.map(
      (e) => e.id,
    );
    expect(toSign).toContain(ID.convivencia);
    expect(toSign).not.toContain(ID.otraDelegacion);
    expect(toSign).not.toContain(ID.monitores);
    expect(toSign).not.toContain(ID.otroCurso);
    expect(toSign).not.toContain(ID.sesionesMic);
  });

  it('la audiencia es la del perfil que se ve, no la de quien entra', async () => {
    const s = server();
    const mic = await s.getActivities('f-fam-sin-nombre');
    expect(mic.signedUp.map((e) => e.id)).toContain(ID.sesionesMic);
    // La madre no es participante: la convivencia COM no es para ella.
    const rosa = await s.getActivities(ROSA);
    expect(rosa.toSignUp.map((e) => e.id)).not.toContain(ID.convivencia);
  });

  it('la ficha de otra delegación se sirve, con el motivo', async () => {
    const e = await server().getActivity(LUCIA, ID.otraDelegacion);
    expect(e.signup?.audience).toEqual({
      ok: false,
      reason: 'delegation',
      message:
        'Esta actividad la organiza otra delegación, así que la inscripción no está abierta para ti.',
    });
    const mon = await server().getActivity(LUCIA, ID.monitores);
    expect(mon.signup?.audience).toMatchObject({
      reason: 'profile',
      message: 'Esta actividad es solo para monitores y monitoras.',
    });
  });

  it('por slug y por id es la misma ficha; lo inexistente es not_found', async () => {
    const s = server();
    const bySlug = await s.getActivityBySlug(LUCIA, ID.slug);
    const byId = await s.getActivityBySlug(LUCIA, ID.convivencia);
    expect(bySlug.id).toBe(ID.convivencia);
    expect(byId.id).toBe(ID.convivencia);
    expect(bySlug.publicUrl).toContain(`?e=${ID.slug}`);
    expect(await code(s.getActivity(LUCIA, 'ac7e0000-nope'))).toBe('not_found');
    expect(await code(s.getActivityBySlug(LUCIA, 'no-existe'))).toBe(
      'not_found',
    );
  });

  it('la convivencia lleva todos los tipos de bloque, cartel, galería y PDF', async () => {
    const e = await server().getActivity(LUCIA, ID.convivencia);
    const types = new Set(e.body.map((b) => b.type));
    for (const t of [
      'heading',
      'paragraph',
      'notice',
      'list',
      'button',
      'image',
      'gallery',
      'video',
      'divider',
    ]) {
      expect(types.has(t as BodyBlock['type'])).toBe(true);
    }
    expect(e.cover).toEqual({ documentId: ID.docs.cover });
    expect(e.attachments.length).toBeGreaterThan(0);
    expect(e.description).toBeNull();
  });

  it('sin información de la web, la descripción con sus saltos y sin lema', async () => {
    const e = await server().getActivity(LUCIA, ID.sinCuerpo);
    expect(e.body).toEqual([]);
    expect(e.description).toContain('\n');
    expect(e.tagline).toBeNull();
  });

  it('plazas y precio nunca llegan a 0 desde el falso', async () => {
    const s = server();
    const list = await s.getActivities(LUCIA);
    for (const c of [...list.toSignUp, ...list.signedUp]) {
      const e = await s.getActivity(LUCIA, c.id);
      expect(e.capacity).not.toBe(0);
      expect(e.price).not.toBe(0);
    }
    const ceros = await s.getActivity(LUCIA, ID.ceros);
    expect(ceros.capacity).toBeNull();
    expect(ceros.price).toBeNull();
  });

  it('una inscripción rechazada no es «Con plaza»', async () => {
    const list = await server().getActivities(LUCIA);
    const rejected = list.signedUp.find((e) => e.id === ID.rechazada);
    expect(rejected?.myRegistrationStatus).toEqual({
      label: 'Rechazada',
      tone: 'danger',
    });
  });

  it('documentos: los del evento con permiso; de otro evento, not_found', () => {
    const s = server();
    expect(
      s.eventDocument(LUCIA, ID.convivencia, ID.docs.authorization).mimeType,
    ).toBe('application/pdf');
    expect(() =>
      s.eventDocument(LUCIA, ID.convivencia, ID.docs.otherEvent),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
    // Las sesiones MIC no son para Lucía y no tiene plaza: ni su PDF.
    expect(() =>
      s.eventDocument(LUCIA, ID.sesionesMic, ID.docs.otherEvent),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
    // Su hermano sí tiene plaza: el mismo PDF, sí.
    expect(
      s.eventDocument('f-fam-sin-nombre', ID.sesionesMic, ID.docs.otherEvent)
        .mimeType,
    ).toBe('application/pdf');
  });
});
