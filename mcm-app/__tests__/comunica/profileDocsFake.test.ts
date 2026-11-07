/**
 * Documentos y calendario (plan 16, tareas 1 y 2): el servidor falso, portado como el de verdad.
 *
 *   · `pid` ajeno → 403. Un documento ajeno, borrado o inexistente → 403 (nunca «no es tuyo»).
 *   · Subir: el archivo se mira ANTES de escribir (vacío, 4 MB, extensión); mismo `clientId` = el mismo documento. Editar solo lo que llega; borrar es lógico.
 *   · Calendario: las sesiones de lo que tiene inscripción NO cancelada; los abiertos con la audiencia del perfil, sin ocultos y sin los que ya tienen plaza.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import { CalendarData, ROUTES } from '@/services/comunica/contract';
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
const file = (name = 'a.pdf', size = 1000) => ({
  uri: `file:///tmp/${name}`,
  name,
  mimeType: 'application/pdf',
  size,
});
type Server = ReturnType<typeof server>;
const create = (
  s: Server,
  pid: string,
  over: Partial<{ clientId: string; name: string }> = {},
  f = file(),
) =>
  s.createProfileDocument(
    pid,
    { clientId: uuidV4(), name: 'Mi documento', ...over },
    f,
  );

describe('contrato', () => {
  it('los documentos NO se guardan en el móvil; el calendario sí', () => {
    for (const r of [
      'profileDocuments',
      'profileDocument',
      'createProfileDocument',
      'updateProfileDocument',
      'deleteProfileDocument',
    ] as const)
      expect(ROUTES[r].persist).toBe(false);
    expect(ROUTES.profileCalendar.persist).toBe(true);
    expect(ROUTES.deleteProfileDocument.method).toBe('DELETE');
  });
});

describe('documentos: quién ve qué', () => {
  it('cada perfil, los suyos; un pid ajeno, 403 en todas', async () => {
    const s = server();
    expect(
      (await s.getProfileDocuments(LUCIA)).documents.map((d) => d.id),
    ).toEqual(
      expect.arrayContaining(['doc-aut', 'doc-dni', 'doc-sin', 'doc-cad']),
    );
    expect((await s.getProfileDocuments(NICO)).documents).toEqual([]);
    const other = s.data.personas.memberNoKids.personId;
    expect(await code(s.getProfileDocuments(other))).toBe('forbidden:403');
    expect(await code(s.getProfileDocument(other, 'doc-jaime'))).toBe(
      'forbidden:403',
    );
    expect(await code(create(s, other))).toBe('forbidden:403');
    expect(
      await code(s.deleteProfileDocument(other, 'doc-jaime', uuidV4())),
    ).toBe('forbidden:403');
  });
  it('un documento del hermano o inexistente: 403, nunca 404', async () => {
    const s = server();
    expect(await code(s.getProfileDocument(NICO, 'doc-aut'))).toBe(
      'forbidden:403:document_out_of_scope',
    );
    expect(await code(s.getProfileDocument(LUCIA, 'no-existe'))).toBe(
      'forbidden:403:document_out_of_scope',
    );
  });
  it('la ficha: descripción, categoría y enlace compartido; uno sin archivo, caducado y en borrador', async () => {
    const s = server();
    const d = (await s.getProfileDocument(LUCIA, 'doc-aut')).document;
    expect(d).toMatchObject({
      description: 'Firmada por los padres.',
      category: { key: 'authorization' },
      sharedLink: null,
      fileName: 'autorizacion.pdf',
    });
    expect(
      (await s.getProfileDocument(LUCIA, 'doc-sin')).document,
    ).toMatchObject({ fileName: null, status: { key: 'Draft' } });
    const list = (await s.getProfileDocuments(LUCIA)).documents;
    expect(list.find((x) => x.id === 'doc-cad')!.expiresOn! < '2030').toBe(
      true,
    );
  });
  it('las fechas siguen al reloj del falso', async () => {
    const s = server('family', { clock: '2026-12-01T10:00:00Z' });
    const d = (await s.getProfileDocument(LUCIA, 'doc-aut')).document;
    expect(d.activeOn).toBe('2026-11-11');
    expect(d.expiresOn).toBe('2027-06-19');
  });
  it('el archivo se pide con la sesión por su ruta de documentos', () => {
    const s = server();
    expect(s.documentFileSource(LUCIA, 'doc-aut').uri).toContain(
      '/documents/doc-aut/file',
    );
  });
});

describe('documentos: subir, editar y borrar', () => {
  it('subir guarda y vuelve a leer; el mismo clientId, un solo documento', async () => {
    const s = server();
    const clientId = uuidV4();
    const r = await create(s, LUCIA, { clientId, name: '  Justificante  ' });
    expect(r.crmIds?.[0]).toMatch(/^doc-nuevo/);
    await create(s, LUCIA, { clientId, name: 'Otro nombre' });
    expect(s.writeCount).toBe(1);
    const docs = (await s.getProfileDocuments(LUCIA)).documents;
    expect(docs.filter((d) => d.name === 'Justificante')).toHaveLength(1);
    expect(docs.some((d) => d.name === 'Otro nombre')).toBe(false);
    const d = (await s.getProfileDocument(LUCIA, r.crmIds![0])).document;
    expect(d).toMatchObject({
      name: 'Justificante',
      fileName: 'a.pdf',
      status: { key: 'Active' },
    });
  });
  it('el archivo se mira ANTES de escribir: vacío, más de 4 MB y extensión', async () => {
    const s = server();
    expect(await code(create(s, LUCIA, {}, file('a.pdf', 0)))).toBe(
      'validation:422:empty_file',
    );
    expect(
      await code(create(s, LUCIA, {}, file('a.pdf', 4 * 1024 * 1024 + 1))),
    ).toBe('validation:422:file_too_big');
    expect(await code(create(s, LUCIA, {}, file('a.exe', 10)))).toBe(
      'validation:422:bad_file_type',
    );
    expect(await code(create(s, LUCIA, {}, file('a.svg', 10)))).toBe(
      'validation:422:bad_file_type',
    );
    expect(await code(create(s, LUCIA, { name: '   ' }))).toBe(
      'validation:422:bad_name',
    );
    expect(s.writeCount).toBe(0);
    expect(
      await code(create(s, LUCIA, {}, file('a.pdf', 4 * 1024 * 1024))),
    ).toBe('ok');
  });
  it('editar manda solo lo que llega; un archivo nuevo cambia el archivo', async () => {
    const s = server();
    await s.updateProfileDocument(LUCIA, 'doc-aut', {
      clientId: uuidV4(),
      name: 'Autorización firmada',
    });
    let d = (await s.getProfileDocument(LUCIA, 'doc-aut')).document;
    expect(d).toMatchObject({
      name: 'Autorización firmada',
      description: 'Firmada por los padres.',
      fileName: 'autorizacion.pdf',
    });
    await s.updateProfileDocument(
      LUCIA,
      'doc-aut',
      { clientId: uuidV4(), description: '' },
      file('nueva.pdf'),
    );
    d = (await s.getProfileDocument(LUCIA, 'doc-aut')).document;
    expect(d).toMatchObject({
      name: 'Autorización firmada',
      description: null,
      fileName: 'nueva.pdf',
    });
    expect(
      await code(
        s.updateProfileDocument(
          LUCIA,
          'doc-aut',
          { clientId: uuidV4() },
          file('x.exe'),
        ),
      ),
    ).toBe('validation:422:bad_file_type');
    expect(
      await code(
        s.updateProfileDocument(LUCIA, 'ajeno', {
          clientId: uuidV4(),
          name: 'x',
        }),
      ),
    ).toBe('forbidden:403:document_out_of_scope');
  });
  it('borrar es lógico: deja de salir y su ficha da 403; el mismo clientId, una vez', async () => {
    const s = server();
    const clientId = uuidV4();
    await s.deleteProfileDocument(LUCIA, 'doc-dni', clientId);
    await s.deleteProfileDocument(LUCIA, 'doc-dni', clientId);
    expect(s.writeCount).toBe(1);
    expect(
      (await s.getProfileDocuments(LUCIA)).documents.map((d) => d.id),
    ).not.toContain('doc-dni');
    expect(await code(s.getProfileDocument(LUCIA, 'doc-dni'))).toBe(
      'forbidden:403:document_out_of_scope',
    );
    expect(
      await code(s.deleteProfileDocument(LUCIA, 'doc-dni', uuidV4())),
    ).toBe('forbidden:403:document_out_of_scope');
  });
  it('con el CRM caído, subir y borrar fallan y no cambian nada; reintentar con el mismo clientId no duplica', async () => {
    const s = server('family', { crmDown: true });
    const clientId = uuidV4();
    expect(await code(create(s, LUCIA, { clientId }))).toBe(
      'crm_unavailable:503',
    );
    expect(
      await code(s.deleteProfileDocument(LUCIA, 'doc-dni', uuidV4())),
    ).toBe('crm_unavailable:503');
    expect(
      (await s.getProfileDocuments(LUCIA)).documents.map((d) => d.id),
    ).toContain('doc-dni');
    s.setControls({ crmDown: false });
    await create(s, LUCIA, { clientId });
    await create(s, LUCIA, { clientId });
    expect(
      (await s.getProfileDocuments(LUCIA)).documents.filter(
        (d) => d.name === 'Mi documento',
      ),
    ).toHaveLength(1);
  });
  it('sin red, todo falla', async () => {
    expect(
      await code(
        server('family', { offline: true }).getProfileDocuments(LUCIA),
      ),
    ).toMatch(/^network/);
  });
});

describe('calendario', () => {
  it('un curso de ~24 sesiones con las cuatro marcas y sin marcar; las futuras, sin marca', async () => {
    const s = server();
    const c = await s.getProfileCalendar(LUCIA);
    expect(CalendarData.safeParse(c).success).toBe(true);
    expect(c.sessions).toHaveLength(24);
    const marks = new Set(c.sessions.map((x) => x.attendance));
    for (const m of ['yes', 'partial', 'no_justified', 'no_unjustified', null])
      expect(marks.has(m as never)).toBe(true);
    const future = c.sessions.filter(
      (x) =>
        new Date(x.startsAt).getTime() > Date.now() + 0 &&
        x.attendance !== null,
    );
    expect(future).toEqual([]);
    expect(c.sessions.every((x) => x.eventId === 'pev-curso')).toBe(true);
  });
  it('lo que sale: con plaza (sin canceladas) y abiertos (con audiencia, sin ocultos ni los que ya tienen plaza ni los de otra delegación)', async () => {
    const s = server();
    const c = await s.getProfileCalendar(LUCIA);
    const reg = c.registeredEvents.map((e) => e.id);
    expect(reg).toEqual(expect.arrayContaining(['pev-sesiones', 'pev-curso']));
    const open = c.openEvents.map((e) => e.id);
    expect(open).toContain('pev-convi');
    for (const out of [
      'pev-otra-del',
      'pev-oculta-sin',
      'pev-oculta-con',
      'pev-sesiones',
      'pev-monitores',
      'pev-otro-curso',
      'pev-cerrada',
      'pev-no-abre',
    ])
      expect(open).not.toContain(out);
  });
  it('una inscripción cancelada deja de ser «con plaza» y el evento vuelve a abrirse', async () => {
    const s = server();
    await s.cancelRegistration(LUCIA, 'reg-lucia-sesiones', {
      clientId: uuidV4(),
    });
    const c = await s.getProfileCalendar(LUCIA);
    expect(c.registeredEvents.map((e) => e.id)).not.toContain('pev-sesiones');
    expect(c.openEvents.map((e) => e.id)).toContain('pev-sesiones');
  });
  it('un hijo sin curso: sin sesiones; el calendario de uno no es el del otro', async () => {
    const s = server();
    expect((await s.getProfileCalendar(NICO)).sessions).toEqual([]);
    expect(
      (await s.getProfileCalendar(NICO)).registeredEvents.map((e) => e.id),
    ).not.toContain('pev-curso');
  });
  it('la sesión: con inscripción activa, sí; sin ella o de otro perfil, 403', async () => {
    const s = server();
    const ses = (await s.getProfileCalendar(LUCIA)).sessions[0];
    expect((await s.getProfileSession(LUCIA, ses.id)).session).toMatchObject({
      id: ses.id,
      description: expect.any(String),
    });
    expect(await code(s.getProfileSession(NICO, ses.id))).toBe(
      'forbidden:403:document_out_of_scope',
    );
    expect(await code(s.getProfileSession(LUCIA, 'no-existe'))).toBe(
      'forbidden:403:document_out_of_scope',
    );
    expect(
      await code(
        s.getProfileSession(s.data.personas.memberNoKids.personId, ses.id),
      ),
    ).toBe('forbidden:403');
  });
  it('apuntarse a algo cambia el calendario', async () => {
    const s = server();
    await s.signUp(LUCIA, {
      clientId: uuidV4(),
      eventId: 'pev-convi',
      answers: [
        { n: 1, option: 1 },
        { n: 2, option: 1 },
      ],
      payment: { method: 'card' },
    });
    const c = await s.getProfileCalendar(LUCIA);
    expect(c.registeredEvents.map((e) => e.id)).toContain('pev-convi');
    expect(c.openEvents.map((e) => e.id)).not.toContain('pev-convi');
  });
});
