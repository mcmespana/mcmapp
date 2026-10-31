/**
 * Coordinación (plan 06) en el contrato y en el servidor falso: esquemas,
 * alcance, 403, la lista de monitores con sus inscripciones (el bug del parte
 * de estado §1), reuniones, la ficha y los seguimientos con sus permisos.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { generateFakeData } from '@/services/comunica/fake/fixtures';
import { ComunicaApiError } from '@/services/comunica/client';
import {
  FollowUpsResponse,
  MeetingWrite,
  MonitorsRollWrite,
  ROUTES,
  TeamMember,
} from '@/services/comunica/contract';
import {
  monitorsDraftFrom,
  monitorsMarks,
} from '@/utils/comunica/monitorsRoll';

const CLIENT = (n: number) =>
  `6a1f3c20-7d4e-4b8a-9c2d-${String(n).padStart(12, '0')}`;
// Sábado 24/10/2026 a las 17:00 de Madrid.
const SATURDAY = '2026-10-24T15:00:00Z';

const server = (patch = {}) =>
  createFakeServer({ latencyMs: 0, clock: SATURDAY, ...patch });

const expectError = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ComunicaApiError);
  await p.catch((e: ComunicaApiError) => expect(e.code).toBe(code));
};

describe('contrato de Coordinación (plan 06)', () => {
  it('admite un miembro del equipo y rechaza lo que no es', () => {
    const m = {
      id: 'f-per-01',
      firstName: 'Ana',
      lastName: 'Ruiz',
      groupCodes: ['C1'],
      stage: 'com',
      otherStages: [],
    };
    expect(TeamMember.parse(m)).toEqual(m);
    expect(TeamMember.safeParse({ ...m, stage: 'COM' }).success).toBe(false);
  });

  it('la lista de monitores no admite una marca null', () => {
    const base = { clientId: CLIENT(1), kind: 'weekly' };
    expect(
      MonitorsRollWrite.safeParse({
        ...base,
        marks: [{ personId: 'p', mark: 'yes' }],
      }).success,
    ).toBe(true);
    expect(
      MonitorsRollWrite.safeParse({
        ...base,
        marks: [{ personId: 'p', mark: null }],
      }).success,
    ).toBe(false);
  });

  it('una reunión: nombre de 1 a 120, hora HH:MM y duraciones fijas', () => {
    const ok = {
      clientId: CLIENT(2),
      name: 'Programación del 2.º trimestre',
      date: '2026-11-03',
      startTime: '19:00',
      durationHours: 1.5,
    };
    expect(MeetingWrite.safeParse(ok).success).toBe(true);
    expect(MeetingWrite.safeParse({ ...ok, name: '  ' }).success).toBe(false);
    expect(
      MeetingWrite.safeParse({ ...ok, name: 'x'.repeat(121) }).success,
    ).toBe(false);
    expect(MeetingWrite.safeParse({ ...ok, durationHours: 2.5 }).success).toBe(
      false,
    );
    expect(MeetingWrite.safeParse({ ...ok, startTime: '7pm' }).success).toBe(
      false,
    );
  });

  it('los seguimientos nunca se guardan en el móvil; lo demás, sí', () => {
    expect(ROUTES.followUps.persist).toBe(false);
    expect(ROUTES.coordination.persist).toBe(true);
    expect(ROUTES.summary.persist).toBe(true);
    expect(ROUTES.monitorsRoll.persist).toBe(true);
    expect(ROUTES.meetings.persist).toBe(true);
    expect(ROUTES.monitor.persist).toBe(true);
    // Un tipo desconocido no pasa el esquema.
    expect(
      FollowUpsResponse.safeParse({
        generatedAt: '2026-10-24T10:00:00Z',
        readable: [],
        writable: [],
        items: [{ id: 'x', type: 'otro', date: null, text: '', author: '' }],
      }).success,
    ).toBe(false);
  });
});

describe('datos de coordinación', () => {
  it('tienen cada caso de pantalla', () => {
    const d = generateFakeData();
    const meetings = d.sessions.filter((s) => s.kind === 'meeting');
    expect(meetings.map((m) => m.date).sort()).toEqual([
      '2026-09-29',
      '2026-10-20',
      '2026-11-17',
    ]);
    // Sin grupo de verdad, Apoyo (dos) y otros grupos que no pasan lista.
    expect(d.monitorMemberships.map((m) => m.kind).sort()).toEqual([
      'none',
      'outside',
      'outside',
      'support',
      'support',
    ]);
    expect(d.groups.some((g) => g.code === null)).toBe(true);
    expect(Object.values(d.headcountAgeDays)).toContain(5);
    const types = Object.values(d.followUps)
      .flat()
      .map((f) => f.type);
    expect(new Set(types)).toEqual(
      new Set(['incident', 'assessment', 'accompaniment', 'otro']),
    );
    // Lo de los planes 04 y 05 no se ha movido: el monitor de prueba sigue con
    // sus dos grupos y los ids de antes siguen siendo los mismos.
    expect(d.personas.monitor.personId).toBe('f-per-67');
  });
});

describe('Coordinación en el servidor falso (plan 06)', () => {
  it('la portada: 403 para un monitor raso; acompañamiento entra', async () => {
    const s = server();
    await expectError(s.getCoordination(), 'forbidden');
    s.setControls({ persona: 'accompaniment' });
    const home = await s.getCoordination();
    expect(home.weeklyMonitorsRoll).toBeNull();
    // ✅ `alcance-coord`: acompaña COM 1 y ve lo suyo (C1 y C2) y Apoyo (lo
    // ven todos); los sin grupo y los de otros grupos, solo quien ve toda la
    // delegación.
    expect([...new Set(home.team.flatMap((m) => m.groupCodes))].sort()).toEqual(
      ['C1', 'C2'],
    );
    expect(
      home.team.filter((m) => m.unassigned).map((m) => m.unassigned!.kind),
    ).toEqual(['support', 'support']);
    s.setControls({ persona: 'both' });
    expect(
      (await s.getCoordination()).team.filter((m) => m.unassigned),
    ).toHaveLength(5);
  });

  it('el equipo: sin grupo solo para toda la delegación, y uno de dos etapas', async () => {
    const s = server({ persona: 'coordination' });
    const home = await s.getCoordination();
    const loose = home.team.filter((m) => m.unassigned);
    expect(loose).toHaveLength(5);
    expect(loose.every((m) => m.stage === null)).toBe(true);
    const dual = home.team.find((m) => m.otherStages.length > 0)!;
    expect(dual.stage).toBe('mic');
    expect(dual.otherStages).toEqual(['com']);
    expect(home.weeklyMonitorsRoll?.session.date).toBe('2026-10-24');

    s.setControls({ persona: 'coordinationCom2' });
    const com2 = await s.getCoordination();
    // Con alcance acotado, de los que no van por grupos solo Apoyo.
    expect(
      com2.team.every((m) => !m.unassigned || m.unassigned.kind === 'support'),
    ).toBe(true);
    // Solo los grupos de COM 2 (el sin segmento no entra).
    expect(
      com2.lastSession.flatMap((x) => x.rows.map((r) => r.group.code)),
    ).toEqual(['C3']);
  });

  it('el resumen: acotado para COM 2, entero para un monitor', async () => {
    const s = server({ persona: 'coordinationCom2' });
    const sum = await s.getCoordinationSummary();
    expect(sum.scoped).toBe(true);
    expect(sum.mine.flatMap((x) => x.rows.map((r) => r.group.code))).toEqual([
      'C3',
    ]);
    expect(sum.rest.flatMap((x) => x.rows.map((r) => r.group.code))).toContain(
      null,
    );
    s.setControls({ persona: 'monitor' });
    const raso = await s.getCoordinationSummary();
    expect(raso.scoped).toBe(false);
    expect(raso.rest).toEqual([]);
    expect(raso.review.groupsWithoutCode).toHaveLength(1);
    expect(raso.review.participantsWithoutGroup.length).toBeGreaterThan(0);
    // C2 tiene su recuento de hace 5 días.
    const c2 = raso.mine
      .flatMap((x) => x.rows)
      .find((r) => r.group.code === 'C2')!;
    expect(
      Date.parse(SATURDAY) - Date.parse(c2.headcount!.countedAt),
    ).toBeGreaterThan(4 * 86_400_000);
  });

  it('la lista de monitores: solo coordinación, una por etapa', async () => {
    const s = server({ persona: 'accompaniment' });
    await expectError(s.getMonitorsRoll({ kind: 'weekly' }), 'forbidden');
    s.setControls({ persona: 'coordination' });
    const com = await s.getMonitorsRoll({ kind: 'weekly' });
    expect(com.stages).toEqual(['mic', 'com']);
    expect(com.stage).toBe('com');
    // Los que no van por grupos (Apoyo, otros, sin grupo) van en la lista
    // por defecto, opcionales y de joven a mayor; el de dos etapas, en MIC.
    const optional = com.rows.filter((r) => r.optional);
    expect(optional).toHaveLength(5);
    expect(optional.every((r) => r.member.unassigned)).toBe(true);
    expect(com.rows.filter((r) => !r.optional && r.member.unassigned)).toEqual(
      [],
    );
    const ages = optional.map(
      (r) => s.data.monitorProfiles[r.member.id]?.age ?? 99,
    );
    expect([...ages].sort((a, b) => a - b)).toEqual(ages);
    expect(com.borrowed).toHaveLength(1);
    const mic = await s.getMonitorsRoll({ kind: 'weekly', stage: 'mic' });
    expect(mic.rows.some((r) => r.member.otherStages.includes('com'))).toBe(
      true,
    );
    expect(mic.rows.some((r) => r.member.unassigned)).toBe(false);
    // Una de las semanales ya pasada, con marcas de todo el curso.
    const past = await s.getMonitorsRoll({
      kind: 'weekly',
      stage: 'com',
      session: com.sessions.find((x) => x.date === '2026-10-17')!.id,
    });
    expect(past.rollCall?.status).toBe('taken');
    expect(past.rows[0].seasonMarks.length).toBeGreaterThanOrEqual(5);
  });

  it('en una reunión, quien coordina un segmento ve a toda la delegación; los de fuera, sin ficha', async () => {
    const all = server({ persona: 'coordination' });
    const seg = server({ persona: 'coordinationCom2' });
    const meeting = { kind: 'meeting' as const, session: 'f-ses-reunion-01' };
    const everyone = await all.getMonitorsRoll(meeting);
    const mine = await seg.getMonitorsRoll(meeting);
    expect(mine.rows.map((r) => r.member.id).sort()).toEqual(
      everyone.rows.map((r) => r.member.id).sort(),
    );
    expect(mine.rows.some((r) => r.outOfScope)).toBe(true);
    expect(mine.rows.some((r) => !r.outOfScope)).toBe(true);
    expect(everyone.rows.some((r) => r.outOfScope)).toBe(false);
    // La semanal sigue siendo solo de su alcance.
    const weekly = await seg.getMonitorsRoll({ kind: 'weekly' });
    expect(weekly.rows.length).toBeLessThan(mine.rows.length);
  });

  it('primera lista de una reunión: crea las inscripciones; la segunda, ninguna', async () => {
    const s = server({ persona: 'coordination' });
    const meeting = s.data.sessions.find((x) => x.id === 'f-ses-reunion-01')!;
    const roll = await s.getMonitorsRoll({
      kind: 'meeting',
      session: meeting.id,
    });
    expect(roll.rollCall).toBeNull();
    expect(roll.rows.every((r) => r.mark === null)).toBe(true);
    const draft = monitorsDraftFrom(roll.rows);
    const absent = roll.rows.filter((r) => !r.optional)[1].member.id;
    draft.marks[absent] = 'no_justified';
    draft.notes[absent] = 'x'.repeat(300);
    const marks = monitorsMarks(roll.rows, draft);
    // Los que no van por grupos salen con «-» también en reuniones (plugin,
    // 31/10/2026): sin tocar, no se mandan.
    expect(roll.rows.some((r) => r.optional)).toBe(true);
    expect(marks).toHaveLength(roll.rows.filter((r) => !r.optional).length);
    const before = s.data.registrationsCreated;
    const res = await s.saveMonitorsRoll(meeting.id, {
      clientId: CLIENT(10),
      kind: 'meeting',
      marks,
    });
    expect(res.status).toBe('applied');
    expect(s.data.registrationsCreated).toBeGreaterThan(before);
    const again = await s.getMonitorsRoll({
      kind: 'meeting',
      session: meeting.id,
    });
    // Al volver se ven TODAS las marcas (el fallo del 26/09 era releer mal).
    expect(
      again.rows.filter((r) => !r.optional).every((r) => r.mark !== null),
    ).toBe(true);
    expect(again.rows.find((r) => r.member.id === absent)?.reason).toHaveLength(
      255,
    );
    const created = s.data.registrationsCreated;
    const writes = s.writeCount;
    await s.saveMonitorsRoll(meeting.id, {
      clientId: CLIENT(11),
      kind: 'meeting',
      marks,
    });
    expect(s.data.registrationsCreated).toBe(created);
    // Lo mismo: no reescribe nada.
    expect(s.writeCount).toBe(writes);
    // Mismo clientId: no duplica.
    await s.saveMonitorsRoll(meeting.id, {
      clientId: CLIENT(10),
      kind: 'meeting',
      marks,
    });
    expect(s.writeCount).toBe(writes);
    // La reunión ya no está pendiente en «Hoy».
    expect((await s.getToday()).pendingMeeting).toBeNull();
  });

  it('rechaza el tipo equivocado y las semanales futuras; una reunión futura, no', async () => {
    const s = server({ persona: 'coordination' });
    // ✅ `futuras` = «como el plugin»: la reunión futura se guarda.
    const future = s.data.sessions.find((x) => x.id === 'f-ses-reunion-02')!;
    const ok = await s.saveMonitorsRoll(future.id, {
      clientId: CLIENT(12),
      kind: 'meeting',
      marks: [],
    });
    expect(ok.status).toBe('applied');
    const nextSaturday = s.data.sessions.find(
      (x) => x.stage === 'com' && x.date === '2026-11-07',
    )!;
    await expectError(
      s.saveMonitorsRoll(nextSaturday.id, {
        clientId: CLIENT(14),
        kind: 'weekly',
        marks: [],
      }),
      'validation',
    );
    await expectError(
      s.saveMonitorsRoll('f-ses-reunion-00', {
        clientId: CLIENT(13),
        kind: 'weekly',
        marks: [],
      }),
      'validation',
    );
  });

  it('reuniones: de la más reciente a la más antigua, y crear una', async () => {
    const s = server({ persona: 'coordination' });
    const list = await s.getMeetings();
    expect(list.meetings.map((m) => m.session.date)).toEqual([
      '2026-11-17',
      '2026-10-20',
      '2026-09-29',
    ]);
    expect(list.meetings[2].rollCall?.counts).toEqual({ came: 4, missed: 2 });
    expect(list.meetings[0].durationHours).toBe(1.5);
    const res = await s.createMeeting({
      clientId: CLIENT(20),
      name: 'Programación del 2.º trimestre',
      date: '2026-11-03',
      startTime: '19:00',
      durationHours: 1.5,
    });
    expect(res.meeting.session.endsAt).toBe('2026-11-03T20:30:00+01:00');
    const writes = s.writeCount;
    await s.createMeeting({
      clientId: CLIENT(20),
      name: 'Programación del 2.º trimestre',
      date: '2026-11-03',
      startTime: '19:00',
      durationHours: 1.5,
    });
    expect(s.writeCount).toBe(writes);
    expect((await s.getMeetings()).meetings).toHaveLength(4);
    s.setControls({ persona: 'accompaniment' });
    await expectError(s.getMeetings(), 'forbidden');
  });

  it('la ficha: alcance, pistas y papeleo', async () => {
    const s = server({ persona: 'coordinationCom2' });
    const mic = s.data.groups.find((g) => g.code === 'M1')!.monitorIds[0];
    await expectError(s.getMonitor(mic), 'forbidden');
    s.setControls({ persona: 'coordination' });
    const detail = await s.getMonitor(mic);
    expect(detail.weekly?.registered).toBe(true);
    expect(detail.meetings?.squares.length).toBeGreaterThan(0);
    expect(detail.paperwork.compliance).toHaveLength(8);
    // Quien coordina y acompaña es monitor de M1 sin inscribir al evento.
    const both = s.data.personas.both.personId;
    expect((await s.getMonitor(both)).weekly?.registered).toBe(false);
    // Un monitor sin grupo: sin sábados que mirar.
    const loose = s.data.monitorMemberships[0].personId;
    expect((await s.getMonitor(loose)).weekly).toBeNull();
  });

  it('seguimientos: tabla de quién lee y escribe, y nadie ve los suyos', async () => {
    const s = server({ persona: 'coordination' });
    const c2 = s.data.groups.find((g) => g.code === 'C2')!.monitorIds[1];
    const coord = await s.getFollowUps(c2);
    expect(coord.readable).toEqual(['incident', 'assessment']);
    expect(coord.writable).toEqual(['incident', 'assessment']);
    expect(coord.items.map((i) => i.type)).not.toContain('accompaniment');
    expect(coord.items.some((i) => i.date === null)).toBe(true);
    await expectError(
      s.createFollowUp(c2, {
        clientId: CLIENT(30),
        type: 'accompaniment',
        date: '2026-10-24',
        text: 'No debería poder',
      }),
      'forbidden',
    );
    s.setControls({ persona: 'accompaniment' });
    const acomp = await s.getFollowUps(c2);
    expect(acomp.writable).toEqual(['accompaniment']);
    expect(acomp.items.map((i) => i.type)).toContain('accompaniment');
    // El tipo desconocido no sale nunca.
    expect(acomp.items.some((i) => i.id === 'f-seg-05')).toBe(false);
    const res = await s.createFollowUp(c2, {
      clientId: CLIENT(31),
      type: 'accompaniment',
      date: '2026-10-24',
      text: 'Hablamos después de la sesión.',
    });
    expect(res.item.type).toBe('accompaniment');
    s.setControls({ persona: 'both' });
    const self = await s.getFollowUps(s.data.personas.both.personId);
    expect(self).toMatchObject({ readable: [], writable: [], items: [] });
    // Pero coordinación sí ve lo apuntado sobre esa persona.
    s.setControls({ persona: 'coordination' });
    expect(
      (await s.getFollowUps(s.data.personas.both.personId)).items,
    ).toHaveLength(1);
  });

  it('vincular a un monitor sin grupo lo pone en su grupo', async () => {
    const s = server({ persona: 'coordination' });
    const rel = s.data.monitorMemberships[0];
    const c3 = s.data.groups.find((g) => g.code === 'C3')!;
    await s.assignGroup(rel.id, { clientId: CLIENT(40), groupId: c3.id });
    const home = await s.getCoordination();
    const m = home.team.find((x) => x.id === rel.personId)!;
    expect(m.unassigned).toBeUndefined();
    expect(m.groupCodes).toEqual(['C3']);
    s.setControls({ persona: 'accompaniment' });
    await expectError(
      s.assignGroup(s.data.monitorMemberships[0].id, {
        clientId: CLIENT(41),
        groupId: c3.id,
      }),
      'forbidden',
    );
  });

  it('la sesión de hoy: se crea una vez y se reutiliza', async () => {
    const s = server({
      persona: 'coordination',
      clock: '2026-10-27T10:00:00Z', // martes
    });
    const a = await s.createSessionToday('f-evt-vcom', {
      clientId: CLIENT(50),
    });
    const b = await s.createSessionToday('f-evt-vcom', {
      clientId: CLIENT(51),
    });
    expect(a.session.id).toBe(b.session.id);
    expect(a.session.date).toBe('2026-10-27');
  });
});
