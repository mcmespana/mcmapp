/**
 * Pasar lista en un evento (plan 07): las reglas puras, portadas del plugin
 * (`sticpa_pl_ev_*`, `sticpa_gac_*` y sus `test_gac_*`).
 */
import type { EventRoll, EventSummary } from '@/services/comunica/contract';
import { createFakeServer } from '@/services/comunica/fake';
import {
  armTab,
  groupCount,
  groupHeading,
  groupLabelsByPerson,
  shortGroupLabel,
  tabLabel,
  withoutLabel,
} from '@/utils/comunica/activityGroups';
import {
  courseChips,
  courseSections,
  eventDraftFrom,
  eventRollQueueKey,
  eventRows,
  fillVisibleLabel,
  groupSections,
  markVisibleUnmarked,
  outRows,
  toEventRollWrite,
  visibleRowIds,
} from '@/utils/comunica/eventRoll';
import {
  classifyEvents,
  eventDates,
  isHomeCard,
  todayLabel,
} from '@/utils/comunica/events';
import { nameKey } from '@/utils/comunica/nameKey';

const ev = (
  id: string,
  startDate: string,
  endDate = startDate,
): EventSummary => ({
  id,
  name: id,
  startDate,
  endDate,
  startsAt: `${startDate}T10:00:00+01:00`,
  endsAt: `${endDate}T18:00:00+01:00`,
});

describe('elegir evento', () => {
  const events = [
    ev('pasado-viejo', '2026-10-01', '2026-10-02'),
    ev('pasado', '2026-11-01'),
    ev('acaba', '2026-11-12', '2026-11-14'),
    ev('en-marcha', '2026-11-10', '2026-11-20'),
    ev('empieza', '2026-11-14', '2026-11-15'),
    ev('un-dia', '2026-11-14'),
    ev('lejos', '2027-02-01'),
    ev('cerca', '2026-11-21'),
    ev('curso-pasado', '2026-06-20', '2026-06-22'),
  ];

  it('hoy (empieza, acaba, en marcha), próximos y pasados en su orden', () => {
    const b = classifyEvents(events, '2026-11-14');
    expect(b.today.map((c) => c.event.id)).toEqual([
      'empieza',
      'un-dia',
      'acaba',
      'en-marcha',
    ]);
    expect(b.upcoming.map((c) => c.event.id)).toEqual(['cerca', 'lejos']);
    expect(b.past.map((c) => c.event.id)).toEqual(['pasado', 'pasado-viejo']);
    expect(b.count).toBe(8);
  });

  it('«Hoy» a secas en uno de un día; la portada, solo si empieza o acaba', () => {
    const b = classifyEvents(events, '2026-11-14');
    const by = (id: string) => b.today.find((c) => c.event.id === id)!;
    expect(todayLabel(by('empieza'))).toBe('Hoy empieza');
    expect(todayLabel(by('un-dia'))).toBe('Hoy');
    expect(todayLabel(by('acaba'))).toBe('Hoy termina');
    expect(todayLabel(by('en-marcha'))).toBe('En marcha');
    expect(isHomeCard(by('acaba'))).toBe(true);
    expect(isHomeCard(by('en-marcha'))).toBe(false);
  });

  it('el 1 de septiembre cambia el curso', () => {
    const list = [ev('junio', '2027-06-20'), ev('septiembre', '2027-09-10')];
    expect(
      classifyEvents(list, '2027-08-31').past.map((c) => c.event.id),
    ).toEqual(['junio']);
    const sept = classifyEvents(list, '2027-09-01');
    expect(sept.past).toEqual([]);
    expect(sept.upcoming.map((c) => c.event.id)).toEqual(['septiembre']);
  });

  it('fechas cortas', () => {
    expect(eventDates(ev('a', '2026-10-10'))).toBe('10 oct');
    expect(eventDates(ev('a', '2026-10-10', '2026-10-12'))).toBe('10 – 12 oct');
    expect(eventDates(ev('a', '2026-09-28', '2026-10-02'))).toBe(
      '28 sep – 2 oct',
    );
  });
});

describe('orden por apellidos', () => {
  it('sin acentos, con la ñ detrás de la n', () => {
    const names = [
      ['Peña', 'Ana'],
      ['Pérez', 'Luis'],
      ['Álvarez', 'Bea'],
      ['Penzo', 'Eva'],
      ['Alonso', 'Raúl'],
    ];
    const sorted = [...names].sort((a, b) =>
      nameKey(a[0], a[1]) < nameKey(b[0], b[1]) ? -1 : 1,
    );
    expect(sorted.map((n) => n[0])).toEqual([
      'Alonso',
      'Álvarez',
      'Penzo',
      'Peña',
      'Pérez',
    ]);
  });
});

describe('grupos de actividad', () => {
  it('etiqueta corta', () => {
    expect(shortGroupLabel('room', 'Habitación 12')).toBe('Habitación 12');
    expect(shortGroupLabel('room', '12')).toBe('Hab. 12');
    expect(shortGroupLabel('room', 'Hab 15')).toBe('Hab 15');
    expect(shortGroupLabel('patrol', 'Halcones')).toBe('Patrulla Halcones');
    expect(shortGroupLabel('patrol', 'Patrulla 3')).toBe('Patrulla 3');
    expect(shortGroupLabel('other', 'Rojo')).toBe('Rojo');
    expect(shortGroupLabel('clan', 'Los del norte del pueblo de arriba')).toBe(
      'Clan Los del norte del pue…',
    );
  });

  it('título de un grupo: el número suelto lleva el tipo', () => {
    expect(groupHeading('room', '14')).toBe('Habitación 14');
    expect(groupHeading('subgroup', 'B')).toBe('Subgrupo B');
    expect(groupHeading('room', 'Hab. 15 (chicas)')).toBe('Hab. 15 (chicas)');
    expect(groupHeading('patrol', 'Halcones')).toBe('Halcones');
    expect(groupHeading('other', '3')).toBe('3');
  });

  it('nombre de la pestaña y «Sin …»', () => {
    expect(tabLabel({ type: 'patrol', batch: null })).toBe('Patrullas');
    expect(tabLabel({ type: 'subgroup', batch: ' Mitades ' })).toBe('Mitades');
    expect(withoutLabel({ type: 'patrol', batch: null })).toBe('Sin patrulla');
    expect(withoutLabel({ type: 'room', batch: null })).toBe('Sin habitación');
    expect(withoutLabel({ type: 'room', batch: 'Noche 2' })).toBe('Sin grupo');
    expect(withoutLabel({ type: 'clan', batch: null })).toBe('Sin grupo');
  });
});

// Con el falso: la convivencia que empieza «hoy».
const CLOCK = '2026-11-14T07:30:00Z';
let roll: EventRoll;
beforeAll(async () => {
  const s = createFakeServer({ latencyMs: 0, clock: CLOCK });
  roll = await s.getEventRoll('f-ev-convivencia');
});

describe('la lista del autobús', () => {
  const rowsOf = () => eventRows(roll, groupLabelsByPerson(roll.activity));

  it('etapa y curso de la delegación, otras detrás, monitores plegados y «No van»', () => {
    const sections = courseSections(rowsOf(), outRows(roll), {});
    const titles = sections.map((s) => s.title);
    expect(titles[0]).toBe('MIC');
    expect(titles).toContain('COM');
    expect(titles).toContain('Sin etapa');
    const other = titles.findIndex((t) => t.includes('Puerto Alto'));
    expect(other).toBeGreaterThan(titles.indexOf('Sin etapa'));
    expect(titles.slice(-2)).toEqual(['Monitores y equipo', 'No van']);
    const mon = sections.find((s) => s.kind === 'monitors')!;
    expect(mon.open).toBe(false);
    expect(mon.data).toEqual([]);
    expect(mon.count).toBe(4);
    // «Sin curso» al final de su etapa.
    const noStage = sections.find((s) => s.title === 'Sin etapa')!;
    const courses = noStage.data.filter((d) => d.type === 'course');
    expect(courses.at(-1)).toMatchObject({ title: 'Sin curso' });
  });

  it('los monitores no cuentan en los chips de curso', () => {
    const chips = courseChips(rowsOf());
    expect(chips[0]).toEqual({
      key: '',
      label: 'Todos',
      count: rowsOf().length,
    });
    expect(chips.at(-1)).toEqual({
      key: 'monitor',
      label: 'Monitores',
      count: 4,
    });
    const courses = chips.slice(1, -1).reduce((n, c) => n + c.count, 0);
    expect(courses).toBe(rowsOf().length - 4);
  });

  it('el chip filtra y cuenta; el buscador abre el pliegue', () => {
    const rows = rowsOf();
    const c = courseChips(rows)[1];
    const only = courseSections(rows, outRows(roll), { chip: c.key });
    expect(
      only
        .filter((s) => s.kind !== 'notGoing')
        .reduce((n, s) => n + s.count, 0),
    ).toBe(c.count);
    expect(only.some((s) => s.kind === 'monitors')).toBe(false);
    const monitor = rows.find((r) => r.monitor)!;
    const found = courseSections(rows, outRows(roll), {
      query: monitor.person.person.lastName.split(' ')[0].toUpperCase(),
    });
    const mon = found.find((s) => s.kind === 'monitors')!;
    expect(mon.open).toBe(true);
    expect(visibleRowIds(found)).toContain(monitor.id);
    expect(courseSections(rows, outRows(roll), { query: 'zzzz' })).toEqual([]);
  });

  it('«Están todos» nunca pisa una marca ni toca lo plegado', () => {
    const rows = rowsOf();
    const sections = courseSections(rows, outRows(roll), {});
    const visible = visibleRowIds(sections);
    let draft = eventDraftFrom(roll, roll.sessions[0].id);
    expect(fillVisibleLabel(draft, visible).label).toBe('Están todos');
    draft.marks[visible[0]] = 'no_justified';
    expect(fillVisibleLabel(draft, visible).label).toBe(
      `El resto está (${visible.length - 1})`,
    );
    draft = markVisibleUnmarked(draft, visible);
    expect(draft.marks[visible[0]]).toBe('no_justified');
    const monitor = rows.find((r) => r.monitor)!;
    expect(draft.marks[monitor.id]).toBeNull();
    expect(fillVisibleLabel(draft, visible).enabled).toBe(false);
  });

  it('el payload solo lleva marcas puestas de gente de la lista', () => {
    const draft = eventDraftFrom(roll, roll.sessions[0].id);
    const [a, b] = roll.people;
    draft.marks[a.person.id] = 'partial';
    draft.notes[a.person.id] = '  Llega a la comida ';
    draft.marks['de-fuera'] = 'yes';
    draft.marks[b.person.id] = null;
    const w = toEventRollWrite(draft, roll.people, null, '2026-11-15');
    expect(w.marks).toEqual({
      [a.person.id]: { mark: 'partial', reason: 'Llega a la comida' },
    });
    expect(w.sessionId).toBeNull();
  });

  it('la clave de la cola separa la sesión nueva de cada día', () => {
    expect(eventRollQueueKey('e', null, '2026-11-15')).toBe(
      'event-roll:e:new-2026-11-15',
    );
    expect(eventRollQueueKey('e', null, '2026-11-16')).not.toBe(
      eventRollQueueKey('e', null, '2026-11-15'),
    );
    expect(eventRollQueueKey('e', 's1', '2026-11-15')).toBe('event-roll:e:s1');
  });
});

describe('una pestaña de grupos', () => {
  it('no inscrito sin marca, «Cancelada», «Sin patrulla», monitor arriba', () => {
    const tab = roll.activity.tabs.find((t) => t.type === 'patrol')!;
    const armed = armTab(roll, tab.key)!;
    expect(armed.groups.map((g) => g.group.name)).toEqual([
      'Patrulla 3',
      'Patrulla 4',
      'Patrulla Halcones',
      'Patrulla Linces',
    ]);
    const p3 = armed.groups[0];
    expect(p3.monitors.map((m) => [m.name, m.markable])).toEqual([
      ['Rocío Fuentes Lara', false],
    ]);
    expect(p3.participants.some((p) => p.status === 'Cancelada')).toBe(true);
    expect(armed.groups[1].n).toBe(0);
    expect(armed.without.length).toBeGreaterThanOrEqual(3);
    // «Sin patrulla», en la lista por grupos, con su chip.
    const rows = eventRows(roll, groupLabelsByPerson(roll.activity));
    const by = groupSections(armed, rows, outRows(roll), {});
    const titles = by.sections.map((s) => s.title);
    expect(titles).toContain('Sin patrulla');
    expect(by.chips.map((c) => c.key)).toContain('sin');
    // El no inscrito, en la cabecera de su grupo.
    const s3 = by.sections.find((s) => s.title === 'Patrulla 3')!;
    expect(s3.data[0]).toMatchObject({
      type: 'note',
      text: 'Sin inscripción, no se marca: Rocío Fuentes Lara',
    });
  });

  it('en un grupo sin «con monitor», el monitor va con los demás', () => {
    const base = roll.activity.groups[0];
    const person = roll.people.find((p) => p.role === 'monitor')!;
    const fake: EventRoll = {
      ...roll,
      activity: {
        tabs: [{ key: 'room|', type: 'room', batch: null, groupCount: 1 }],
        groups: [
          {
            ...base,
            tabKey: 'room|',
            type: 'room',
            withMonitors: false,
            capacity: 1,
          },
        ],
        members: [
          {
            groupId: base.id,
            tabKey: 'room|',
            role: 'monitor',
            personId: person.person.id,
            name: '',
          },
          {
            groupId: base.id,
            tabKey: 'room|',
            role: 'participant',
            personId: roll.people[0].person.id,
            name: '',
          },
        ],
      },
    };
    const g = armTab(fake, 'room|')!.groups[0];
    expect(g.monitors).toEqual([]);
    expect(g.participants.length).toBe(2);
    expect(groupCount(g)).toEqual({ text: '2/1 plazas', over: true });
  });

  it('cupo pasado en las habitaciones', () => {
    const tab = roll.activity.tabs.find((t) => t.type === 'room')!;
    const armed = armTab(roll, tab.key)!;
    expect(armed.groups.some((g) => groupCount(g).over)).toBe(true);
  });
});
