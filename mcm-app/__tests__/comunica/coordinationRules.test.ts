/**
 * Las reglas puras de Coordinación (plan 06 §Tests), sin React.
 */
import type {
  Mark,
  Meeting,
  MonitorDetail,
  MonitorsRoll,
  StageStrip,
  TeamMember,
} from '@/services/comunica/contract';
import {
  unionScope,
  coordinationSubtitle,
  scopeLabel,
  scopeMatches,
} from '@/utils/comunica/scope';
import {
  canMarkSession,
  effectiveMark,
  isMonitorsDirty,
  memberLine,
  monitorNote,
  monitorSections,
  monitorsCanSave,
  monitorsCounts,
  monitorsDraftFrom,
  monitorsMarks,
  nextMonitorMarkOnTap,
  setMonitorMark,
} from '@/utils/comunica/monitorsRoll';
import {
  monitorAlert,
  rowPct,
  trailingAbsences,
} from '@/utils/comunica/monitorAlert';
import {
  coordinationSummaryLine,
  headcountFresh,
  lastSessionStatus,
  lastSessionWhen,
  missingText,
  stageCard,
  stripFootnote,
  stripRowState,
} from '@/utils/comunica/summary';
import {
  durationText,
  meetingDraftError,
  meetingStateText,
  pendingMeeting,
} from '@/utils/comunica/meetings';
import {
  complianceFlag,
  identityLine,
  meetingsTrack,
  missingRequirements,
  rollCallTrack,
  weeklyTrack,
  withNames,
} from '@/utils/comunica/monitorDetail';
import {
  followUpPermissions,
  followUpsView,
  readableTypes,
  seasonOf,
  visibleFollowUps,
  writableTypes,
} from '@/utils/comunica/followUps';
import {
  neighborsOf,
  searchTeam,
  teamOrder,
  teamSections,
  withPendingAssignments,
} from '@/utils/comunica/team';

const member = (id: string, patch: Partial<TeamMember> = {}): TeamMember => ({
  id,
  firstName: id,
  lastName: 'Pérez',
  groupCodes: ['C1'],
  stage: 'com',
  otherStages: [],
  ...patch,
});

describe('alcance', () => {
  it('scopeLabel: delegación, etapa, etapa + segmento y solo segmento', () => {
    expect(scopeLabel('delegation')).toBe('toda la delegación');
    expect(scopeLabel({})).toBe('toda la delegación');
    expect(scopeLabel({ stages: ['com'] })).toBe('COM');
    expect(scopeLabel({ stages: ['com'], segments: ['com_2'] })).toBe(
      'COM · COM 2',
    );
    expect(scopeLabel({ segments: ['com_2'] })).toBe('COM 2');
  });

  it('un grupo sin segmento no entra en un alcance por segmento', () => {
    const scope = { stages: ['com' as const], segments: ['com_2' as const] };
    expect(scopeMatches(scope, { stage: 'com', segment: 'com_2' })).toBe(true);
    expect(scopeMatches(scope, { stage: 'com' })).toBe(false);
    expect(scopeMatches(scope, { stage: 'mic' })).toBe(false);
    expect(scopeMatches('delegation', { stage: null })).toBe(true);
  });

  it('varias relaciones: la suma (✅ alcance-coord)', () => {
    expect(unionScope([])).toBeNull();
    expect(unionScope([{ stage: 'com', segment: 'com_2' }, {}])).toBe(
      'delegation',
    );
    // La etapa entera se come su segmento.
    expect(
      unionScope([{ stage: 'com', segment: 'com_2' }, { stage: 'com' }]),
    ).toEqual({ stages: ['com'] });
    expect(unionScope([{ stage: 'com' }, { stage: 'mic' }])).toEqual({
      stages: ['mic', 'com'],
    });
    const sum = unionScope([
      { stage: 'mic' },
      { stage: 'com', segment: 'com_2' },
    ])!;
    expect(sum).toEqual({ stages: ['mic', 'com'], segments: ['com_2'] });
    expect(scopeLabel(sum)).toBe('MIC, COM · COM 2');
    expect(scopeMatches(sum, { stage: 'mic' })).toBe(true);
    expect(scopeMatches(sum, { stage: 'com', segment: 'com_2' })).toBe(true);
    expect(scopeMatches(sum, { stage: 'com', segment: 'com_1' })).toBe(false);
  });

  it('el subtítulo: alcance si coordina; si solo acompaña, su papel', () => {
    expect(
      coordinationSubtitle({ roles: ['coordination'], scope: 'delegation' }),
    ).toBe('Toda la delegación');
    expect(
      coordinationSubtitle({ roles: ['accompaniment'], scope: 'delegation' }),
    ).toBe('Acompañamiento');
  });
});

const row = (
  id: string,
  mark: MonitorsRoll['rows'][number]['mark'] = null,
  patch: Partial<TeamMember> = {},
  reason: string | null = null,
): MonitorsRoll['rows'][number] => ({
  member: member(id, patch),
  mark,
  reason,
  seasonMarks: [],
});

describe('lista de monitores (modo monitors)', () => {
  it('arranca todo en verde y el toque alterna vino ⇄ no vino', () => {
    const rows = [row('a'), row('b', 'no_justified', {}, 'Examen')];
    const d = monitorsDraftFrom(rows);
    expect(d.marks).toEqual({ a: 'yes', b: 'no_justified' });
    expect(d.notes.b).toBe('Examen');
    expect(nextMonitorMarkOnTap('yes')).toBe('no_unjustified');
    expect(nextMonitorMarkOnTap('no_unjustified')).toBe('yes');
    expect(nextMonitorMarkOnTap('partial')).toBe('no_unjustified');
    expect(nextMonitorMarkOnTap('no_justified')).toBe('no_unjustified');
  });

  it('«Quitar la marca» vuelve a verde y volver a vino se lleva el motivo', () => {
    const d = monitorsDraftFrom([row('a', 'no_justified', {}, 'Examen')]);
    const cleared = setMonitorMark(d, 'a', null);
    expect(cleared.marks.a).toBe('yes');
    expect(cleared.notes.a).toBe('');
    const partial = setMonitorMark(d, 'a', 'partial');
    expect(partial.notes.a).toBe('Examen');
  });

  it('manda una marca por fila, ninguna null, sin motivo con vino y ≤ 255', () => {
    const rows = [row('a'), row('b'), row('c')];
    let d = monitorsDraftFrom(rows);
    d = setMonitorMark(d, 'b', 'no_justified');
    d = { ...d, notes: { ...d.notes, b: ` ${'m'.repeat(300)} `, a: 'basura' } };
    const marks = monitorsMarks(rows, d);
    expect(marks).toHaveLength(3);
    expect(marks.every((m) => m.mark !== null)).toBe(true);
    expect(marks[0]).toEqual({ personId: 'a', mark: 'yes' });
    expect(marks[1].reason).toHaveLength(255);
    expect(effectiveMark({ marks: {}, notes: {} }, 'x')).toBe('yes');
  });

  it('futuras (✅ como el plugin): reuniones sí; semanal, solo la próxima sin ninguna empezada', () => {
    const now = new Date('2026-09-10T10:00:00Z');
    const a = {
      id: 'a',
      date: '2026-09-19',
      startsAt: '2026-09-19T16:30:00+02:00',
    };
    const b = {
      id: 'b',
      date: '2026-09-26',
      startsAt: '2026-09-26T16:30:00+02:00',
    };
    expect(canMarkSession('weekly', a, [a, b], now)).toBe(true);
    expect(canMarkSession('weekly', b, [a, b], now)).toBe(false);
    expect(canMarkSession('meeting', b, [a, b], now)).toBe(true);
    const later = new Date('2026-09-20T10:00:00Z');
    expect(canMarkSession('weekly', a, [a, b], later)).toBe(true);
    expect(canMarkSession('weekly', b, [a, b], later)).toBe(false);
  });

  it('cuentas: parcial cuenta como vino', () => {
    const rows = [row('a', 'partial'), row('b', 'no_unjustified'), row('c')];
    expect(monitorsCounts(rows, monitorsDraftFrom(rows))).toEqual({
      came: 2,
      missed: 1,
    });
  });

  it('se puede guardar todo verde; pasada e igual, no', () => {
    const rows = [row('a')];
    const d = monitorsDraftFrom(rows);
    expect(monitorsCanSave({ rows, rollCall: null }, d)).toBe(true);
    const taken = {
      sessionId: 's',
      status: 'taken' as const,
      takenAt: '2026-10-24T18:00:00+02:00',
      counts: { came: 1, missed: 0 },
    };
    expect(monitorsCanSave({ rows, rollCall: taken }, d)).toBe(false);
    const changed = setMonitorMark(d, 'a', 'no_unjustified');
    expect(isMonitorsDirty(rows, changed)).toBe(true);
    expect(monitorsCanSave({ rows, rollCall: taken }, changed)).toBe(true);
  });

  it('por etapa, con los «prestados» (también una sección solo de prestados)', () => {
    const dual = member('David', {
      lastName: 'Soler',
      stage: 'mic',
      otherStages: ['com'],
      groupCodes: ['M2', 'C3'],
    });
    const rows = [
      {
        ...row('m'),
        member: member('m', { stage: 'mic', groupCodes: ['M1'] }),
      },
      { ...row('d'), member: dual },
      row('c'),
    ];
    const secs = monitorSections(rows);
    expect(secs.map((s) => [s.label, s.count])).toEqual([
      ['MIC', 2],
      ['COM', 1],
    ]);
    expect(secs[1].borrowedNote).toBe(
      'También lleva grupo de esta etapa: David Soler (MIC). Sale una sola vez, en su otra sección.',
    );
    // En la lista de COM (cada etapa con su evento), David llega en `borrowed`.
    const onlyLent = monitorSections([], [dual]);
    expect(onlyLent).toHaveLength(1);
    expect(onlyLent[0]).toMatchObject({ label: 'COM', count: 0 });
    expect(
      monitorSections([row('x', null, { stage: null, groupCodes: [] })])[0]
        .label,
    ).toBe('Sin etapa');
  });

  it('la línea de la fila y su nota', () => {
    expect(
      memberLine(
        member('a', {
          groupCodes: ['C1', 'C2'],
          schoolLevel: { key: 'eso2', label: '2 ESO' },
        }),
      ),
    ).toBe('C1 · C2 · 2 ESO');
    expect(memberLine(member('a', { groupCodes: [] }))).toBe(
      'Sin grupo asignado',
    );
    expect(
      memberLine(
        member('a', {
          groupCodes: [],
          unassigned: { membershipId: 'r', outsideGroupName: 'Coro' },
        }),
        { outside: true },
      ),
    ).toBe('Coro · no entra en Pasar Lista');
    expect(monitorNote('no_justified', 'Examen', null)).toEqual({
      text: 'Justificada · Examen',
      danger: false,
    });
    expect(monitorNote('yes', 'x', '3 seguidas sin venir')).toEqual({
      text: '3 seguidas sin venir',
      danger: true,
    });
    expect(monitorNote('yes', '', null).text).toBeNull();
  });
});

describe('aviso de un monitor', () => {
  const Y: Mark = 'yes';
  const N: Mark = 'no_unjustified';
  const J: Mark = 'no_justified';
  it('con menos de 4 marcadas, nada', () => {
    expect(monitorAlert([N, N, N])).toBeNull();
    expect(monitorAlert([N, null, N, null, N])).toBeNull();
    expect(rowPct([N, N, Y])).toBeNull();
  });
  it('3 faltas seguidas al final, saltando los huecos', () => {
    expect(trailingAbsences([Y, N, null, J, null, N])).toBe(3);
    expect(monitorAlert([Y, N, null, J, null, N])).toBe('3 seguidas sin venir');
  });
  it('por debajo del 60 %', () => {
    expect(monitorAlert([Y, N, J, Y, N])).toBe('40 % de asistencia');
    expect(monitorAlert([Y, Y, Y, N])).toBeNull();
  });
  it('el % de la fila solo con 4 o más, rojo si es bajo', () => {
    expect(rowPct([Y, Y, Y, N])).toMatchObject({ pct: 75, low: false });
    expect(rowPct([Y, N, N, N, null])).toMatchObject({ pct: 25, low: true });
  });
});

const sess = (id: string, date: string) => ({
  id,
  eventId: 'e',
  date,
  startsAt: `${date}T16:30:00+02:00`,
  endsAt: `${date}T18:00:00+02:00`,
  kind: 'weekly' as const,
});
const NOW = new Date('2026-10-24T15:00:00Z');

describe('resumen', () => {
  const strip = (
    stage: StageStrip['stage'],
    sessions: ReturnType<typeof sess>[],
    rows: [string, StageStrip['rows'][number]['cells'], number | null][],
  ): StageStrip => ({
    stage,
    sessions,
    rows: rows.map(([code, cells, age]) => ({
      group: { id: code, code, name: code },
      monitors: [],
      headcount:
        age === null
          ? null
          : {
              participants: 10,
              monitors: 2,
              countedAt: new Date(
                NOW.getTime() - age * 86_400_000,
              ).toISOString(),
            },
      cells,
    })),
  });

  it('pastilla y huecos', () => {
    expect(stripRowState({ cells: ['taken', 'taken'] })).toMatchObject({
      badge: { label: 'Al día' },
      note: 'todas pasadas',
    });
    expect(stripRowState({ cells: [null, 'taken'] })).toMatchObject({
      badge: { label: 'Pasada' },
      note: '1 sin pasar',
    });
    expect(stripRowState({ cells: ['taken', null] }).badge.label).toBe('Falta');
    expect(stripRowState({ cells: [null, 'skipped'] }).badge.label).toBe(
      'Sin registro',
    );
  });

  it('última sesión: «sin registro» cuenta, y fechas por etapa', () => {
    const a = strip(
      'mic',
      [sess('s1', '2026-10-17')],
      [
        ['M1', ['taken'], 0],
        ['M2', ['skipped'], 0],
      ],
    );
    const b = strip('com', [sess('s2', '2026-10-24')], [['C2', [null], 0]]);
    const st = lastSessionStatus([a, b]);
    expect(st).toMatchObject({ done: 2, total: 3 });
    expect(st.missing.map((m) => m.code)).toEqual(['C2']);
    expect(lastSessionWhen(st)).toBe('Última sesión de cada etapa');
    expect(missingText(st)).toBe('1 grupo sin pasarla todavía');
    expect(lastSessionWhen(lastSessionStatus([a]))).toBe(
      'Última sesión · sáb 17 oct',
    );
  });

  it('suma entera o nada (3 días vale, 4 no, el futuro tampoco)', () => {
    expect(
      headcountFresh(
        new Date(NOW.getTime() - 3 * 86_400_000).toISOString(),
        NOW,
      ),
    ).toBe(true);
    expect(
      headcountFresh(
        new Date(NOW.getTime() - 4 * 86_400_000).toISOString(),
        NOW,
      ),
    ).toBe(false);
    expect(
      headcountFresh(
        new Date(NOW.getTime() + 2 * 86_400_000).toISOString(),
        NOW,
      ),
    ).toBe(false);
    const s = [sess('s1', '2026-10-17')];
    expect(
      stageCard(
        strip('com', s, [
          ['C1', ['taken'], 0],
          ['C2', ['taken'], 3],
        ]),
        NOW,
      ),
    ).toMatchObject({
      value: 20,
      unit: 'chavalines',
      meta: ['2 grupos', '4 monitores'],
    });
    expect(
      stageCard(
        strip('com', s, [
          ['C1', ['taken'], 0],
          ['C2', ['taken'], 4],
        ]),
        NOW,
      ),
    ).toMatchObject({
      value: 2,
      unit: 'grupos',
      meta: ['1 sin recuento'],
    });
    expect(
      stageCard(strip('com', s, [['C1', ['taken'], null]]), NOW),
    ).toMatchObject({
      value: 1,
      unit: 'grupo',
      meta: ['sin recuento'],
    });
  });

  it('la línea de Coordinación con 5 grupos que faltan', () => {
    const s = strip(
      'com',
      [sess('s1', '2026-11-14')],
      [
        ['C1', [null], 0],
        ['C2', [null], 0],
        ['C3', [null], 0],
        ['C4', [null], 0],
        ['C5', [null], 0],
        ['C6', ['taken'], 0],
      ],
    );
    expect(coordinationSummaryLine(lastSessionStatus([s]))).toBe(
      'sáb 14 nov · 1 de 6 listas · faltan C1, C2, C3, C4 y 1 más',
    );
    expect(coordinationSummaryLine(lastSessionStatus([]))).toBe(
      'Qué listas faltan y datos por revisar',
    );
  });

  it('el pie de la tira dice lo que se ve', () => {
    const s = strip('com', [sess('s1', '2026-10-17')], []);
    expect(stripFootnote([s], 12)).toBe(
      'La tira enseña las sesiones del curso hasta hoy.',
    );
    const full = strip(
      'com',
      Array.from({ length: 12 }, (_, i) => sess(`s${i}`, '2026-10-17')),
      [],
    );
    expect(stripFootnote([full], 12)).toBe(
      'La tira enseña las últimas 12 sesiones.',
    );
  });
});

describe('reuniones', () => {
  const meeting = (
    date: string,
    roll: Meeting['rollCall'] = null,
  ): Meeting => ({
    session: { ...sess(date, date), kind: 'meeting' },
    name: 'Programación',
    durationHours: 1.5,
    rollCall: roll,
  });
  const taken = (s: string) => ({
    sessionId: s,
    status: 'taken' as const,
    takenAt: '2026-10-01T10:00:00Z',
    counts: { came: 11, missed: 3 },
  });

  it('los cuatro estados', () => {
    expect(meetingStateText(meeting('2026-09-29', taken('a')), NOW)).toBe(
      '11 vinieron · 3 faltas',
    );
    expect(
      meetingStateText(
        meeting('2026-09-29', { ...taken('a'), status: 'skipped' }),
        NOW,
      ),
    ).toBe('sin registro');
    expect(meetingStateText(meeting('2026-10-20'), NOW)).toBe('sin pasar');
    expect(meetingStateText(meeting('2026-11-17'), NOW)).toBe(
      'todavía no ha llegado',
    );
    expect(durationText(1.5)).toBe('1,5\u00a0h');
  });

  it('reunión sin pasar: la última, sin lista y de hace 30 días o menos', () => {
    expect(pendingMeeting([meeting('2026-10-20')], NOW)?.session.date).toBe(
      '2026-10-20',
    );
    // 31 días: ya no.
    expect(pendingMeeting([meeting('2026-09-23')], NOW)).toBeNull();
    // Una posterior con lista: tampoco.
    expect(
      pendingMeeting(
        [meeting('2026-10-10'), meeting('2026-10-20', taken('b'))],
        NOW,
      ),
    ).toBeNull();
    // Las futuras no cuentan.
    expect(
      pendingMeeting([meeting('2026-10-20'), meeting('2026-11-17')], NOW)
        ?.session.date,
    ).toBe('2026-10-20');
  });

  it('el alta de una reunión', () => {
    const ok = {
      name: 'Programación',
      date: '2026-11-03',
      startTime: '19:00',
      durationHours: 1.5,
    };
    expect(meetingDraftError(ok)).toBeNull();
    expect(meetingDraftError({ ...ok, name: ' ' })).toBe('Ponle un nombre.');
    expect(meetingDraftError({ ...ok, durationHours: 5 })).toBe(
      'Elige cuánto dura.',
    );
  });
});

describe('ficha del monitor', () => {
  const sq = (date: string, mark: Mark, extra: object = {}) => ({
    sessionId: date,
    date,
    mark,
    ...extra,
  });

  it('identidad', () => {
    const m = {
      ...member('a', {
        groupCodes: ['C1', 'C2'],
        schoolLevel: { key: 'eso4' as const, label: '4 ESO' },
      }),
      age: 23,
      monitorSinceYear: 2019,
      doNotCall: false,
    } as MonitorDetail['monitor'];
    expect(identityLine(m)).toBe(
      'C1 · C2 · 4 ESO · 23 años · monitor/a desde 2019',
    );
  });

  it('sábados: pie, «sin datos» y sin inscribir', () => {
    expect(
      weeklyTrack({
        registered: true,
        squares: [sq('2026-10-03', 'yes'), sq('2026-10-10', null)],
      }),
    ).toMatchObject({
      score: '100 %',
      foot: 'Vino a 1 de 1 · 1 sábado sin marcar, fuera de la cuenta',
    });
    expect(
      weeklyTrack({ registered: true, squares: [sq('2026-10-03', null)] }),
    ).toMatchObject({ score: 'sin datos', scoreMuted: true });
    expect(weeklyTrack({ registered: false, squares: [] })).toMatchObject({
      kind: 'message',
    });
    expect(weeklyTrack(null)).toBeNull();
  });

  it('reuniones: fracción y cada falta con su porqué o «sin motivo»', () => {
    const t = meetingsTrack({
      registered: true,
      squares: [
        sq('2026-09-29', 'no_justified', {
          name: 'Programación',
          reason: 'TFG',
        }),
        sq('2026-10-20', 'no_unjustified', { name: 'Revisión' }),
        sq('2026-10-27', 'yes'),
      ],
    });
    expect(t).toMatchObject({
      score: '1 de 3',
      absences: [
        { what: '20 oct · Revisión', why: 'No vino: sin motivo' },
        { what: '29 sep · Programación', why: 'Justificada: TFG' },
      ],
    });
    expect(meetingsTrack({ registered: true, squares: [] })).toMatchObject({
      text: 'Todavía no ha habido ninguna reunión de programación.',
    });
    expect(
      meetingsTrack({ registered: false, squares: [sq('2026-09-29', null)] }),
    ).toMatchObject({
      text: 'Todavía no aparece en ninguna lista de reunión.',
    });
  });

  it('listas del grupo: los pies del plugin', () => {
    const st = (s: string[]) =>
      rollCallTrack(s.map((state) => ({ state }) as never));
    expect(st(['mine', 'mine'])).toEqual({
      score: '2 de 2',
      foot: 'Las ha pasado siempre',
    });
    expect(st(['mine', 'missing', 'missing'])).toEqual({
      score: '1 de 3',
      foot: 'Faltan 2 · la que hay es suya',
    });
    expect(st(['mine', 'other', 'skipped'])).toEqual({
      score: '2 de 2',
      foot: '1 suyas, 1 de otra persona · 1 sábado sin sesión',
    });
    expect(st(['other']).foot).toBe('La pasó otra persona');
  });

  it('«Ana, Luis y 3 más» y la pastilla de requisitos sin LOPD', () => {
    expect(withNames(['Ana'])).toBe('Ana');
    expect(withNames(['Ana', 'Luis', 'Marta'])).toBe('Ana, Luis y Marta');
    expect(withNames(['Ana', 'Luis', 'Marta', 'Pau', 'Sara', 'Iker'])).toBe(
      'Ana, Luis, Marta y 3 más',
    );
    const c = (label: string, ok: boolean, required = true) => ({
      label,
      ok,
      required,
    });
    expect(
      missingRequirements([
        c('Certificado de delitos sexuales', false),
        c('Código de conducta', false),
        c('Compromiso firmado', false),
        c('Protección de datos (LOPD)', false, false),
      ]),
    ).toBe(
      'Falta: Certificado de delitos sexuales · Código de conducta y 1 más',
    );
    expect(
      missingRequirements([c('Protección de datos (LOPD)', false, false)]),
    ).toBeNull();
    expect(complianceFlag([c('A', false), c('B', false)])).toEqual({
      text: 'faltan 2',
      ok: false,
    });
  });
});

describe('seguimientos', () => {
  it('tabla de quién lee y escribe', () => {
    expect(readableTypes(['coordination'])).toEqual(['incident', 'assessment']);
    expect(writableTypes(['coordination'])).toEqual(['incident', 'assessment']);
    expect(readableTypes(['accompaniment'])).toEqual([
      'incident',
      'assessment',
      'accompaniment',
    ]);
    expect(writableTypes(['accompaniment'])).toEqual(['accompaniment']);
    expect(writableTypes(['coordination', 'accompaniment'])).toHaveLength(3);
    expect(readableTypes(['monitor'])).toEqual([]);
  });

  it('sobre uno mismo, nada; un tipo desconocido, fuera', () => {
    expect(
      followUpPermissions(['coordination', 'accompaniment'], 'p', 'p'),
    ).toEqual({ readable: [], writable: [] });
    expect(
      visibleFollowUps(
        [{ type: 'incident' }, { type: 'otro' }, { type: 'accompaniment' }],
        ['incident', 'assessment'],
      ),
    ).toEqual([{ type: 'incident' }]);
  });

  it('cursos: por defecto este; el anterior con un toque; sin fecha, siempre', () => {
    expect(seasonOf('2026-09-01')).toBe('2026-2027');
    expect(seasonOf('2026-08-31')).toBe('2025-2026');
    const items = [
      { id: 'a', date: '2026-10-17' },
      { id: 'b', date: '2026-03-14' },
      { id: 'c', date: null },
      { id: 'd', date: '2024-01-10' },
    ];
    const now = followUpsView(items, '2026-10-24', false);
    expect(now.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(now.toggle).toBe('Ver también los de 2025-2026');
    const both = followUpsView(items, '2026-10-24', true);
    expect(both.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(both.toggle).toBe('Ver solo los de 2026-2027');
    expect(followUpsView([], '2026-10-24', false)).toMatchObject({
      toggle: null,
      empty: 'Nada apuntado este curso.',
    });
  });
});

describe('tu equipo', () => {
  const team = [
    member('a', { firstName: 'Álvaro', groupCodes: ['M1'], stage: 'mic' }),
    member('b', { firstName: 'Lucía', groupCodes: ['C2'] }),
    member('c', {
      firstName: 'Sara',
      groupCodes: [],
      stage: null,
      unassigned: { membershipId: 'r1' },
    }),
  ];

  it('sin grupo primero y después por etapa', () => {
    const v = teamSections(team);
    expect(v.unassigned.map((m) => m.id)).toEqual(['c']);
    expect(v.sections.map((s) => s.label)).toEqual(['MIC', 'COM']);
    expect(teamOrder(team).map((m) => m.id)).toEqual(['c', 'a', 'b']);
  });

  it('el buscador: sin acentos ni mayúsculas, por nombre o código', () => {
    expect(searchTeam(team, 'alvaro').map((m) => m.id)).toEqual(['a']);
    expect(searchTeam(team, 'c2').map((m) => m.id)).toEqual(['b']);
    expect(searchTeam(team, '  ')).toHaveLength(3);
  });

  it('vecinos sin dar la vuelta', () => {
    const order = teamOrder(team);
    expect(neighborsOf(order, 'c')).toMatchObject({ prev: null });
    expect(neighborsOf(order, 'b').next).toBeNull();
    expect(neighborsOf(order, 'a').prev?.id).toBe('c');
  });

  it('un «Vincular» en cola mueve al monitor a su etapa', () => {
    const { team: next, pendingIds } = withPendingAssignments(
      team,
      new Map([['r1', 'g3']]),
      [{ id: 'g3', code: 'C3', name: 'Senderos', stage: 'com' }],
    );
    expect(pendingIds.has('c')).toBe(true);
    expect(next.find((m) => m.id === 'c')).toMatchObject({
      groupCodes: ['C3'],
      stage: 'com',
      unassigned: undefined,
    });
  });
});
