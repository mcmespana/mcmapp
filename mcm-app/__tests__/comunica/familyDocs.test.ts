/**
 * Documentos y calendario de familias (plan 16): reglas puras, el servidor
 * falso, el cliente (archivos y multipart) y los guardarraíles.
 */
import fs from 'fs';
import path from 'path';
import { ROUTES } from '@/services/comunica/contract';
import {
  ComunicaApiError,
  createHttpClient,
  fileNameFromDisposition,
  type FileTransport,
} from '@/services/comunica/client';
import { createFakeServer } from '@/services/comunica/fake';
import { nativeHrefFor } from '@/services/comunica/links';
import {
  calendarItemsByDay,
  dayA11y,
  dayDots,
  dayForMonth,
  dayTitle,
  eventDays,
  sessionBucket,
  sessionTitle,
  timeRangeText,
  upcomingAgendaItems,
} from '@/utils/comunica/calendar';
import {
  documentChanges,
  documentChip,
  isExpired,
  sortDocuments,
  statusTone,
} from '@/utils/comunica/documents';
import {
  documentFileProblem,
  documentKind,
  MAX_DOCUMENT_BYTES,
  openModeOf,
} from '@/utils/comunica/files';
import { fileProblem } from '@/utils/comunica/monitorProfile';
import { uuidV4 } from '@/utils/comunica/uuid';

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => e.code,
  );

describe('archivos (puro)', () => {
  it('documentKind', () => {
    expect(documentKind('x.JPEG')).toBe('JPG');
    expect(documentKind('a.b.docx')).toBe('DOC');
    expect(documentKind('sin-extension')).toBe('');
    expect(documentKind('x.toolong')).toBe('');
    expect(documentKind('x.p_f')).toBe('');
    expect(documentKind('x.pdf')).toBe('PDF');
  });

  it('validación: 0 bytes, 4 MB justos y +1, mayúsculas, heic y .exe', () => {
    const f = (name: string, size: number) =>
      documentFileProblem({ name, size });
    expect(f('a.pdf', 0)).toBe('empty');
    expect(f('a.pdf', MAX_DOCUMENT_BYTES)).toBeNull();
    expect(f('a.pdf', MAX_DOCUMENT_BYTES + 1)).toBe('too_big');
    expect(f('A.PDF', 10)).toBeNull();
    expect(f('foto.heic', 10)).toBeNull();
    expect(f('virus.exe', 10)).toBe('bad_type');
    expect(f('7mb.pdf', 7 * 1024 * 1024)).toBe('too_big');
    // Los certificados del monitor (plan 09) no admiten HEIC.
    expect(fileProblem({ name: 'foto.heic', size: 10 })).toBe('bad_type');
  });

  it('cómo se abre cada tipo en cada plataforma', () => {
    expect(openModeOf('image/png', 'android')).toBe('image');
    expect(openModeOf('application/pdf', 'ios')).toBe('pdf');
    expect(openModeOf('application/pdf', 'android')).toBe('system');
    expect(openModeOf('application/pdf', 'web')).toBe('tab');
    expect(openModeOf('application/msword', 'ios')).toBe('system');
  });
});

describe('documentos (puro)', () => {
  const doc = (
    id: string,
    activeOn: string | null,
    expiresOn: string | null,
  ) => ({
    id,
    name: id,
    fileName: `${id}.pdf`,
    status: { key: 'Active', label: 'Activo' },
    activeOn,
    expiresOn,
  });
  const today = '2026-11-01';

  it('caducado ayer sí, hoy no, sin fecha no', () => {
    expect(isExpired({ expiresOn: '2026-10-31' }, today)).toBe(true);
    expect(isExpired({ expiresOn: today }, today)).toBe(false);
    expect(isExpired({ expiresOn: null }, today)).toBe(false);
  });

  it('orden: lo caducado al final; el resto, lo más reciente arriba', () => {
    const out = sortDocuments(
      [
        doc('viejo', '2026-01-01', null),
        doc('caducado', '2026-10-30', '2026-10-01'),
        doc('nuevo', '2026-10-20', null),
        doc('sinfecha', null, null),
      ],
      today,
    ).map((d) => d.id);
    expect(out).toEqual(['nuevo', 'viejo', 'sinfecha', 'caducado']);
  });

  it('chip: «Caducado» en rojo o el estado por su clave (neutro ante la duda)', () => {
    expect(documentChip(doc('a', null, '2026-01-01'), today)).toEqual({
      label: 'Caducado',
      tone: 'negative',
    });
    expect(statusTone('Active')).toBe('positive');
    expect(statusTone('Draft')).toBe('warning');
    expect(statusTone('not_active')).toBe('neutral');
    expect(statusTone('rarisimo')).toBe('neutral');
  });

  it('editar manda solo lo que cambia', () => {
    const base = { name: 'A', description: '' };
    expect(documentChanges(base, base)).toEqual({});
    expect(documentChanges(base, { name: 'B', description: '' })).toEqual({
      name: 'B',
    });
  });
});

describe('calendario (puro)', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const s = (
    startsAt: string,
    attendance: 'yes' | 'partial' | 'no_unjustified' | 'no_justified' | null,
  ) => ({
    startsAt,
    attendance,
  });

  it('C4: futura sigue «Próxima»; pasada sin marca, «Sin registrar»; parcial, asistió', () => {
    expect(
      sessionBucket(s('2026-11-08T16:30:00Z', 'no_unjustified'), now),
    ).toBe('upcoming');
    expect(sessionBucket(s('2026-10-25T16:30:00Z', null), now)).toBe('pending');
    expect(sessionBucket(s('2026-10-25T16:30:00Z', 'partial'), now)).toBe(
      'attended',
    );
    expect(sessionBucket(s('2026-10-25T16:30:00Z', 'no_justified'), now)).toBe(
      'absent',
    );
  });

  it('C5: un evento de tres días marca los tres; la banda se oculta si hay sesiones', () => {
    expect(
      eventDays({ startDate: '2026-11-06', endDate: '2026-11-08' }),
    ).toHaveLength(3);
    const byDay = calendarItemsByDay(
      {
        sessions: [
          {
            id: 's1',
            name: 'Sesión 1 | 30/10/2026 17:30h',
            eventId: 'curso',
            eventName: 'Curso',
            startsAt: '2026-11-07T16:30:00Z',
            endsAt: '2026-11-07T18:00:00Z',
            attendance: null,
          },
        ],
        registeredEvents: [
          {
            id: 'curso',
            name: 'Curso',
            startDate: '2026-09-01',
            endDate: '2027-06-01',
          },
          {
            id: 'conv',
            name: 'Convivencia',
            startDate: '2026-11-06',
            endDate: '2026-11-08',
          },
        ],
        openEvents: [],
      },
      now,
    );
    expect(byDay.get('2026-11-06')?.map((i) => i.id)).toEqual(['conv']);
    expect(byDay.get('2026-11-08')?.map((i) => i.id)).toEqual(['conv']);
    expect(byDay.get('2026-10-01')).toBeUndefined();
    const sat = byDay.get('2026-11-07')!;
    expect(sat.map((i) => i.title)).toEqual(['Convivencia', 'Sesión 1']);
    expect(dayDots(sat)).toEqual(['registered', 'upcoming']);
  });

  it('el día 1 cuando hoy no cae en el mes', () => {
    expect(dayForMonth('2026-12', '2026-11-01')).toBe('2026-12-01');
    expect(dayForMonth('2026-11', '2026-11-14')).toBe('2026-11-14');
  });

  it('textos: título del día, rango de horas, nombre sin sufijo, lector', () => {
    expect(dayTitle('2026-10-14')).toBe('Miércoles, 14 de octubre');
    expect(timeRangeText('2026-10-24T15:30:00Z', '2026-10-24T17:00:00Z')).toBe(
      '17:30 – 19:00',
    );
    expect(timeRangeText('2026-10-24T15:30:00Z', null)).toBe('17:30');
    expect(timeRangeText('2026-10-24T21:30:00Z', '2026-10-25T01:00:00Z')).toBe(
      '23:30',
    );
    expect(sessionTitle('COM | Curso · BU | 30/10/2026 17:30h')).toBe(
      'COM | Curso · BU',
    );
    expect(dayA11y('2026-10-14', 2)).toBe('14 de octubre, 2 actividades');
  });

  it('upcomingAgendaItems: los abiertos de hoy en adelante, por fecha', () => {
    const items = upcomingAgendaItems(
      {
        openEvents: [
          { id: 'b', name: 'B', startDate: '2026-11-10', endDate: null },
          { id: 'a', name: 'A', startDate: '2026-11-02', endDate: null },
          { id: 'old', name: 'Old', startDate: '2026-10-01', endDate: null },
        ],
      },
      '2026-11-01',
    );
    expect(items.map((i) => i.eventId)).toEqual(['a', 'b']);
  });
});

describe('servidor falso de documentos y sesiones', () => {
  const server = (patch = {}) =>
    createFakeServer({ latencyMs: 0, persona: 'guardianTwo', ...patch });
  const pdf = {
    uri: 'file:///a.pdf',
    name: 'a.pdf',
    mimeType: 'application/pdf',
    size: 100,
  };

  it('sube, edita, borra y vuelve a leer; pid ajeno → 403', async () => {
    const s = server();
    const before = (await s.getProfileDocuments('f-fam-lucia')).documents
      .length;
    const r = await s.uploadProfileDocument(
      'f-fam-lucia',
      { clientId: uuidV4(), name: 'Nuevo' },
      pdf,
    );
    const id = r.crmIds![0];
    expect((await s.getProfileDocuments('f-fam-lucia')).documents).toHaveLength(
      before + 1,
    );
    await s.updateProfileDocument('f-fam-lucia', id, {
      clientId: uuidV4(),
      name: 'Renombrado',
    });
    expect((await s.getProfileDocument('f-fam-lucia', id)).document.name).toBe(
      'Renombrado',
    );
    await s.deleteProfileDocument('f-fam-lucia', id, uuidV4());
    expect(await code(s.getProfileDocument('f-fam-lucia', id))).toBe(
      'forbidden',
    );
    expect(await code(s.getProfileDocuments('f-fam-pablo'))).toBe('forbidden');
  });

  it('lo caducado sale al final; uno sin archivo da 404 al pedirlo', async () => {
    const s = server();
    const { documents } = await s.getProfileDocuments('f-fam-lucia');
    expect(documents.at(-1)?.expiresOn).not.toBeNull();
    const noFile = documents.find((d) => !d.fileName)!;
    expect(await code(s.getProfileDocumentFile('f-fam-lucia', noFile.id))).toBe(
      'not_found',
    );
  });

  it('con el CRM caído falla, y el reintento con el mismo clientId no duplica', async () => {
    const s = server({ crmDown: true });
    const clientId = uuidV4();
    expect(
      await code(
        s.uploadProfileDocument('f-fam-lucia', { clientId, name: 'X' }, pdf),
      ),
    ).toBe('crm_unavailable');
    s.setControls({ crmDown: false });
    const n = (await s.getProfileDocuments('f-fam-lucia')).documents.length;
    await s.uploadProfileDocument('f-fam-lucia', { clientId, name: 'X' }, pdf);
    await s.uploadProfileDocument('f-fam-lucia', { clientId, name: 'X' }, pdf);
    expect((await s.getProfileDocuments('f-fam-lucia')).documents).toHaveLength(
      n + 1,
    );
  });

  it('rechaza un .exe y uno de más de 4 MB', async () => {
    const s = server();
    const up = (name: string, size: number) =>
      code(
        s.uploadProfileDocument(
          'f-fam-lucia',
          { clientId: uuidV4(), name: 'X' },
          { ...pdf, name, size },
        ),
      );
    expect(await up('a.exe', 10)).toBe('validation');
    expect(await up('a.pdf', 7 * 1024 * 1024)).toBe('validation');
  });

  it('la sesión: con inscripción se ve; sin ella, 403', async () => {
    const s = server();
    const cal = await s.getProfileCalendar('f-fam-lucia');
    expect(cal.sessions.length).toBeGreaterThan(20);
    const marks = new Set(cal.sessions.map((x) => x.attendance));
    for (const m of [
      'yes',
      'partial',
      'no_justified',
      'no_unjustified',
      null,
    ]) {
      expect(marks.has(m as never)).toBe(true);
    }
    const id = cal.sessions[0].id;
    expect(await code(s.getProfileSession('f-fam-lucia', id))).toBe('ok');
    expect(await code(s.getProfileSession('f-fam-rosa', id))).toBe('forbidden');
  });
});

describe('cliente: archivos', () => {
  const transport = (
    status: number,
    body = '',
    headers: Record<string, string> = {},
  ): FileTransport => ({
    download: jest.fn(async () => ({
      status,
      headers,
      uri: 'file:///cache/comunica/open/x',
    })),
    readText: async () => body,
    saveBytes: async () => 'file:///x',
    remove: jest.fn(),
  });

  it('baja con el token y saca el nombre y el tipo de las cabeceras', async () => {
    const files = transport(200, '', {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        'inline; filename="a.pdf"; filename*=UTF-8\'\'Autorizaci%C3%B3n.pdf',
    });
    const api = createHttpClient({
      baseUrl: 'https://x.test',
      getToken: () => 'tok',
      files,
    });
    const f = await api.getProfileDocumentFile('p1', 'd1');
    expect(f).toEqual({
      localUri: 'file:///cache/comunica/open/x',
      fileName: 'Autorización.pdf',
      mimeType: 'application/pdf',
    });
    expect(files.download).toHaveBeenCalledWith(
      'https://x.test/v1/profiles/p1/documents/d1/file',
      { Authorization: 'Bearer tok' },
      'documento',
      undefined,
    );
  });

  it('un error se lee de su cuerpo y el archivo se borra', async () => {
    const files = transport(
      403,
      JSON.stringify({ error: { code: 'forbidden', message: 'No' } }),
    );
    const api = createHttpClient({ baseUrl: 'https://x.test', files });
    expect(await code(api.getProfileDocumentFile('p1', 'd1'))).toBe(
      'forbidden',
    );
    expect(files.remove).toHaveBeenCalled();
  });

  it('nombre de Content-Disposition', () => {
    expect(fileNameFromDisposition('attachment; filename="x.docx"')).toBe(
      'x.docx',
    );
    expect(fileNameFromDisposition('')).toBeNull();
  });
});

const ROOT = path.join(__dirname, '..', '..');
const walk = (d: string): string[] =>
  fs.existsSync(d)
    ? fs
        .readdirSync(d, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(d, e.name))
            : /\.tsx?$/.test(e.name)
              ? [path.join(d, e.name)]
              : [],
        )
    : [];

describe('guardarraíles del plan 16', () => {
  it('los documentos nunca se guardan en el móvil; la sesión y el calendario, sí', () => {
    for (const r of [
      'profileDocuments',
      'profileDocument',
      'profileDocumentFile',
      'uploadProfileDocument',
      'updateProfileDocument',
      'deleteProfileDocument',
    ] as const) {
      expect(ROUTES[r].persist).toBe(false);
    }
    expect(ROUTES.profileCalendar.persist).toBe(true);
  });

  const screens = [
    'components/comunica/documentos',
    'components/comunica/calendario',
    'app/(tabs)/comunica/documentos',
    'app/(tabs)/comunica/calendario',
  ].flatMap((d) => walk(path.join(ROOT, d)));

  it('ninguna pantalla hace fetch, arma URLs del servidor ni usa la cola', () => {
    expect(screens.length).toBeGreaterThan(5);
    for (const f of [
      ...screens,
      path.join(ROOT, 'hooks/comunica/useDocuments.ts'),
    ]) {
      const src = fs.readFileSync(f, 'utf8');
      expect({ f, hit: /\bfetch\s*\(|\/v1\/|enqueueWrite/.test(src) }).toEqual({
        f,
        hit: false,
      });
    }
  });

  it('ningún enlace del mapa lleva a borrar', () => {
    for (const action of ['detail', 'edit', 'create'] as const) {
      const href = nativeHrefFor({
        internalpage: 'single_stic_documents',
        action,
        id: 'abcdef0123',
      });
      expect(JSON.stringify(href)).not.toMatch(/delete|borrar|eliminar/i);
    }
    expect(
      nativeHrefFor({ internalpage: 'single_stic_documents', action: 'create' })
        ?.pathname,
    ).toBe('/comunica/documentos/subir');
    expect(
      nativeHrefFor({ internalpage: 'list_stic_sessions' })?.params,
    ).toEqual({ view: 'agenda' });
  });

  it('el visor no pide archivos: los recibe ya bajados', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'components/comunica/comun/FileViewerScreen.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/getProfileDocumentFile|getComunicaApi/);
  });
});
