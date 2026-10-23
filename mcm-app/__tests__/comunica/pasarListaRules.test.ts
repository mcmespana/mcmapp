import type {
  GroupWithMonitors,
  SessionSummary,
} from '@/services/comunica/contract';
import { madridInstant } from '@/utils/comunica/madrid';
import {
  compareGroups,
  missingRolls,
  proposeSession,
  stageBuckets,
} from '@/utils/comunica/pasarLista';
import {
  absenceStreak,
  countMarks,
  groupLabel,
  groupTitle,
  nextMarkOnTap,
  participantsLabel,
} from '@/utils/comunica/marks';
import {
  draftFrom,
  isDirty,
  markAllUnmarked,
  toRollWrite,
} from '@/utils/comunica/rollDraft';
import {
  parseComunicaNativaFlag,
  resolveComunicaMode,
} from '@/utils/comunica/router';
import {
  ago,
  capsule,
  longDay,
  relativeDay,
  shortDay,
} from '@/utils/comunica/dates';
import { uuidV4 } from '@/utils/comunica/uuid';
import { ClientId } from '@/services/comunica/contract';
import { createFakeServer } from '@/services/comunica/fake';

const ses = (id: string, date: string, time = '16:30'): SessionSummary => ({
  id,
  eventId: 'e',
  date,
  startsAt: madridInstant(date, time),
  endsAt: madridInstant(date, '18:00'),
  kind: 'weekly',
});
const SESSIONS = [
  ses('s1', '2026-10-10'),
  ses('s2', '2026-10-17'),
  ses('s3', '2026-10-24'),
  ses('s4', '2026-11-07'),
];
const at = (day: string, time: string) => new Date(madridInstant(day, time));

describe('proposeSession', () => {
  it('hoy, aún sin empezar: la de hoy con aviso', () => {
    expect(proposeSession(SESSIONS, at('2026-10-24', '15:00'))).toMatchObject({
      session: { id: 's3' },
      notice: { kind: 'not_started' },
    });
  });
  it('hoy, empezada: la de hoy sin aviso', () => {
    expect(proposeSession(SESSIONS, at('2026-10-24', '17:00'))).toMatchObject({
      session: { id: 's3' },
      notice: null,
    });
  });
  it('hoy no hay: la última empezada, con los días', () => {
    expect(proposeSession(SESSIONS, at('2026-10-27', '10:00'))).toMatchObject({
      session: { id: 's3' },
      notice: { kind: 'days_ago', days: 3 },
    });
  });
  it('no ha empezado ninguna: la próxima', () => {
    expect(proposeSession(SESSIONS, at('2026-09-01', '10:00'))).toMatchObject({
      session: { id: 's1' },
      notice: { kind: 'next', date: '2026-10-10' },
    });
  });
  it('sin sesiones: nada', () => {
    expect(proposeSession([], new Date())).toBeNull();
  });
});

const group = (
  id: string,
  extra: Partial<GroupWithMonitors> = {},
): GroupWithMonitors => ({
  id,
  code: id.toUpperCase(),
  name: 'Grupo',
  stage: 'com',
  segment: 'com_1',
  schoolLevels: [],
  counts: { participants: 10, monitors: 1 },
  monitorNames: [],
  ...extra,
});

describe('missingRolls', () => {
  const stageEvents = [
    { stage: 'com' as const, eventId: 'e', sessions: SESSIONS },
  ];
  it('las celebradas sin lista, la más reciente arriba, y sin el atajo ni lo encolado', () => {
    const out = missingRolls({
      groups: [
        group('c1'),
        group('vacío', { counts: { participants: 0, monitors: 1 } }),
      ],
      stageEvents,
      rollCalls: [
        {
          sessionId: 's1',
          groupId: 'c1',
          status: 'taken',
          takenAt: madridInstant('2026-10-10', '18:00'),
          counts: { came: 1, missed: 0 },
        },
      ],
      now: at('2026-10-24', '17:00'),
      exclude: 's3:c1',
    });
    expect(out.map((m) => m.session.id)).toEqual(['s2']);
    const queued = missingRolls({
      groups: [group('c1')],
      stageEvents,
      rollCalls: [],
      now: at('2026-10-24', '17:00'),
      queued: new Set(['s2:c1']),
    });
    expect(queued.map((m) => m.session.id)).toEqual(['s3', 's1']);
  });
});

describe('grupos', () => {
  it('orden natural de códigos y sin código al final', () => {
    const list = [
      { code: 'M4.10', name: 'b' },
      { code: null, name: 'Apoyo' },
      { code: 'M4.2', name: 'a' },
    ];
    expect([...list].sort(compareGroups).map((g) => g.code ?? g.name)).toEqual([
      'M4.2',
      'M4.10',
      'Apoyo',
    ]);
  });
  it('nunca «C1 · C1»', () => {
    expect(groupTitle({ code: 'C1', name: 'c1' })).toEqual({
      code: 'C1',
      name: null,
    });
    expect(groupLabel({ code: 'C1', name: 'Los Peques' })).toBe(
      'C1 · Los Peques',
    );
    expect(groupLabel({ code: null, name: 'Los Peques' })).toBe('Los Peques');
  });
  it('etapas solo con grupos, COM por segmentos', () => {
    const b = stageBuckets([
      group('a'),
      group('b', { segment: undefined }),
      group('m', { stage: 'mic', segment: undefined }),
    ]);
    expect(b.map((x) => x.label)).toEqual(['MIC', 'COM I', 'COM']);
    expect(participantsLabel(1)).toBe('1 chavalín');
    expect(participantsLabel(12)).toBe('12 chavalines');
  });
});

describe('marcas', () => {
  it('tocar: sin marcar → vino → no vino → vino; nunca desmarca', () => {
    expect(nextMarkOnTap(null)).toBe('yes');
    expect(nextMarkOnTap('yes')).toBe('no_unjustified');
    expect(nextMarkOnTap('no_unjustified')).toBe('yes');
    expect(nextMarkOnTap('partial')).toBe('yes');
  });
  it('recuentos y rachas', () => {
    expect(countMarks(['yes', 'partial', 'no_justified', null])).toEqual({
      came: 2,
      missed: 1,
      unmarked: 1,
    });
    expect(
      absenceStreak([
        'no_unjustified',
        'no_justified',
        'yes',
        'no_unjustified',
      ]),
    ).toBe(2);
    expect(absenceStreak([null, 'no_unjustified'])).toBe(0);
  });
});

describe('borrador de lista', () => {
  it('parte de lo guardado, sabe si ha cambiado y manda lo marcado', async () => {
    const s = createFakeServer({ latencyMs: 0, clock: '2026-10-24T15:00:00Z' });
    const c1 = s.data.groups.find((g) => g.code === 'C1')!;
    const sid = s.data.sessions.find(
      (x) => x.date === '2026-10-17' && x.stage === 'com',
    )!.id;
    const roll = await s.getRoll(sid, c1.id);
    const draft = draftFrom(roll);
    expect(isDirty(roll, draft)).toBe(false);
    const all = markAllUnmarked(draft);
    expect(isDirty(roll, all)).toBe(true);
    const body = toRollWrite(
      { ...all, notes: { ...all.notes, [c1.participantIds[0]]: '  x  ' } },
      uuidV4(),
    );
    expect(Object.keys(body.marks)).toHaveLength(roll.entries.length);
    expect(body.notes[c1.participantIds[0]]).toBe('x');
    const res = await s.saveRoll(sid, c1.id, body);
    expect(res.rollCall.counts.came).toBe(roll.entries.length);
  });
  it('uuid v4 válido', () => {
    expect(ClientId.safeParse(uuidV4()).success).toBe(true);
    let n = 0;
    expect(
      ClientId.safeParse(uuidV4(() => ((n = (n + 0.37) % 1), n))).success,
    ).toBe(true);
  });
});

describe('enrutador nativa / legado', () => {
  it('la tabla del plan 10', () => {
    const r = (
      flag: 'off' | 'alpha' | 'all',
      alphaEnabled: boolean,
      apiAvailable = true,
    ) => resolveComunicaMode({ flag, alphaEnabled, apiAvailable });
    expect([r('off', false), r('off', true)]).toEqual(['legacy', 'legacy']);
    expect([r('alpha', false), r('alpha', true)]).toEqual(['legacy', 'native']);
    expect([r('all', false), r('all', true)]).toEqual(['native', 'native']);
    expect(r('all', true, false)).toBe('legacy');
    expect(parseComunicaNativaFlag(undefined)).toBe('alpha');
    expect(parseComunicaNativaFlag('raro')).toBe('alpha');
    expect(parseComunicaNativaFlag('all')).toBe('all');
  });
});

describe('fechas en lenguaje humano', () => {
  it('días', () => {
    expect(longDay('2026-10-24')).toBe('sábado 24 de octubre');
    expect(longDay('2026-10-24', true)).toBe('Sábado 24 de octubre');
    expect(shortDay('2026-11-15')).toBe('dom 15');
    expect(capsule('2026-12-05')).toEqual({ day: '5', month: 'DIC' });
    expect(relativeDay('2026-10-18', '2026-10-24')).toBe('Hace 6 días');
    expect(relativeDay('2026-10-23', '2026-10-24')).toBe('Ayer');
  });
  it('hace cuánto', () => {
    const now = new Date('2026-10-24T10:00:00Z');
    expect(ago('2026-10-24T09:59:40Z', now)).toBe('hace un momento');
    expect(ago('2026-10-24T09:55:00Z', now)).toBe('hace 5 min');
    expect(ago('2026-10-24T07:00:00Z', now)).toBe('hace 3 h');
    expect(ago('2026-10-23T09:00:00Z', now)).toBe('hace 1 día');
  });
});
