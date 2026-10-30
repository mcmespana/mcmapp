import type { RollDetail, SessionSummary } from '@/services/comunica/contract';
import { madridInstant } from '@/utils/comunica/madrid';
import {
  applyDraft,
  checkSaved,
  draftAfterApplied,
  draftFrom,
  fillRestLabel,
  hasSomethingToSave,
  isEmptyWrite,
  pendingDisplay,
  toRollWrite,
} from '@/utils/comunica/rollDraft';
import {
  canMarkSession,
  isFutureSession,
  lastHeld,
  sessionOptions,
  shortDate,
} from '@/utils/comunica/sessions';
import {
  groupsInSection,
  sectionLabel,
  sectionParam,
} from '@/utils/comunica/pasarLista';

const ses = (id: string, date: string): SessionSummary => ({
  id,
  eventId: 'e',
  date,
  startsAt: madridInstant(date, '16:30'),
  endsAt: madridInstant(date, '18:00'),
  kind: 'weekly',
});

const person = (id: string) => ({
  id,
  firstName: id,
  lastName: 'X',
  badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
});

const roll = (
  marks: (null | 'yes' | 'no_unjustified')[],
  taken = false,
): RollDetail => ({
  generatedAt: '2026-10-24T10:00:00Z',
  session: ses('s', '2026-10-24'),
  groupId: 'g',
  roll: taken
    ? {
        sessionId: 's',
        groupId: 'g',
        status: 'taken',
        takenAt: '2026-10-24T18:00:00Z',
        counts: { came: 0, missed: 0 },
      }
    : null,
  monitors: [],
  entries: marks.map((m, i) => ({
    person: person(`p${i}`),
    mark: m,
    note: '',
    previousMarks: [],
  })),
});

describe('sesión del futuro (Madrid)', () => {
  it('23:30 UTC del viernes ya es sábado en Madrid', () => {
    const fri = new Date('2026-10-23T23:30:00Z');
    expect(isFutureSession({ date: '2026-10-24' }, fri)).toBe(false);
    expect(isFutureSession({ date: '2026-10-25' }, fri)).toBe(true);
  });
});

describe('futuras = «como el plugin»', () => {
  const sessions = [
    ses('a', '2026-10-10'),
    ses('b', '2026-10-17'),
    ses('c', '2026-10-24'),
  ];
  it('sin ninguna llegada, la próxima se marca y sale en el selector; la siguiente, no', () => {
    const before = new Date(madridInstant('2026-10-01', '10:00'));
    expect(canMarkSession(sessions[0], sessions, before)).toBe(true);
    expect(canMarkSession(sessions[1], sessions, before)).toBe(false);
    expect(
      sessionOptions(sessions, new Map(), before).map((o) => o.session.id),
    ).toEqual(['a']);
  });
  it('con alguna llegada, ninguna futura (hoy sí, aunque no haya empezado)', () => {
    const sat = new Date(madridInstant('2026-10-17', '10:00'));
    expect(canMarkSession(sessions[1], sessions, sat)).toBe(true);
    expect(canMarkSession(sessions[2], sessions, sat)).toBe(false);
    expect(
      sessionOptions(sessions, new Map(), sat).map((o) => o.session.id),
    ).toEqual(['b', 'a']);
  });
});

describe('selector de fecha', () => {
  it('celebradas y la de hoy, la última arriba, con su número y estado', () => {
    const sessions = [
      ses('a', '2026-10-10'),
      ses('b', '2026-10-17'),
      ses('c', '2026-10-24'),
      ses('d', '2026-11-07'),
    ];
    const rolls = new Map([
      [
        'a',
        {
          sessionId: 'a',
          status: 'taken' as const,
          takenAt: '2026-10-10T18:00:00Z',
          counts: { came: 1, missed: 0 },
        },
      ],
    ]);
    const opts = sessionOptions(
      sessions,
      rolls,
      new Date(madridInstant('2026-10-24', '10:00')),
    );
    expect(opts.map((o) => `${o.label}:${o.state}`)).toEqual([
      '3 · 24 oct:missing',
      '2 · 17 oct:missing',
      '1 · 10 oct:taken',
    ]);
    expect(shortDate('2026-11-07')).toBe('7 nov');
    expect(
      lastHeld(sessions, new Date(madridInstant('2026-10-24', '10:00')))?.id,
    ).toBe('b');
  });
});

describe('guardar', () => {
  it('sin marcas no hay nada que guardar; con lista pasada e igual, tampoco', () => {
    const r = roll([null, null]);
    expect(hasSomethingToSave(r, draftFrom(r))).toBe(false);
    const d = draftFrom(r);
    d.marks.p0 = 'yes';
    expect(hasSomethingToSave(r, d)).toBe(true);
    const taken = roll(['yes', null], true);
    expect(hasSomethingToSave(taken, draftFrom(taken))).toBe(false);
  });
  it('«Han venido todos» y «El resto ha venido (N)»', () => {
    expect(fillRestLabel(draftFrom(roll([null, null, null])))).toBe(
      'Han venido todos',
    );
    expect(fillRestLabel(draftFrom(roll(['no_unjustified', null, null])))).toBe(
      'El resto ha venido (2)',
    );
    expect(fillRestLabel(draftFrom(roll(['yes', 'yes'])))).toBeNull();
  });
  it('lo releído distinto o en notSaved no ha quedado guardado y sigue en el borrador', () => {
    const reread = roll(['yes', null]);
    const missing = checkSaved({ marks: { p0: 'yes', p1: 'yes' } }, reread, []);
    expect(missing).toEqual(['p1']);
    expect(
      checkSaved({ marks: { p0: 'yes' } }, reread, [{ personId: 'p9' }]),
    ).toEqual(['p9']);
    const sent = {
      marks: { p0: 'yes' as const, p1: 'yes' as const },
      notes: {},
    };
    // p1 no entró: sigue en el borrador como estaba; p0, lo releído.
    expect(
      draftAfterApplied(draftFrom(reread), sent, sent, missing).marks,
    ).toEqual({ p0: 'yes', p1: 'yes' });
  });
  it('lo tocado después de encolar sobrevive a que se aplique la subida', () => {
    const fresh = roll(['yes', 'yes', null]);
    // Se mandó p0 y p1 «Vino»; mientras subía, p1 pasó a «No vino» y p2 a «Vino».
    const sent = {
      marks: { p0: 'yes' as const, p1: 'yes' as const },
      notes: { p0: '', p1: '' },
    };
    const current = {
      marks: {
        p0: 'yes' as const,
        p1: 'no_unjustified' as const,
        p2: 'yes' as const,
      },
      notes: { p0: '', p1: '', p2: '' },
    };
    const next = draftAfterApplied(draftFrom(fresh), sent, current, []);
    expect(next.marks).toEqual({ p0: 'yes', p1: 'no_unjustified', p2: 'yes' });
    // Sin tocar nada después: lo releído, tal cual (gana el servidor).
    const reread = roll(['no_unjustified', 'yes', null]);
    expect(draftAfterApplied(draftFrom(reread), sent, sent, []).marks).toEqual({
      p0: 'no_unjustified',
      p1: 'yes',
      p2: null,
    });
    // Un motivo escrito después también se queda.
    const withNote = { ...sent, notes: { p0: 'Tarde', p1: '' } };
    expect(
      draftAfterApplied(draftFrom(fresh), sent, withNote, []).notes.p0,
    ).toBe('Tarde');
  });
  it('desmarcar: quitar una marca guardada va como null y deja guardar a cero', () => {
    const taken = roll(['yes', 'no_unjustified'], true);
    const d = draftFrom(taken);
    d.marks.p0 = null;
    d.marks.p1 = null;
    expect(isEmptyWrite(taken, d)).toBe(false);
    expect(hasSomethingToSave(taken, d)).toBe(true);
    const body = toRollWrite(d, 'c', taken);
    expect(body.marks).toEqual({ p0: null, p1: null });
    // Lo optimista no resucita la marca quitada.
    const opt = applyDraft(taken, d, 'save', '2026-10-24T18:00:00Z');
    expect(opt.entries.map((e) => e.mark)).toEqual([null, null]);
    expect(opt.roll?.counts).toEqual({ came: 0, missed: 0 });
    // Releído sin esa marca = guardado.
    expect(checkSaved(body, opt, [])).toEqual([]);
    // Quien no tenía marca no va en el PUT; sin marcas ni nada que quitar, vacío.
    const fresh = roll([null, null]);
    const e = draftFrom(fresh);
    expect(toRollWrite(e, 'c', fresh).marks).toEqual({});
    expect(isEmptyWrite(fresh, e)).toBe(true);
  });
  it('«Te faltan»: 4 → 4 filas; 5 → 3 + «Y 2 más»', () => {
    expect(pendingDisplay([1, 2, 3, 4])).toEqual({
      shown: [1, 2, 3, 4],
      more: 0,
    });
    expect(pendingDisplay([1, 2, 3, 4, 5])).toEqual({
      shown: [1, 2, 3],
      more: 2,
    });
  });
});

describe('secciones del árbol', () => {
  const gs = [
    { id: 'm', stage: 'mic' as const, segment: undefined },
    { id: 'c1', stage: 'com' as const, segment: 'com_1' as const },
    { id: 'c', stage: 'com' as const, segment: undefined },
    { id: 'x', stage: null, segment: undefined },
  ];
  it('parámetro, filtro y nombre', () => {
    expect(sectionParam({ stage: 'com', segment: 'com_1' })).toBe('COM:com_1');
    expect(sectionParam({ stage: 'mic' })).toBe('MIC');
    expect(sectionParam({ stage: null })).toBe('?');
    expect(groupsInSection(gs, 'COM:com_1').map((g) => g.id)).toEqual(['c1']);
    expect(groupsInSection(gs, 'COM:none').map((g) => g.id)).toEqual(['c']);
    expect(groupsInSection(gs, '?').map((g) => g.id)).toEqual(['x']);
    expect(groupsInSection(gs).length).toBe(4);
    expect(sectionLabel('COM:com_2')).toBe('COM II');
  });
});
