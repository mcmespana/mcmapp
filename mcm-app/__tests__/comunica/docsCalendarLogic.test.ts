/**
 * Documentos y calendario (plan 16, tareas 3, 4 y 12), lógica pura: validar un archivo, el tipo de la cápsula, lo caducado y el orden, el color de una sesión, las
 * bandas de los eventos, los puntitos, el mes, la agenda y el mapa de enlaces.
 */
import { DocumentSummary } from '@/services/comunica/contract';
import type { CalendarSession } from '@/services/comunica/contract';
import { nativeHrefFor } from '@/services/comunica/links';
import {
  agendaOfMonth,
  dayItems,
  dayLabel,
  dayOnMonthChange,
  dayTitle,
  dotsOf,
  eventDays,
  itemLine,
  LEGEND,
  monthTitle,
  monthWeeks,
  sessionState,
  shiftMonth,
  timeRange,
  upcomingAgendaItems,
} from '@/utils/comunica/calendar';
import {
  dateLine,
  documentChanges,
  documentChip,
  documentKind,
  documentTitle,
  isExpired,
  orderDocuments,
} from '@/utils/comunica/documents';
import {
  DOCUMENT_EXTENSIONS,
  defaultDocumentName,
  fileExtension,
  fileProblem,
  isImageFile,
  isPdfFile,
  MAX_FILE_BYTES,
  mimeOf,
  safeFileName,
} from '@/utils/comunica/files';

const NOW = new Date('2026-11-01T10:00:00Z').getTime();
const TODAY = '2026-11-01';

describe('archivos: extensión y validación', () => {
  it('la extensión en minúsculas; sin extensión, demasiado larga o con caracteres raros, nada', () => {
    expect(fileExtension('x.PDF')).toBe('pdf');
    expect(fileExtension('a.b.docx')).toBe('docx');
    expect(fileExtension('sin-extension')).toBeNull();
    expect(fileExtension('x.toolong')).toBeNull();
    expect(fileExtension('x.p_f')).toBeNull();
    expect(fileExtension('x.')).toBeNull();
  });
  it('0 bytes, 4 MB justos y +1, mayúsculas, SVG y ejecutables', () => {
    expect(fileProblem({ name: 'a.pdf', size: 0 })).toBe(
      'El archivo está vacío',
    );
    expect(fileProblem({ name: 'a.pdf', size: MAX_FILE_BYTES })).toBeNull();
    expect(fileProblem({ name: 'a.pdf', size: MAX_FILE_BYTES + 1 })).toBe(
      'Ese archivo pesa más de 4 MB',
    );
    expect(fileProblem({ name: 'A.PDF', size: 10 })).toBeNull();
    expect(fileProblem({ name: 'logo.svg', size: 10 })).toBe(
      'Ese tipo de archivo no se puede subir',
    );
    expect(fileProblem({ name: 'virus.exe', size: 10 })).toBe(
      'Ese tipo de archivo no se puede subir',
    );
    expect(fileProblem({ name: 'sin', size: 10 })).toBe(
      'Ese tipo de archivo no se puede subir',
    );
    // 7 MB y .exe: se rechaza.
    expect(
      fileProblem({ name: 'a.exe', size: 7 * 1024 * 1024 }),
    ).not.toBeNull();
    expect(DOCUMENT_EXTENSIONS).not.toContain('svg');
    expect(DOCUMENT_EXTENSIONS).not.toContain('html');
  });
  it('HEIC vale como documento y no como certificado (lista propia)', () => {
    expect(fileProblem({ name: 'foto.heic', size: 10 })).toBeNull();
    expect(
      fileProblem({ name: 'foto.heic', size: 10 }, [
        'pdf',
        'jpg',
        'jpeg',
        'png',
      ]),
    ).toBe('Ese tipo de archivo no se puede subir');
  });
  it('MIME por extensión, imagen o PDF y nombre seguro', () => {
    expect(mimeOf('a.PDF')).toBe('application/pdf');
    expect(mimeOf('a.jpeg')).toBe('image/jpeg');
    expect(mimeOf('a.xyz')).toBe('application/octet-stream');
    expect(isImageFile('a.png')).toBe(true);
    expect(isImageFile('a.heic')).toBe(false);
    expect(isPdfFile('a.pdf')).toBe(true);
    expect(safeFileName('../../etc/pásswd ñ.pdf')).toBe('passwd_n.pdf');
    expect(safeFileName('')).toBe('archivo');
    expect(safeFileName('C:\\x\\y.docx')).toBe('y.docx');
    expect(defaultDocumentName('Informe final.PDF')).toBe('Informe final');
    expect(defaultDocumentName('foto_del_dni.png')).toBe('foto del dni');
  });
});

describe('documentos: tipo, caducado, orden y chip', () => {
  const doc = (over: Partial<DocumentSummary> = {}): DocumentSummary => ({
    id: 'd',
    name: 'Doc',
    fileName: 'a.pdf',
    status: { key: 'Active', label: 'Activo' },
    activeOn: '2026-10-01',
    expiresOn: null,
    ...over,
  });
  it('el tipo: JPEG→JPG, DOCX→DOC, XLSX→XLS; sin extensión válida, nada', () => {
    expect(documentKind('x.JPEG')).toBe('JPG');
    expect(documentKind('a.b.docx')).toBe('DOC');
    expect(documentKind('a.xlsx')).toBe('XLS');
    expect(documentKind('a.pdf')).toBe('PDF');
    expect(documentKind('a.heic')).toBe('HEIC');
    expect(documentKind('sin')).toBeNull();
    expect(documentKind('x.toolong')).toBeNull();
    expect(documentKind('x.p_f')).toBeNull();
    expect(documentKind(null)).toBeNull();
  });
  it('caducado ayer sí, hoy no, sin fecha no', () => {
    expect(isExpired({ expiresOn: '2026-10-31' }, TODAY)).toBe(true);
    expect(isExpired({ expiresOn: TODAY }, TODAY)).toBe(false);
    expect(isExpired({ expiresOn: null }, TODAY)).toBe(false);
  });
  it('lo más reciente arriba (sin fecha, al final de lo vigente) y lo caducado, al final', () => {
    const o = orderDocuments(
      [
        doc({ id: 'old', activeOn: '2026-01-01' }),
        doc({ id: 'cad', activeOn: '2026-10-30', expiresOn: '2026-10-31' }),
        doc({ id: 'none', activeOn: null }),
        doc({ id: 'new', activeOn: '2026-10-20' }),
      ],
      TODAY,
    );
    expect(o.map((d) => d.id)).toEqual(['new', 'old', 'none', 'cad']);
  });
  it('el chip: «Caducado» en rojo; si no, el estado con color por clave (neutro ante la duda); sin estado, nada', () => {
    expect(documentChip(doc({ expiresOn: '2026-10-01' }), TODAY)).toEqual({
      label: 'Caducado',
      tone: 'negative',
    });
    expect(documentChip(doc(), TODAY)).toEqual({
      label: 'Activo',
      tone: 'positive',
    });
    expect(
      documentChip(doc({ status: { key: 'Draft', label: 'Borrador' } }), TODAY),
    ).toEqual({ label: 'Borrador', tone: 'neutral' });
    expect(
      documentChip(doc({ status: { key: 'Raro', label: 'Raro' } }), TODAY)
        ?.tone,
    ).toBe('neutral');
    expect(documentChip(doc({ status: null }), TODAY)).toBeNull();
  });
  it('el nombre visible, «Del …» y lo que cambia al editar', () => {
    expect(documentTitle({ name: '  ', fileName: 'a.pdf' })).toBe('a.pdf');
    expect(documentTitle({ name: '', fileName: null })).toBe('Documento');
    expect(dateLine({ activeOn: '2026-10-03' })).toBe(
      'Del 3 de octubre de 2026',
    );
    expect(dateLine({ activeOn: null })).toBeNull();
    const c = { name: 'A', description: null };
    expect(documentChanges(c, { name: 'A', description: '' })).toEqual({});
    expect(documentChanges(c, { name: ' B ', description: '' })).toEqual({
      name: 'B',
    });
    expect(
      documentChanges(
        { name: 'A', description: 'x' },
        { name: 'A', description: '' },
      ),
    ).toEqual({ description: '' });
  });
  it('el contrato rechaza lo que no tiene la forma', () => {
    expect(DocumentSummary.safeParse(doc()).success).toBe(true);
    expect(
      DocumentSummary.safeParse({ ...doc(), expiresOn: '31/10/2026' }).success,
    ).toBe(false);
  });
});

describe('calendario: el color de una sesión (C4)', () => {
  const at = (startsAt: string, attendance: CalendarSession['attendance']) => ({
    startsAt,
    attendance,
  });
  it('futura es «Próxima» tenga la marca que tenga', () => {
    expect(
      sessionState(at('2026-11-08T16:30:00Z', 'no_unjustified'), NOW),
    ).toBe('upcoming');
    expect(sessionState(at('2026-11-08T16:30:00Z', 'yes'), NOW)).toBe(
      'upcoming',
    );
  });
  it('pasada: yes «Asististe», no_unjustified «No asististe», sin marca «Sin registrar»', () => {
    expect(sessionState(at('2026-10-25T16:30:00Z', 'yes'), NOW)).toBe(
      'attended',
    );
    expect(
      sessionState(at('2026-10-25T16:30:00Z', 'no_unjustified'), NOW),
    ).toBe('missed');
    expect(sessionState(at('2026-10-25T16:30:00Z', null), NOW)).toBe(
      'unmarked',
    );
  });
  it('«parcial» se junta con «Asististe» y «justificada» con «No asististe»', () => {
    expect(sessionState(at('2026-10-25T16:30:00Z', 'partial'), NOW)).toBe(
      'attended',
    );
    expect(sessionState(at('2026-10-25T16:30:00Z', 'no_justified'), NOW)).toBe(
      'missed',
    );
  });
  it('el rango de horas: inicio – fin; sin fin o cruzando la medianoche, solo el inicio (horario de Madrid)', () => {
    expect(
      timeRange({
        startsAt: '2026-11-08T16:30:00Z',
        endsAt: '2026-11-08T18:00:00Z',
      }),
    ).toBe('17:30 – 19:00');
    expect(timeRange({ startsAt: '2026-11-08T16:30:00Z', endsAt: null })).toBe(
      '17:30',
    );
    expect(
      timeRange({
        startsAt: '2026-11-08T22:30:00Z',
        endsAt: '2026-11-09T00:30:00Z',
      }),
    ).toBe('23:30');
  });
});

describe('calendario: bandas, puntitos y día', () => {
  const session = (
    id: string,
    startsAt: string,
    eventId = 'ev1',
    attendance: CalendarSession['attendance'] = null,
  ): CalendarSession => ({
    id,
    name: `S${id}`,
    eventId,
    eventName: 'Curso',
    startsAt,
    endsAt: null,
    attendance,
  });
  it('un evento de tres días marca los tres', () => {
    expect(
      eventDays({ startDate: '2026-11-20', endDate: '2026-11-22' }),
    ).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(eventDays({ startDate: '2026-11-20', endDate: null })).toEqual([
      '2026-11-20',
    ]);
    expect(
      eventDays({ startDate: '2026-11-20', endDate: '2026-11-19' }),
    ).toEqual(['2026-11-20']);
  });
  it('un evento que ya aporta sesiones no pinta banda (un curso de octubre a mayo taparía el mes)', () => {
    const m = dayItems(
      {
        sessions: [session('1', '2026-11-08T16:30:00Z')],
        registeredEvents: [
          {
            id: 'ev1',
            name: 'Curso',
            startDate: '2026-10-01',
            endDate: '2027-05-30',
          },
          {
            id: 'ev2',
            name: 'Convivencia',
            startDate: '2026-11-20',
            endDate: '2026-11-22',
          },
        ],
        openEvents: [
          {
            id: 'ev3',
            name: 'Abierto',
            startDate: '2026-11-08',
            endDate: null,
          },
        ],
      },
      NOW,
    );
    expect(m.get('2026-10-15')).toBeUndefined();
    expect(m.get('2026-11-21')?.map((i) => i.kind)).toEqual(['registered']);
    expect(m.get('2026-11-08')?.map((i) => i.kind)).toEqual([
      'open',
      'session',
    ]);
  });
  it('hasta 4 puntitos por día, con el color de lo que hay', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      session(String(i), '2026-11-08T16:30:00Z'),
    );
    const day = dayItems(
      { sessions: items, registeredEvents: [], openEvents: [] },
      NOW,
    ).get('2026-11-08')!;
    expect(dotsOf(day)).toHaveLength(4);
    expect(dotsOf(day)[0]).toBe('info');
    const past = dayItems(
      {
        sessions: [session('p', '2026-10-25T16:30:00Z', 'ev1', 'yes')],
        registeredEvents: [],
        openEvents: [],
      },
      NOW,
    );
    expect(dotsOf(past.get('2026-10-25')!)).toEqual(['positive']);
  });
  it('la fila de un día: «17:30 · Curso · Asististe» o «Todo el día · … · Con plaza»', () => {
    const m = dayItems(
      {
        sessions: [session('1', '2026-10-25T16:30:00Z', 'ev1', 'yes')],
        registeredEvents: [
          {
            id: 'ev2',
            name: 'Convivencia',
            startDate: '2026-11-20',
            endDate: null,
          },
        ],
        openEvents: [
          {
            id: 'ev3',
            name: 'Campamento',
            startDate: '2026-12-01',
            endDate: null,
          },
        ],
      },
      NOW,
    );
    expect(itemLine(m.get('2026-10-25')![0])).toBe('17:30 · Curso · Asististe');
    expect(itemLine(m.get('2026-11-20')![0])).toBe(
      'Todo el día · Convivencia · Con plaza',
    );
    expect(itemLine(m.get('2026-12-01')![0])).toBe(
      'Todo el día · Campamento · Abierto a inscripción',
    );
  });
  it('el resumen de un día para el lector de pantalla', () => {
    expect(dayLabel('2026-10-14', 2)).toBe('14 de octubre, 2 actividades');
    expect(dayLabel('2026-10-14', 1)).toBe('14 de octubre, 1 actividad');
    expect(dayLabel('2026-10-14', 0)).toBe('14 de octubre, sin actividades');
  });
  it('la leyenda, sin frase y en su orden', () => {
    expect(LEGEND.map((l) => l.label)).toEqual([
      'Próxima',
      'Asististe',
      'No asististe',
      'Sin registrar',
      'Abierto a inscripción',
      'Con plaza',
    ]);
  });
});

describe('calendario: el mes', () => {
  it('desde el lunes, sin semanas de relleno ni días de otros meses', () => {
    const w = monthWeeks('2026-11'); // el 1 de noviembre de 2026 es domingo
    expect(w[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(w.at(-1)!.filter(Boolean).at(-1)).toBe('2026-11-30');
    expect(w.every((row) => row.some(Boolean))).toBe(true);
    expect(w.flat().filter(Boolean)).toHaveLength(30);
    expect(monthWeeks('2026-06')[0][0]).toBe('2026-06-01'); // lunes
  });
  it('título, día y cambio de mes', () => {
    expect(monthTitle('2025-10')).toBe('Octubre 2025');
    expect(dayTitle('2025-10-14')).toBe('Martes, 14 de octubre');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('al cambiar de mes: hoy si cae dentro; si no, el día 1', () => {
    expect(dayOnMonthChange('2026-11', '2026-11-14')).toBe('2026-11-14');
    expect(dayOnMonthChange('2026-12', '2026-11-14')).toBe('2026-12-01');
  });
  it('la agenda: el mes por días, en orden, sin días vacíos', () => {
    const m = dayItems(
      {
        sessions: [
          {
            id: 'b',
            name: 'B',
            eventId: 'e',
            eventName: 'E',
            startsAt: '2026-11-15T16:30:00Z',
            endsAt: null,
            attendance: null,
          },
          {
            id: 'a',
            name: 'A',
            eventId: 'e',
            eventName: 'E',
            startsAt: '2026-11-08T16:30:00Z',
            endsAt: null,
            attendance: null,
          },
          {
            id: 'o',
            name: 'O',
            eventId: 'e',
            eventName: 'E',
            startsAt: '2026-12-08T16:30:00Z',
            endsAt: null,
            attendance: null,
          },
        ],
        registeredEvents: [],
        openEvents: [],
      },
      NOW,
    );
    expect(agendaOfMonth(m, '2026-11').map((d) => d.day)).toEqual([
      '2026-11-08',
      '2026-11-15',
    ]);
    expect(agendaOfMonth(m, '2027-03')).toEqual([]);
  });
  it('para la portada: primero los abiertos y luego las próximas sesiones, `n` como mucho', () => {
    const data = {
      openEvents: [
        { id: 'o2', name: 'Abierto 2', startDate: '2026-12-10', endDate: null },
        { id: 'o1', name: 'Abierto 1', startDate: '2026-11-10', endDate: null },
        {
          id: 'o0',
          name: 'Pasado',
          startDate: '2026-10-10',
          endDate: '2026-10-11',
        },
      ],
      sessions: [
        {
          id: 's2',
          name: 'S2',
          eventId: 'e',
          eventName: 'E',
          startsAt: '2026-11-15T16:30:00Z',
          endsAt: null,
          attendance: null as null,
        },
        {
          id: 's1',
          name: 'S1',
          eventId: 'e',
          eventName: 'E',
          startsAt: '2026-11-08T16:30:00Z',
          endsAt: null,
          attendance: null as null,
        },
        {
          id: 's0',
          name: 'S0',
          eventId: 'e',
          eventName: 'E',
          startsAt: '2026-10-25T16:30:00Z',
          endsAt: null,
          attendance: null as null,
        },
      ],
    };
    expect(upcomingAgendaItems(data, TODAY, 5, NOW).map((i) => i.id)).toEqual([
      'o1',
      'o2',
      's1',
      's2',
    ]);
    expect(upcomingAgendaItems(data, TODAY, 3, NOW).map((i) => i.id)).toEqual([
      'o1',
      'o2',
      's1',
    ]);
  });
});

describe('enlaces del plugin que llegan a Documentos y Calendario', () => {
  const to = (d: Parameters<typeof nativeHrefFor>[0]) => nativeHrefFor(d);
  it('Documentos: la lista, subir y la ficha (editar o detalle)', () => {
    expect(to({ internalpage: 'list_stic_documents' })).toEqual({
      pathname: '/comunica/documentos',
    });
    expect(
      to({ internalpage: 'single_stic_documents', action: 'create' }),
    ).toEqual({ pathname: '/comunica/documentos/subir' });
    for (const action of ['edit', 'detail'] as const)
      expect(
        to({ internalpage: 'single_stic_documents', action, id: 'abcdef0123' }),
      ).toEqual({
        pathname: '/comunica/documentos/[id]',
        params: { id: 'abcdef0123' },
      });
    expect(to({ internalpage: 'single_stic_documents' })).toEqual({
      pathname: '/comunica/documentos',
    });
  });
  it('NUNCA hay un enlace que borre: lo de borrar llega a la ficha o a la lista', () => {
    const del = {
      internalpage: 'single_stic_documents',
      action: 'delete' as 'edit',
      id: 'abcdef0123',
    };
    expect(to(del)).toEqual({
      pathname: '/comunica/documentos/[id]',
      params: { id: 'abcdef0123' },
    });
    expect(JSON.stringify(to(del))).not.toMatch(/delete|borrar|remove/i);
  });
  it('Calendario: el mes, la sesión, y lo desactivado (crear/editar/borrar → mes; sesiones → agenda; asistencias → mes)', () => {
    expect(to({ internalpage: 'single_stic_activities_calendar' })).toEqual({
      pathname: '/comunica/calendario',
    });
    expect(
      to({
        internalpage: 'single_stic_sessions',
        action: 'detail',
        id: 'abcdef0123',
      }),
    ).toEqual({
      pathname: '/comunica/calendario/sesion/[id]',
      params: { id: 'abcdef0123' },
    });
    for (const action of ['create', 'edit'] as const)
      expect(
        to({ internalpage: 'single_stic_sessions', action, id: 'abcdef0123' }),
      ).toEqual({ pathname: '/comunica/calendario' });
    expect(to({ internalpage: 'list_stic_sessions' })).toEqual({
      pathname: '/comunica/calendario',
      params: { vista: 'agenda' },
    });
    expect(to({ internalpage: 'list_stic_attendances' })).toEqual({
      pathname: '/comunica/calendario',
    });
  });
});
