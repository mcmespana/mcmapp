/**
 * Pasar lista en un evento (plan 07): el servidor falso cumple lo que promete
 * el de verdad (`COMUNICA_API.md` «Pasar lista en un evento»).
 */
import { createFakeServer } from '@/services/comunica/fake';
import { EventRollWrite } from '@/services/comunica/contract';

const MORNING = '2026-11-14T07:30:00Z'; // sábado 14/11, 8:30 en Madrid
const TODAY = '2026-11-14';
const cid = (n: number) =>
  `6a1f3c20-7d4e-4b8a-9c2d-${String(n).padStart(12, '0')}`;

const server = (patch = {}) =>
  createFakeServer({ latencyMs: 0, clock: MORNING, ...patch });

describe('GET /v1/events', () => {
  it('solo los de la delegación, del curso, de 50 días o menos y no semanales', async () => {
    const s = server();
    const r = await s.getEvents();
    const ids = r.events.map((e) => e.id);
    expect(r.season).toBe('2026-2027');
    expect(ids).toContain('f-ev-convivencia');
    expect(ids).toContain('f-ev-excursion');
    expect(ids).not.toContain('f-ev-largo');
    expect(ids).not.toContain('f-ev-semanal');
    expect(ids).not.toContain('f-ev-ajeno');
    const conv = r.events.find((e) => e.id === 'f-ev-convivencia')!;
    expect(conv.startDate).toBe(TODAY);
    expect(ids.length).toBeGreaterThan(8);
  });

  it('fuera de la lista, `forbidden` (exista o no)', async () => {
    const s = server();
    for (const id of ['f-ev-largo', 'f-ev-ajeno', 'f-ev-semanal', 'nada']) {
      await expect(s.getEventRoll(id)).rejects.toMatchObject({
        code: 'forbidden',
      });
    }
  });
});

describe('GET /v1/events/:id/roll', () => {
  it('una vez por persona, monitores de tres maneras y «No van»', async () => {
    const s = server();
    const r = await s.getEventRoll('f-ev-convivencia');
    const ids = r.people.map((p) => p.person.id);
    expect(new Set(ids).size).toBe(ids.length);
    // La de dos inscripciones (una cancelada vieja) sale una vez y se marca.
    const notGoingIds = r.notGoing.map((p) => p.person.id);
    expect(ids.filter((id) => notGoingIds.includes(id))).toEqual([]);
    expect(r.people.filter((p) => p.role === 'monitor').length).toBe(3);
    expect(r.people.filter((p) => p.role === 'team').length).toBe(1);
    expect(r.people.filter((p) => p.otherDelegation).length).toBe(3);
    expect(
      r.people.some((p) => !p.schoolLevel && p.role === 'participant'),
    ).toBe(true);
    expect(r.people.some((p) => !p.stage && p.role === 'participant')).toBe(
      true,
    );
    expect(r.notGoing.map((p) => p.registrationStatus).sort()).toEqual([
      'cancelled',
      'cancelled',
      'did_not_take_part',
      'rejected',
    ]);
    // Monitores: sin curso ni grupo de los sábados.
    expect(
      r.people
        .filter((p) => p.role !== 'participant')
        .every((p) => !p.schoolLevel && !p.homeGroup),
    ).toBe(true);
    // Nadie empieza marcado.
    expect(r.sessions.length).toBe(2);
    expect(Object.keys(r.marksBySession[r.sessions[0].id])).toEqual([]);
  });

  it('grupos de actividad: patrullas y habitaciones, sin anulados', async () => {
    const r = await server().getEventRoll('f-ev-convivencia');
    expect(r.activity.tabs.map((t) => t.type)).toEqual(['patrol', 'room']);
    expect(r.activity.tabs[0].groupCount).toBe(4);
    // El monitor que no se apuntó: sin persona.
    expect(r.activity.members.some((m) => m.personId === null)).toBe(true);
  });

  it('de un evento terminado, los anulados con gente sí se ven', async () => {
    const r = await server().getEventRoll('f-ev-inicio');
    const names = r.activity.groups.map((g) => g.name).sort();
    expect(names).toEqual(['Mitad A', 'Mitad B', 'Mitad C']);
    expect(r.activity.tabs).toEqual([
      expect.objectContaining({ type: 'subgroup', batch: 'Mitades' }),
    ]);
  });
});

describe('PUT /v1/events/:id/roll', () => {
  it('lo escrito se relee; lo no enviado no se toca; el resto, `skipped`', async () => {
    const s = server();
    const r = await s.getEventRoll('f-ev-convivencia');
    const [a, b] = r.people;
    const sid = r.sessions[0].id;
    const res = await s.saveEventRoll('f-ev-convivencia', {
      clientId: cid(1),
      sessionId: sid,
      day: TODAY,
      marks: {
        [a.person.id]: { mark: 'yes' },
        [b.person.id]: { mark: 'no_justified', reason: '  Médico  ' },
        'f-per-de-nadie': { mark: 'yes' },
      },
    });
    expect(res.status).toBe('applied');
    expect(res.skipped).toEqual(['f-per-de-nadie']);
    expect(res.counts).toEqual({ came: 1, missed: 1 });
    await s.saveEventRoll('f-ev-convivencia', {
      clientId: cid(2),
      sessionId: sid,
      day: TODAY,
      marks: { [a.person.id]: { mark: 'partial' } },
    });
    const again = await s.getEventRoll('f-ev-convivencia');
    expect(again.marksBySession[sid]).toEqual({
      [a.person.id]: { mark: 'partial' },
      [b.person.id]: { mark: 'no_justified', reason: 'Médico' },
    });
  });

  it('dos PUT con `sessionId: null` y el mismo día crean UNA sesión', async () => {
    const s = server();
    const r = await s.getEventRoll('f-ev-excursion');
    expect(r.sessions).toEqual([]);
    const pid = r.people[0].person.id;
    const body = (n: number) => ({
      clientId: cid(n),
      sessionId: null,
      day: TODAY,
      marks: { [pid]: { mark: 'yes' as const } },
    });
    const one = await s.saveEventRoll('f-ev-excursion', body(3));
    const two = await s.saveEventRoll('f-ev-excursion', body(4));
    expect(two.sessionId).toBe(one.sessionId);
    const after = await s.getEventRoll('f-ev-excursion');
    expect(after.sessions).toHaveLength(1);
    expect(after.sessions[0].date).toBe(TODAY);
    expect(after.sessions[0].startsAt).toBe('2026-11-14T09:00:00+01:00');
  });

  it('«la relectura falla»: se reintenta y no se duplica', async () => {
    const s = server({ eventRereadFails: true });
    const r = await s.getEventRoll('f-ev-excursion');
    const body = {
      clientId: cid(5),
      sessionId: null,
      day: TODAY,
      marks: { [r.people[0].person.id]: { mark: 'yes' as const } },
    };
    await expect(s.saveEventRoll('f-ev-excursion', body)).rejects.toMatchObject(
      { code: 'crm_unavailable' },
    );
    s.setControls({ eventRereadFails: false });
    const res = await s.saveEventRoll('f-ev-excursion', body);
    expect(res.status).toBe('applied');
    expect((await s.getEventRoll('f-ev-excursion')).sessions).toHaveLength(1);
  });

  it('el contrato no deja mandar una marca nula', () => {
    expect(
      EventRollWrite.safeParse({
        clientId: cid(6),
        sessionId: null,
        day: TODAY,
        marks: { x: { mark: null } },
      }).success,
    ).toBe(false);
  });
});
