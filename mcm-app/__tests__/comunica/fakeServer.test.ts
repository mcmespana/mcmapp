import { createFakeServer } from '@/services/comunica/fake';
import {
  generateFakeData,
  FIXTURE_TODAY,
} from '@/services/comunica/fake/fixtures';
import { ComunicaApiError } from '@/services/comunica/client';
import { ROUTES } from '@/services/comunica/contract';

const CLIENT = (n: number) =>
  `3b241101-e2bb-4255-8caf-${String(n).padStart(12, '0')}`;
// Sábado 24/10/2026 a las 17:00 de Madrid.
const SATURDAY = '2026-10-24T15:00:00Z';

const server = (patch = {}) =>
  createFakeServer({ latencyMs: 0, clock: SATURDAY, ...patch });

const expectError = async (
  p: Promise<unknown>,
  code: string,
  reason?: string,
) => {
  await expect(p).rejects.toBeInstanceOf(ComunicaApiError);
  await p.catch((e: ComunicaApiError) => {
    expect(e.code).toBe(code);
    if (reason) expect(e.reason).toBe(reason);
  });
};

describe('datos inventados', () => {
  it('son deterministas', () => {
    expect(generateFakeData()).toEqual(generateFakeData());
  });

  it('tienen lo que las pantallas necesitan', () => {
    const d = generateFakeData();
    const participants = d.groups.flatMap((g) => g.participantIds);
    expect(participants.length).toBeGreaterThanOrEqual(55);
    expect(d.groups.some((g) => g.participantIds.length === 0)).toBe(true);
    const monitor = d.personas.monitor.personId;
    expect(d.groups.filter((g) => g.monitorIds.includes(monitor))).toHaveLength(
      2,
    );
    expect(d.rolls.some((r) => r.status === 'skipped')).toBe(true);
    expect(
      d.sessions.filter((s) => s.kind === 'weekly' && s.date < FIXTURE_TODAY)
        .length,
    ).toBeGreaterThan(0);
    expect(Object.keys(d.health).length).toBeGreaterThan(0);
  });

  it('ningún id tiene forma de id del CRM', () => {
    const d = generateFakeData();
    const ids = [
      ...d.people.map((x) => x.id),
      ...d.groups.map((x) => x.id),
      ...d.sessions.map((x) => x.id),
      ...d.events.map((x) => x.id),
      ...d.delegations.map((x) => x.id),
    ];
    for (const id of ids) {
      expect(id.startsWith('f-')).toBe(true);
      expect(id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    }
  });
});

describe('servidor falso', () => {
  it('cada ruta del contrato tiene datos', async () => {
    const s = server();
    const groups = await s.getGroups();
    const gid = groups.myGroupIds[0];
    const session = groups.stageEvents.find((e) => e.stage === 'com')!
      .sessions[0];
    const roll = await s.getRoll(session.id, gid);
    const withHealth = Object.keys(s.data.health).find(
      (id) =>
        s.data.profiles[id] &&
        s.data.people.find((p) => p.id === id)!.delegationId ===
          s.data.delegations[0].id,
    )!;
    const code = await s.requestCode({ email: 'monitor@ejemplo.org' });
    const verified = await s.verify({
      email: 'monitor@ejemplo.org',
      code: '123456',
    });
    const refreshed = await s.refresh(
      'refreshToken' in verified ? verified.refreshToken : '',
    );
    const results: Record<keyof typeof ROUTES, unknown> = {
      code,
      verify: verified,
      refresh: refreshed,
      exchange: await s.exchange({ magic: 'magico-valido' }),
      webPass: await s.webPass({ internalpage: 'list_stic_payments' }),
      me: await s.getMe(),
      groups,
      today: await s.getToday(),
      roll,
      saveRoll: await s.saveRoll(session.id, gid, {
        clientId: CLIENT(1),
        action: 'save',
        marks: { [roll.entries[0].person.id]: 'yes' },
        notes: {},
      }),
      health: await s.getHealth(withHealth),
      people: await s.getPeople(),
      group: await s.getGroupDetail(gid),
      person: await s.getPerson(roll.entries[0].person.id),
      personal: await s.getPersonal(roll.entries[0].person.id),
      createNotice: await s.createNotice(roll.entries[0].person.id, {
        clientId: CLIENT(20),
        date: '2026-10-24',
        reason: 'Prueba',
        familyNotified: false,
      }),
      setScarf: await s.setScarf(roll.entries[0].person.id, {
        clientId: CLIENT(21),
        scarf: 'green',
      }),
      assignGroup: await (async () => {
        s.setControls({ persona: 'coordination' });
        const loose = (await s.getPeople()).people.find(
          (p) => p.unassignedMembershipId,
        )!;
        return s.assignGroup(loose.unassignedMembershipId!, {
          clientId: CLIENT(22),
          groupId: gid,
        });
      })(),
      // Coordinación (plan 06), como coordinación de toda la delegación.
      coordination: await s.getCoordination(),
      summary: await s.getCoordinationSummary(),
      monitorsRoll: await s.getMonitorsRoll({ kind: 'weekly' }),
      saveMonitorsRoll: await s.saveMonitorsRoll('f-ses-reunion-01', {
        clientId: CLIENT(23),
        kind: 'meeting',
        marks: [],
      }),
      meetings: await s.getMeetings(),
      createMeeting: await s.createMeeting({
        clientId: CLIENT(24),
        name: 'Reunión de prueba',
        date: '2026-11-10',
        startTime: '19:00',
        durationHours: 1,
      }),
      monitor: await s.getMonitor(s.data.groups[0].monitorIds[0]),
      followUps: await s.getFollowUps(s.data.groups[0].monitorIds[0]),
      createFollowUp: await s.createFollowUp(s.data.groups[0].monitorIds[0], {
        clientId: CLIENT(25),
        type: 'incident',
        date: '2026-10-24',
        text: 'Prueba',
      }),
      sessionToday: await s.createSessionToday('f-evt-vcom', {
        clientId: CLIENT(26),
      }),
      // Avisos en el móvil (plan 08).
      registerDevice: await s.registerDevice({
        clientId: CLIENT(27),
        deviceId: CLIENT(28),
        pushToken: 'ExponentPushToken[prueba]',
        platform: 'ios',
        appVersion: '2.1.0',
        channels: { rollCall: 'comunica-listas', groups: 'comunica-grupos' },
        prefs: { rollCallDue: true, groupChanges: true },
      }),
      unregisterDevice: await s.unregisterDevice(CLIENT(28)),
    };
    for (const [name, value] of Object.entries(results)) {
      expect(
        ROUTES[name as keyof typeof ROUTES].response.safeParse(value).success,
      ).toBe(true);
    }
  });

  it('espera la latencia que se le pide', async () => {
    jest.useFakeTimers();
    const s = server({ latencyMs: 300 });
    let done = false;
    const p = s.getMe().then(() => (done = true));
    await jest.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    jest.useRealTimers();
  });

  it('sin conexión, CRM caído y error en una ruta', async () => {
    const s = server({ offline: true });
    await expectError(s.getMe(), 'network');
    s.setControls({ offline: false, crmDown: true });
    await expect(s.getToday()).resolves.toBeTruthy(); // leer sigue
    const g = await s.getGroups();
    const sid = g.stageEvents.find((e) => e.stage === 'com')!.sessions[0].id;
    await expectError(
      s.saveRoll(sid, g.myGroupIds[0], {
        clientId: CLIENT(2),
        action: 'skip',
        marks: {},
        notes: {},
      }),
      'crm_unavailable',
    );
    s.setControls({ crmDown: false, failRoute: 'groups' });
    await expectError(s.getGroups(), 'crm_unavailable');
  });

  it('lo de otra delegación es forbidden, exista o no', async () => {
    const s = server();
    const other = s.data.groups.find((g) => g.code === 'P1')!;
    const otherSession = s.data.sessions.find((x) =>
      x.id.startsWith('f-ses-pcom'),
    )!;
    await expectError(s.getRoll(otherSession.id, other.id), 'forbidden');
    await expectError(
      s.getRoll('f-ses-no-existe', 'f-grp-no-existe'),
      'forbidden',
    );
    const groups = await s.getGroups();
    expect(groups.groups.map((g) => g.code)).not.toContain('P1');
    // Y entrando como la otra delegación, al revés.
    s.setControls({ persona: 'other' });
    const theirs = await s.getGroups();
    expect(theirs.groups.map((g) => g.code)).toEqual(['P1']);
  });

  it('lo escrito se vuelve a leer, y no se reescribe lo que no cambia', async () => {
    const s = server();
    const g = (await s.getGroups()).groups.find((x) => x.code === 'C1')!;
    // C1 no tiene lista del último sábado celebrado (17/10).
    const session = s.data.sessions.find(
      (x) => x.date === '2026-10-17' && x.stage === 'com',
    )!;
    const before = await s.getRoll(session.id, g.id);
    expect(before.roll).toBeNull();
    const [a, b] = before.entries.map((e) => e.person.id);
    const body = {
      clientId: CLIENT(3),
      action: 'save' as const,
      marks: { [a]: 'yes' as const, [b]: 'no_justified' as const },
      notes: { [b]: 'Médico' },
    };
    const res = await s.saveRoll(session.id, g.id, body);
    expect(res.status).toBe('applied');
    expect(res.rollCall).toMatchObject({
      status: 'taken',
      counts: { came: 1, missed: 1 },
    });
    const after = await s.getRoll(session.id, g.id);
    expect(after.entries.find((e) => e.person.id === b)).toMatchObject({
      mark: 'no_justified',
      note: 'Médico',
    });
    const writes = s.writeCount;
    // Mismo clientId: no duplica.
    await s.saveRoll(session.id, g.id, body);
    expect(s.writeCount).toBe(writes);
    // Otro clientId con lo mismo: no reescribe.
    await s.saveRoll(session.id, g.id, { ...body, clientId: CLIENT(4) });
    expect(s.writeCount).toBe(writes);
    // Un cambio: una escritura.
    await s.saveRoll(session.id, g.id, {
      ...body,
      clientId: CLIENT(5),
      marks: { ...body.marks, [a]: 'partial' },
    });
    expect(s.writeCount).toBe(writes + 1);
  });

  it('aplica los rechazos de Pasar Lista y notSaved', async () => {
    const s = server({ cannotRegister: true });
    const c1 = s.data.groups.find((x) => x.code === 'C1')!;
    const future = s.data.sessions.find(
      (x) => x.date === '2026-11-07' && x.stage === 'com',
    )!;
    await expectError(
      s.saveRoll(future.id, c1.id, {
        clientId: CLIENT(6),
        action: 'save',
        marks: { [c1.participantIds[1]]: 'yes' },
        notes: {},
      }),
      'validation',
      'session_in_future',
    );
    const last = s.data.sessions.find(
      (x) => x.date === '2026-10-17' && x.stage === 'com',
    )!;
    await expectError(
      s.saveRoll(last.id, c1.id, {
        clientId: CLIENT(7),
        action: 'save',
        marks: {},
        notes: {},
      }),
      'validation',
      'nothing_marked',
    );
    const res = await s.saveRoll(last.id, c1.id, {
      clientId: CLIENT(8),
      action: 'save',
      marks: {
        [c1.participantIds[0]]: 'yes',
        [c1.participantIds[1]]: 'yes',
        'f-per-ajeno': 'yes',
      },
      notes: {},
    });
    expect(res.notSaved).toEqual(
      expect.arrayContaining([
        { personId: c1.participantIds[0], reason: 'no_registration' },
        { personId: 'f-per-ajeno', reason: 'not_in_group' },
      ]),
    );
    await expectError(
      s.saveRoll(last.id, c1.id, {
        clientId: CLIENT(9),
        action: 'skip',
        marks: {},
        notes: {},
      }),
      'validation',
      'already_taken',
    );
  });

  it('desmarcar: una marca guardada que se manda a null se borra (y cuenta una escritura)', async () => {
    const s = server();
    const c1 = s.data.groups.find((x) => x.code === 'C1')!;
    const last = s.data.sessions.find(
      (x) => x.date === '2026-10-17' && x.stage === 'com',
    )!;
    const [a, b] = c1.participantIds;
    await s.saveRoll(last.id, c1.id, {
      clientId: CLIENT(20),
      action: 'save',
      marks: { [a]: 'yes', [b]: 'no_justified' },
      notes: { [b]: 'Médico' },
    });
    const writes = s.writeCount;
    const res = await s.saveRoll(last.id, c1.id, {
      clientId: CLIENT(21),
      action: 'save',
      marks: { [a]: 'yes', [b]: null },
      notes: { [a]: '' },
    });
    expect(s.writeCount).toBe(writes + 1);
    expect(res.roll.entries.find((e) => e.person.id === b)).toMatchObject({
      mark: null,
      note: '',
    });
    expect(res.rollCall.counts).toEqual({ came: 1, missed: 0 });
    // Quitar a quien no tenía marca no escribe nada.
    await s.saveRoll(last.id, c1.id, {
      clientId: CLIENT(22),
      action: 'save',
      marks: { [a]: 'yes', [b]: null },
      notes: { [a]: '' },
    });
    expect(s.writeCount).toBe(writes + 1);
    // Dejar a cero una lista ya pasada se puede: sigue pasada, con 0 y 0.
    const zero = await s.saveRoll(last.id, c1.id, {
      clientId: CLIENT(23),
      action: 'save',
      marks: { [a]: null },
      notes: {},
    });
    expect(zero.rollCall).toMatchObject({
      status: 'taken',
      counts: { came: 0, missed: 0 },
    });
    // Pero una lista nueva no se crea solo con «quitar».
    const c2 = s.data.groups.find((x) => x.code === 'C2')!;
    const noRoll = s.data.sessions.find(
      (x) =>
        x.stage === 'com' &&
        x.date <= '2026-10-24' &&
        !s.data.rolls.some((r) => r.sessionId === x.id && r.groupId === c2.id),
    )!;
    await expectError(
      s.saveRoll(noRoll.id, c2.id, {
        clientId: CLIENT(24),
        action: 'save',
        marks: { [c2.participantIds[0]]: null },
        notes: {},
      }),
      'validation',
      'nothing_marked',
    );
  });

  it('futuras: la próxima se marca si aún no ha llegado ninguna; las demás, no', async () => {
    // Antes del primer sábado del curso.
    const s = server({ clock: '2026-09-01T10:00:00Z' });
    const c1 = s.data.groups.find((x) => x.code === 'C1')!;
    const com = s.data.sessions
      .filter((x) => x.stage === 'com' && x.delegationId === c1.delegationId)
      .sort((x, y) => (x.startsAt < y.startsAt ? -1 : 1));
    const body = (n: number) => ({
      clientId: CLIENT(n),
      action: 'save' as const,
      marks: { [c1.participantIds[0]]: 'yes' as const },
      notes: {},
    });
    expect((await s.saveRoll(com[0].id, c1.id, body(30))).status).toBe(
      'applied',
    );
    await expectError(
      s.saveRoll(com[1].id, c1.id, body(31)),
      'validation',
      'session_in_future',
    );
  });

  it('acepta su token de refresco tras reiniciar la app (por la forma)', async () => {
    const before = server();
    const { refreshToken } = before.issueSession('coordination');
    // «Reiniciar»: un falso nuevo, sin memoria de aquel token.
    const after = server();
    const t = await after.refresh(refreshToken);
    expect(t.refreshToken).not.toBe(refreshToken);
    expect(t.refreshToken).toMatch(/-coordination$/);
    // Rota: el viejo, reutilizado, revoca la sesión.
    await expectError(after.refresh(refreshToken), 'unauthenticated');
    // Lo que no tiene su forma, o una persona que no existe, no vale.
    await expectError(after.refresh('fr-1-nadie'), 'unauthenticated');
    await expectError(after.refresh('cualquier-cosa'), 'unauthenticated');
    await expectError(after.refresh('fr-1-constructor'), 'unauthenticated');
  });

  it('las marcas anteriores salen de las sesiones previas, la última primero', async () => {
    const s = server();
    const c2 = s.data.groups.find((x) => x.code === 'C2')!;
    const next = s.data.sessions.find(
      (x) => x.date === '2026-10-24' && x.stage === 'com',
    )!;
    const roll = await s.getRoll(next.id, c2.id);
    const streaker = roll.entries.find(
      (e) => e.person.id === c2.participantIds[0],
    )!;
    expect(streaker.previousMarks).toEqual([
      'no_unjustified',
      'no_justified',
      'no_unjustified',
    ]);
  });

  it('enseña la reunión pendiente solo a coordinación', async () => {
    const s = server();
    expect((await s.getToday()).pendingMeeting).toBeNull();
    s.setControls({ persona: 'coordination' });
    expect((await s.getToday()).pendingMeeting).toMatchObject({
      name: 'Reunión de programación',
    });
  });

  it('reset vuelve a empezar', async () => {
    const s = server();
    s.setControls({ persona: 'coordination' });
    s.reset();
    expect(s.controls.persona).toBe('monitor');
    expect(s.writeCount).toBe(0);
  });
});

describe('Grupos y fichas en el servidor falso (plan 05)', () => {
  const D2_PERSON = (s: ReturnType<typeof server>) =>
    s.data.groups.find((g) => g.code === 'P1')!.participantIds[0];

  it('los datos tienen cada caso de pantalla', () => {
    const d = generateFakeData();
    const participants = [
      ...d.groups.flatMap((g) => g.participantIds),
      ...d.memberships.map((m) => m.personId),
    ];
    const profiles = participants.map((id) => d.profiles[id]);
    // ~15 % sin grupo.
    expect(d.memberships.length / participants.length).toBeGreaterThan(0.1);
    // Un chaval sin familia y una familia sin teléfonos.
    expect(profiles.some((p) => p.guardians.length === 0)).toBe(true);
    expect(
      profiles.some(
        (p) => p.guardians.length > 0 && p.guardians.every((g) => !g.phone),
      ),
    ).toBe(true);
    expect(profiles.some((p) => p.emergency)).toBe(true);
    // Dos del COM con móvil propio: uno con WhatsApp y otro sin contestar.
    const own = profiles.filter((p) => p.ownPhone);
    expect(own.map((p) => p.consents.whatsapp).sort()).toEqual([null, true]);
    // ~30 % sin contestar, salud en 1 de cada 5, una con «No» a la salud.
    const nulls = profiles.filter((p) => p.consents.outings === null).length;
    expect(nulls / profiles.length).toBeGreaterThan(0.15);
    const withHealth = participants.filter((id) => d.health[id]).length;
    expect(withHealth / participants.length).toBeGreaterThan(0.12);
    expect(profiles.some((p) => p.consents.healthData === false)).toBe(true);
    // Foto en la mitad, más o menos.
    const photos = profiles.filter((p) => p.photo).length / profiles.length;
    expect(photos).toBeGreaterThan(0.3);
    expect(photos).toBeLessThan(0.7);
    // Avisos con 2 y con 3.
    const counts = Object.values(d.notices).map((n) => n.length);
    expect(counts).toEqual(expect.arrayContaining([2, 3]));
  });

  it('las marcas salen de las autorizaciones con el «0» explícito', () => {
    const d = generateFakeData();
    for (const [id, prof] of Object.entries(d.profiles)) {
      const p = d.people.find((x) => x.id === id)!;
      expect(p.badges.notHomeAlone).toBe(prof.consents.goHomeAlone === false);
      expect(p.badges.noPhotos).toBe(prof.consents.photos === false);
      expect(p.badges.healthNote).toBe(
        !!d.health[id] && prof.consents.healthData !== false,
      );
    }
  });

  it('lo de otra delegación es 403: ficha, salud, datos, grupo y escrituras', async () => {
    const s = server();
    const other = D2_PERSON(s);
    await expectError(s.getPerson(other), 'forbidden');
    await expectError(s.getHealth(other), 'forbidden');
    await expectError(s.getPersonal(other), 'forbidden');
    await expectError(s.getPerson('f-per-no-existe'), 'forbidden');
    const p1 = s.data.groups.find((g) => g.code === 'P1')!;
    await expectError(s.getGroupDetail(p1.id), 'forbidden');
    await expectError(
      s.setScarf(other, { clientId: CLIENT(30), scarf: 'red' }),
      'forbidden',
    );
    // Un monitor no tiene ficha de participante.
    await expectError(
      s.getPerson(s.data.personas.monitor.personId),
      'forbidden',
    );
    // Las fotos salen solo en lo que se puede ver: la de otro no viaja.
    const people = await s.getPeople();
    expect(people.people.map((p) => p.id)).not.toContain(other);
  });

  it('vincular: solo coordinación, y la fila pasa a su grupo', async () => {
    const s = server();
    const people = await s.getPeople();
    const loose = people.people.find((p) => p.unassignedMembershipId)!;
    const c1 = s.data.groups.find((g) => g.code === 'C1')!;
    await expectError(
      s.assignGroup(loose.unassignedMembershipId!, {
        clientId: CLIENT(31),
        groupId: c1.id,
      }),
      'forbidden',
    );
    s.setControls({ persona: 'accompaniment' });
    await expectError(
      s.assignGroup(loose.unassignedMembershipId!, {
        clientId: CLIENT(32),
        groupId: c1.id,
      }),
      'forbidden',
    );
    s.setControls({ persona: 'coordination' });
    const p1 = s.data.groups.find((g) => g.code === 'P1')!;
    await expectError(
      s.assignGroup(loose.unassignedMembershipId!, {
        clientId: CLIENT(33),
        groupId: p1.id,
      }),
      'forbidden',
    );
    await s.assignGroup(loose.unassignedMembershipId!, {
      clientId: CLIENT(34),
      groupId: c1.id,
    });
    const after = await s.getPeople();
    expect(after.people.find((p) => p.id === loose.id)).toMatchObject({
      groupId: c1.id,
    });
    expect(
      after.people.find((p) => p.id === loose.id)!.unassignedMembershipId,
    ).toBeUndefined();
  });

  it('avisos: fecha futura → hoy, motivo vacío → validation, numerables', async () => {
    const s = server();
    const c1 = s.data.groups.find((g) => g.code === 'C1')!;
    const pid = c1.participantIds[0];
    await expectError(
      s.createNotice(pid, {
        clientId: CLIENT(40),
        date: '2026-10-24',
        reason: '   ',
        familyNotified: false,
      }),
      'validation',
      'empty_reason',
    );
    const res = await s.createNotice(pid, {
      clientId: CLIENT(41),
      date: '2026-12-25',
      reason: 'Llegó tarde y se fue pronto',
      familyNotified: true,
    });
    expect(res.notice.date).toBe('2026-10-24');
    const writes = s.writeCount;
    await s.createNotice(pid, {
      clientId: CLIENT(41),
      date: '2026-12-25',
      reason: 'Llegó tarde y se fue pronto',
      familyNotified: true,
    });
    expect(s.writeCount).toBe(writes);
    const profile = await s.getPerson(pid);
    expect(profile.notices.map((n) => n.reason)).toContain(
      'Llegó tarde y se fue pronto',
    );
  });

  it('pañuelo: se escribe y no se reescribe igual', async () => {
    const s = server();
    const pid = s.data.groups.find((g) => g.code === 'C2')!.participantIds[0];
    await s.setScarf(pid, { clientId: CLIENT(50), scarf: 'cross' });
    const w = s.writeCount;
    await s.setScarf(pid, { clientId: CLIENT(51), scarf: 'cross' });
    expect(s.writeCount).toBe(w);
    expect((await s.getPerson(pid)).scarf).toBe('cross');
  });

  it('salud: con «No» a los datos de salud la ficha enseña el texto; las listas, sin marca', async () => {
    const s = server();
    const [id] = Object.entries(s.data.profiles).find(
      ([pid, p]) => p.consents.healthData === false && s.data.health[pid],
    )!;
    // `salud-no` = «sí, en la ficha»: la ruta de la ficha devuelve el texto…
    const items = (await s.getHealth(id)).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.text.trim())).toBe(true);
    // …y la marca de las listas sigue apagada.
    const people = await s.getPeople();
    expect(people.people.find((p) => p.id === id)?.badges.healthNote).toBe(
      false,
    );
  });

  it('curso cerrado: nadie vigente, y el grupo sin número', async () => {
    const s = server({ seasonClosed: true });
    const people = await s.getPeople();
    expect(people).toMatchObject({ seasonClosed: true, people: [] });
    const groups = await s.getGroups();
    expect(groups.groups.every((g) => g.counts.participants === null)).toBe(
      true,
    );
  });

  it('la foto del falso es una imagen inventada, no una URL de red', () => {
    const s = server();
    const src = s.photoSource(
      'https://fotos.ejemplo.org/v1/people/x/photo?v=1',
    );
    expect(src.uri.startsWith('data:image/svg+xml')).toBe(true);
  });
});
