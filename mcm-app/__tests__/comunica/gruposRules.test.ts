/**
 * Reglas puras de Grupos y fichas (plan 05, «Tests» unitarios).
 */
import type {
  ParticipantRow,
  SessionSummary,
} from '@/services/comunica/contract';
import {
  courseChips,
  courseSections,
  filterPeople,
  groupMetaLine,
  groupSections,
  groupsForLevel,
  neighbors,
  personLine,
  toggleChip,
  withPendingGroups,
} from '@/utils/comunica/people';
import {
  courseRank,
  levelWeight,
  SCHOOL_LEVEL_ORDER,
  schoolLevelFromText,
} from '@/utils/comunica/schoolLevels';
import { canWhatsappMinor, cleanPhone } from '@/utils/comunica/phone';
import { consentsSummary, consentState } from '@/utils/comunica/consents';
import {
  attendanceTrack,
  byMonth,
  eventSquares,
  formatHours,
  streakOf,
  timeline,
} from '@/utils/comunica/attendance';
import {
  noticeTier,
  noticeWarning,
  numberNotices,
} from '@/utils/comunica/notices';

const NO_BADGES = { healthNote: false, noPhotos: false, notHomeAlone: false };
const row = (
  id: string,
  firstName: string,
  lastName: string,
  extra: Partial<ParticipantRow> = {},
): ParticipantRow => ({
  id,
  firstName,
  lastName,
  badges: NO_BADGES,
  groupId: 'g1',
  ...extra,
});
const lvl = (t: string) => schoolLevelFromText(t) ?? undefined;

describe('people: grupos', () => {
  const g = (id: string, code: string, stage: 'mic' | 'com' | null) => ({
    id,
    code,
    name: code,
    stage,
  });
  it('tus grupos primero y luego etapas en orden', () => {
    const s = groupSections(
      [
        g('a', 'C2', 'com'),
        g('b', 'M1', 'mic'),
        g('c', 'X', null),
        g('d', 'C1', 'com'),
      ],
      ['a'],
    );
    expect(s.map((x) => x.title)).toEqual([
      'Tus grupos',
      'MIC',
      'COM',
      'Sin etapa',
    ]);
    expect(s[2].groups.map((x) => x.code)).toEqual(['C1']);
  });
  it('«Tus grupos» sin cabecera si no hay más', () => {
    expect(groupSections([g('a', 'C1', 'com')], ['a'])[0].title).toBeNull();
  });
  it('línea del grupo, sin cero inventado', () => {
    expect(
      groupMetaLine(
        {
          stage: 'com',
          schoolLevels: ['1 ESO'],
          counts: { participants: 12, monitors: 2 },
        },
        true,
      ),
    ).toBe('Tu grupo · COM · 1 ESO · 12 chavalines · 2 monitores');
    expect(
      groupMetaLine({
        stage: 'mic',
        schoolLevels: [],
        counts: { participants: null, monitors: 1 },
      }),
    ).toBe('MIC · 1 monitor');
  });
});

describe('people: cursos, chips y buscador', () => {
  const people = [
    row('1', 'Lucía', 'Zamora', { schoolLevel: lvl('1º ESO') }),
    row('2', 'Hugo', 'Arenas', { schoolLevel: lvl('3º Primaria') }),
    row('3', 'Ana', 'Emaús', {
      schoolLevel: lvl('1º ESO'),
      groupId: null,
      badges: { ...NO_BADGES, noPhotos: true },
    }),
    row('4', 'Ale', 'Otro', { schoolLevel: lvl('Otros') }),
    row('5', 'Iker', 'Raro', { schoolLevel: lvl('Curso puente') }),
    row('6', 'Noa', 'Sin', {}),
  ];
  it('cursos en orden escolar, «Otros» y lo raro detrás, «Sin curso» al final', () => {
    const s = courseSections(people);
    expect(s.map((x) => x.title)).toEqual([
      '3 EP',
      '1 ESO',
      'Otros',
      'Curso puente',
      'Sin curso',
    ]);
    expect(s[1].people.map((p) => p.lastName)).toEqual(['Emaús', 'Zamora']);
    expect(s[2].weight).toBeNull();
    expect(s[3].weight).toBeNull();
    expect(s[4]).toMatchObject({ muted: true, weight: null });
  });
  it('apellido y luego nombre', () => {
    const s = courseSections([
      row('a', 'Zoe', 'Mar'),
      row('b', 'Ana', 'Mar'),
      row('c', 'Pau', 'Alba'),
    ]);
    expect(s[0].people.map((p) => p.firstName)).toEqual(['Pau', 'Ana', 'Zoe']);
  });
  it('cuándo salen los chips', () => {
    expect(courseChips(people)!.map((c) => c.label)).toEqual([
      'Todos',
      '3 EP',
      '1 ESO',
      'Otros',
      'Curso puente',
      'Sin curso',
      'Sin grupo',
    ]);
    const one = [row('1', 'A', 'B', { schoolLevel: lvl('1º ESO') })];
    expect(courseChips(one)).toBeNull();
    // Todos sueltos y un solo curso: filtrar no filtraría nada.
    expect(courseChips(one.map((p) => ({ ...p, groupId: null })))).toBeNull();
    // Un curso con sueltos y no sueltos: sí.
    expect(
      courseChips([...one, { ...one[0], id: '2', groupId: null }])!.map(
        (c) => c.key,
      ),
    ).toEqual(['all', 'eso1', 'loose']);
  });
  it('tocar el chip activo lo suelta', () => {
    expect(toggleChip('eso1', 'eso1')).toBe('all');
    expect(toggleChip('all', 'loose')).toBe('loose');
  });
  const line = (p: ParticipantRow) => personLine(p, 'C1');
  it('«emaus» encuentra «Emaús» y no busca en las marcas', () => {
    expect(
      filterPeople(people, line, { query: 'emaus' }).map((p) => p.id),
    ).toEqual(['3']);
    // «sin» no saca a quien solo lleva la marca «Sin fotos» (Ana).
    expect(
      filterPeople(people, line, { query: 'fotos' }).map((p) => p.id),
    ).toEqual([]);
    expect(
      filterPeople(people, line, { query: 'Ale' }).map((p) => p.id),
    ).toEqual(['4']);
  });
  it('busca también en la línea de debajo', () => {
    expect(
      filterPeople(people, line, { query: '1 eso' }).map((p) => p.id),
    ).toEqual(['1', '3']);
    expect(
      filterPeople(people, line, { query: 'sin grupo' }).map((p) => p.id),
    ).toEqual(['3']);
  });
  it('chip + buscador + «sin fotos» a la vez', () => {
    expect(
      filterPeople(people, line, {
        chip: 'eso1',
        query: 'a',
        noPhotosOnly: true,
      }).map((p) => p.id),
    ).toEqual(['3']);
    expect(
      filterPeople(people, line, { chip: 'loose' }).map((p) => p.id),
    ).toEqual(['3']);
  });
  it('línea de la persona', () => {
    expect(personLine({ ...people[0], age: 13 }, 'C1')).toBe(
      'C1 · 1 ESO · 13 años',
    );
    expect(personLine(people[2], 'C1')).toBe('Sin grupo · 1 ESO');
  });
});

describe('people: vecinos y vincular', () => {
  const list = [row('a', 'A', 'A'), row('b', 'B', 'B'), row('c', 'C', 'C')];
  it('vecinos sin dar la vuelta', () => {
    expect(neighbors(list, 'a')).toEqual({ prev: null, next: list[1] });
    expect(neighbors(list, 'c')).toEqual({ prev: list[1], next: null });
    expect(neighbors(list, 'x')).toEqual({ prev: null, next: null });
  });
  it('los grupos de su curso primero', () => {
    const groups = [
      { id: '1', code: 'C2', name: 'Faro', schoolLevels: ['2º ESO'] },
      { id: '2', code: 'C1', name: 'Brújula', schoolLevels: ['1º ESO'] },
      { id: '3', code: 'M1', name: 'M1', schoolLevels: [] },
    ];
    const opts = groupsForLevel(groups, 'eso1');
    expect(opts.map((o) => o.label)).toEqual([
      'C1 · Brújula (1º ESO)',
      'C2 · Faro (2º ESO)',
      'M1',
    ]);
  });
  it('lo vinculado en la cola pasa a su grupo al momento', () => {
    const loose = row('x', 'X', 'X', {
      groupId: null,
      unassignedMembershipId: 'r1',
    });
    expect(withPendingGroups([loose], new Map([['r1', 'g9']]))[0].groupId).toBe(
      'g9',
    );
  });
});

describe('schoolLevels', () => {
  it('reconoce los textos del CRM', () => {
    expect(schoolLevelFromText('1º ESO')).toEqual({
      key: 'eso1',
      label: '1 ESO',
    });
    expect(schoolLevelFromText('4 Primària')).toEqual({
      key: 'ep4',
      label: '4 EP',
    });
    expect(schoolLevelFromText('2n Batxillerat')?.key).toBe('bach2');
    expect(schoolLevelFromText('FP Grado Superior')?.key).toBe('fp_gs');
    expect(schoolLevelFromText('Curso puente')).toEqual({
      key: null,
      label: 'Curso puente',
    });
    expect(schoolLevelFromText('')).toBeNull();
    expect(courseRank('')).toBe(9000);
  });
  it('el peso sube en toda la escalera; lo desconocido, sin color', () => {
    const weights = SCHOOL_LEVEL_ORDER.filter((k) => k !== 'other').map((k) =>
      levelWeight(k)!,
    );
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeGreaterThan(weights[i - 1]);
    }
    expect(levelWeight('ep3')).not.toBe(levelWeight('ep6'));
    expect(levelWeight('other')).toBeNull();
    expect(levelWeight(null)).toBeNull();
  });
});

describe('phone y consents', () => {
  it('limpia teléfonos', () => {
    expect(cleanPhone('622 14 87 03')).toEqual({
      display: '622 14 87 03',
      tel: '622148703',
      wa: '34622148703',
    });
    expect(cleanPhone('+44 7700 900123')).toMatchObject({
      tel: '+447700900123',
      wa: '447700900123',
    });
    expect(cleanPhone('')).toBeNull();
    expect(cleanPhone(' - ')).toBeNull();
  });
  it('el WhatsApp del menor solo con el «sí»', () => {
    expect(canWhatsappMinor(true)).toBe(true);
    expect(canWhatsappMinor(null)).toBe(false);
    expect(canWhatsappMinor(false)).toBe(false);
    expect(canWhatsappMinor(undefined)).toBe(false);
  });
  const all = {
    goHomeAlone: true,
    photos: true,
    whatsapp: true,
    healthData: true,
    outings: true,
    participation: true,
    dataProtection: true,
  };
  it('null es «Sin contestar» y la solapa en sus tres formas', () => {
    expect(consentState(null)).toBe('unanswered');
    expect(consentsSummary(all)).toBe('Todo autorizado');
    expect(consentsSummary({ ...all, photos: false, outings: false })).toBe(
      '2 sin autorizar',
    );
    expect(
      consentsSummary({
        ...all,
        photos: false,
        whatsapp: null,
        outings: false,
      }),
    ).toBe('2 sin autorizar · 1 sin contestar');
  });
});

describe('attendance', () => {
  const ses = (id: string, date: string): SessionSummary => ({
    id,
    eventId: 'e',
    date,
    startsAt: `${date}T16:30:00+02:00`,
    endsAt: `${date}T18:00:00+02:00`,
    kind: 'weekly',
  });
  const sessions = [
    ses('1', '2026-09-19'),
    ses('2', '2026-09-26'),
    ses('3', '2026-10-03'),
    ses('4', '2026-10-10'),
    ses('5', '2026-10-17'),
    ses('6', '2026-10-31'), // futura
  ];
  const now = new Date('2026-10-24T12:00:00Z');
  it('sin marcar fuera del denominador; horas de las marcadas; Parcial cuenta', () => {
    const t = attendanceTrack(
      sessions,
      {
        '1': 'yes',
        '2': null,
        '3': 'partial',
        '4': 'no_unjustified',
        '6': 'yes',
      },
      now,
      { '4': 'Médico' },
    );
    expect(t).toMatchObject({
      attended: 2,
      missed: 1,
      unknown: 2,
      counted: 3,
      pct: 67,
      hours: 3,
      hoursTotal: 4.5,
    });
    // Ni sesiones futuras.
    expect(t.squares.map((s) => s.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(t.squares[3].reason).toBe('Médico');
    expect(formatHours(t.hoursTotal)).toBe('4,5');
    expect(formatHours(3)).toBe('3');
  });
  it('«Sin datos» sin ninguna marcada', () => {
    expect(attendanceTrack(sessions, {}, now).pct).toBeNull();
  });
  it('la racha se corta en un hueco y en un «vino»', () => {
    const t = (m: Record<string, 'yes' | 'no_justified' | 'no_unjustified'>) =>
      streakOf(attendanceTrack(sessions, m, now));
    expect(
      t({ '3': 'no_unjustified', '4': 'no_justified', '5': 'no_unjustified' }),
    ).toBe(3);
    expect(t({ '3': 'no_unjustified', '5': 'no_unjustified' })).toBe(1);
    expect(t({ '4': 'no_unjustified', '5': 'yes' })).toBe(0);
    expect(t({ '4': 'no_unjustified' })).toBe(0); // el 5 sin marcar corta
  });
  it('eventos: fuera los que aún no han sido o no va, y en su fecha', () => {
    const ev = eventSquares(
      [
        {
          eventId: 'a',
          name: 'Salida',
          startsAt: '2026-10-10T10:00:00+02:00',
          endsAt: '2026-10-11T18:00:00+02:00',
          status: 'yes',
        },
        {
          eventId: 'b',
          name: 'Pascua',
          startsAt: '2027-03-25T10:00:00+01:00',
          endsAt: '2027-03-28T18:00:00+02:00',
          status: 'registered',
        },
        {
          eventId: 'c',
          name: 'Otra',
          startsAt: '2026-10-03T10:00:00+02:00',
          endsAt: '2026-10-03T18:00:00+02:00',
          status: 'cancelled',
        },
      ],
      now,
    );
    expect(ev.map((e) => e.id)).toEqual(['a']);
    const tl = timeline(attendanceTrack(sessions, {}, now).squares, ev);
    expect(tl.map((x) => x.id)).toEqual(['1', '2', '3', '4', 'a', '5']);
    expect(byMonth(tl).map((m) => [m.label, m.squares.length])).toEqual([
      ['sep', 2],
      ['oct', 4],
    ]);
  });
});

describe('notices', () => {
  const n = (id: string, date: string) => ({
    id,
    date,
    reason: id,
    familyNotified: false,
  });
  it('número por fecha e id; retirar el del medio renumera', () => {
    const list = numberNotices([
      n('b', '2026-10-17'),
      n('a', '2026-10-17'),
      n('c', '2026-10-03'),
    ]);
    expect(list.map((x) => [x.id, x.number])).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 3],
    ]);
    const without = numberNotices(list.filter((x) => x.id !== 'a'));
    expect(without.map((x) => [x.id, x.number])).toEqual([
      ['c', 1],
      ['b', 2],
    ]);
  });
  it('el pendiente se numera en su sitio', () => {
    const list = numberNotices([
      n('x', '2026-10-17'),
      { ...n('tmp', '2026-10-10'), pending: true },
    ]);
    expect(list[0]).toMatchObject({ id: 'tmp', number: 1, pending: true });
  });
  it('color tope y avisos de límite', () => {
    expect([1, 2, 3, 4].map(noticeTier)).toEqual([1, 2, 3, 3]);
    expect(noticeWarning(1, 3)).toBeNull();
    expect(noticeWarning(2, 3)).toEqual({ kind: 'next_is_exit', limit: 3 });
    expect(noticeWarning(3, 3)).toEqual({ kind: 'at_limit', count: 3 });
  });
});
