/**
 * Gestor de un evento (plan 18): el servidor falso cumple lo que promete el
 * de verdad (`comunicaMiddleware:src/app/managed-events.ts`): la barrera del
 * nombramiento, el check-in y las notas sin tocar lo demás, el `since` y la
 * forma de cada respuesta.
 */
import { createFakeServer } from '@/services/comunica/fake';
import {
  MANAGED_NEXT,
  MANAGED_NOW,
  MANAGED_OTHER,
  MANAGED_PAST,
} from '@/services/comunica/fake/managedEvents';
import { ROUTES } from '@/services/comunica/contract';

const NOW = '2026-11-26T10:00:00Z';
const server = (patch = {}) =>
  createFakeServer({
    latencyMs: 0,
    clock: NOW,
    persona: 'coordination',
    ...patch,
  });

describe('quién gestiona', () => {
  it('`managesEvents` en `Me`, también para quien no es del equipo', async () => {
    expect((await server().getMe()).me.managesEvents).toBe(true);
    const member = await server({ persona: 'memberNoKids' }).getMe();
    expect(member.me.managesEvents).toBe(true);
    expect(member.me.roles).not.toContain('monitor');
    const monitor = await server({ persona: 'monitor' }).getMe();
    expect(monitor.me.managesEvents).toBeUndefined();
  });

  it('la lista: los suyos, sin los acabados hace más de 30 días', async () => {
    const r = await server().getManagedEvents();
    expect(r.events.map((e) => e.id)).toEqual([
      MANAGED_PAST,
      MANAGED_NOW,
      MANAGED_NEXT,
    ]);
    const now = r.events.find((e) => e.id === MANAGED_NOW)!;
    expect(now.registered).toBeGreaterThan(30);
    expect(now.arrived).toBeGreaterThan(0);
    expect(
      (await server({ persona: 'memberNoKids' }).getManagedEvents()).events,
    ).toHaveLength(1);
    expect(
      (await server({ persona: 'monitor' }).getManagedEvents()).events,
    ).toEqual([]);
  });

  it('fuera del nombramiento, 403 exista o no', async () => {
    const s = server({ persona: 'memberNoKids' });
    for (const id of [MANAGED_NEXT, MANAGED_OTHER, 'no-existe']) {
      await expect(s.getManagedEvent(id)).rejects.toMatchObject({
        code: 'forbidden',
        reason: 'event_out_of_scope',
      });
    }
  });
});

describe('el evento y su check-in', () => {
  it('trae a todos (varias delegaciones), las canceladas al final, habitaciones y notas', async () => {
    const d = await server().getManagedEvent(MANAGED_NOW);
    const delegations = new Set(
      d.registrations.map((r) => r.delegation?.name ?? null),
    );
    expect(delegations.size).toBeGreaterThanOrEqual(4);
    const firstOut = d.registrations.findIndex((r) => r.registrationStatus);
    expect(firstOut).toBeGreaterThan(0);
    expect(
      d.registrations.slice(firstOut).every((r) => r.registrationStatus),
    ).toBe(true);
    expect(d.rooms.length).toBeGreaterThan(5);
    expect(d.checkins.some((c) => c.note)).toBe(true);
    expect(d.checkins.some((c) => c.absent)).toBe(true);
    expect(new Set(d.rooms.map((r) => r.venue)).size).toBe(2);
    expect(ROUTES.managedEvent.response.safeParse(d).success).toBe(true);
  });

  it('marcar no toca la nota ni la habitación, y al revés', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const withNote = d.checkins.find((c) => c.note && c.roomId)!;
    const r = await s.checkinManaged(MANAGED_NOW, {
      registrationIds: [withNote.registrationId],
      to: 'in',
      at: '2026-11-26T09:30:00Z',
    });
    expect(r.checkins[0]).toMatchObject({
      registrationId: withNote.registrationId,
      arrivedAt: '2026-11-26T09:30:00Z',
      arrivedBy: expect.stringMatching(/\(app\)$/),
      note: withNote.note,
      roomId: withNote.roomId,
    });
    const n = await s.noteManaged(MANAGED_NOW, {
      registrationId: withNote.registrationId,
      note: '   Se   va pronto  ',
    });
    expect(n.checkins[0]).toMatchObject({
      note: 'Se va pronto',
      arrivedAt: '2026-11-26T09:30:00Z',
      roomId: withNote.roomId,
    });
    const back = await s.checkinManaged(MANAGED_NOW, {
      registrationIds: [withNote.registrationId],
      to: 'pending',
    });
    expect(back.checkins[0].arrivedAt).toBeUndefined();
    expect(back.checkins[0].note).toBe('Se va pronto');
    const empty = await s.noteManaged(MANAGED_NOW, {
      registrationId: withNote.registrationId,
      note: '',
    });
    expect(empty.checkins[0].note).toBeUndefined();
  });

  it('una hora de hace más de 48 h no vale: se pone la de ahora', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const id = d.registrations[0].registrationId;
    const r = await s.checkinManaged(MANAGED_NOW, {
      registrationIds: [id],
      to: 'in',
      at: '2026-11-20T09:00:00Z',
    });
    expect(r.checkins[0].arrivedAt).toBe(NOW);
  });

  it('una inscripción de otro evento: 403 y no se escribe nada', async () => {
    const s = server();
    const other = await s.getManagedEvent(MANAGED_PAST);
    await expect(
      s.checkinManaged(MANAGED_NOW, {
        registrationIds: [other.registrations[0].registrationId],
        to: 'in',
      }),
    ).rejects.toMatchObject({ reason: 'registration_out_of_scope' });
  });

  it('`since`: lo cambiado (con margen) y el siguiente cursor', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const quiet = await s.getManagedCheckins(MANAGED_NOW, NOW);
    expect(quiet.checkins).toEqual([]);
    const id = d.registrations.find(
      (r) => !d.checkins.some((c) => c.registrationId === r.registrationId),
    )!.registrationId;
    s.setControls({ clock: '2026-11-26T10:01:00Z' });
    await s.checkinManaged(MANAGED_NOW, { registrationIds: [id], to: 'in' });
    const r = await s.getManagedCheckins(MANAGED_NOW, NOW);
    expect(r.checkins.map((c) => c.registrationId)).toEqual([id]);
    expect(r.since).toBe('2026-11-26T10:01:00Z');
  });

  it('con «otros marcan», cada sondeo trae una llegada nueva', async () => {
    const s = server({ othersCheckIn: true });
    const d = await s.getManagedEvent(MANAGED_NOW);
    const r = await s.getManagedCheckins(MANAGED_NOW, d.since);
    expect(
      r.checkins.some((c) => c.arrivedBy === 'secretaria@ejemplo.org'),
    ).toBe(true);
  });
});

describe('la ficha y la salud', () => {
  it('la ficha de un inscrito, con su inscripción y familia', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const kid = d.registrations.find((r) => r.role === 'participant')!;
    const p = await s.getManagedPerson(MANAGED_NOW, kid.personId);
    expect(p.registrationId).toBe(kid.registrationId);
    expect(p.guardians.length).toBeGreaterThan(0);
    expect(ROUTES.managedPerson.response.safeParse(p).success).toBe(true);
    const h = await s.getManagedHealth(MANAGED_NOW, kid.personId);
    expect(h.personId).toBe(kid.personId);
  });

  it('una persona que no es del evento: 403', async () => {
    const s = server();
    await expect(
      s.getManagedPerson(MANAGED_NOW, 'f-per-01'),
    ).rejects.toMatchObject({ reason: 'person_out_of_scope' });
    await expect(
      s.getManagedHealth(MANAGED_NOW, 'f-per-01'),
    ).rejects.toMatchObject({ reason: 'person_out_of_scope' });
  });

  it('la salud nunca se guarda; el evento y la lista sí', () => {
    expect(ROUTES.managedHealth.persist).toBe(false);
    expect(ROUTES.managedCheckins.persist).toBe(false);
    expect(ROUTES.managedEvent.persist).toBe(true);
    expect(ROUTES.managedEvents.persist).toBe(true);
  });
});

describe('habitaciones, datos de monitor y datos personales', () => {
  it('el detalle trae lo puesto a mano en las habitaciones (de dos casas)', async () => {
    const d = await server().getManagedEvent(MANAGED_NOW);
    expect(d.roomExtras.map((x) => x.kind).sort()).toEqual([
      'hold',
      'person',
      'person',
    ]);
    const roomIds = new Set(d.rooms.map((r) => r.id));
    expect(d.roomExtras.every((x) => roomIds.has(x.roomId))).toBe(true);
    expect((await server().getManagedEvent(MANAGED_NEXT)).roomExtras).toEqual(
      [],
    );
  });

  it('cambiar de habitación: sin tocar la llegada ni la nota; `null` la quita', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const withNote = d.checkins.find((c) => c.note)!;
    const r = await s.setManagedRoom(MANAGED_NOW, {
      registrationIds: [withNote.registrationId],
      roomId: 'f-ge-hab-casa-C',
    });
    expect(r.checkins[0]).toMatchObject({
      registrationId: withNote.registrationId,
      roomId: 'f-ge-hab-casa-C',
      note: withNote.note,
    });
    expect(Date.parse(r.checkins[0].updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(withNote.updatedAt),
    );
    const off = await s.setManagedRoom(MANAGED_NOW, {
      registrationIds: [withNote.registrationId],
      roomId: null,
    });
    expect(off.checkins[0].roomId).toBeUndefined();
    expect(off.checkins[0].note).toBe(withNote.note);
    // Lo ve el sondeo.
    const polled = await s.getManagedCheckins(MANAGED_NOW, d.since);
    expect(
      polled.checkins.find((c) => c.registrationId === withNote.registrationId)
        ?.roomId,
    ).toBeUndefined();
  });

  it('una habitación que no es del evento: 422; una inscripción ajena: 403', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const id = d.registrations[0].registrationId;
    await expect(
      s.setManagedRoom(MANAGED_NOW, { registrationIds: [id], roomId: 'otra' }),
    ).rejects.toMatchObject({
      code: 'validation',
      reason: 'room_not_in_event',
    });
    await expect(
      s.setManagedRoom(MANAGED_NOW, {
        registrationIds: ['f-ge-ins-pas-01'],
        roomId: null,
      }),
    ).rejects.toMatchObject({ reason: 'registration_out_of_scope' });
    expect(ROUTES.managedRoom.persist).toBe(false);
  });

  it('la ficha de un monitor trae sus datos de monitor; la de un chaval, `null`', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const mon = d.registrations.find((r) => r.role === 'monitor')!;
    const kid = d.registrations.find((r) => r.role === 'participant')!;
    const pm = await s.getManagedPerson(MANAGED_NOW, mon.personId);
    expect(pm.monitor?.options.congresses.length).toBeGreaterThan(0);
    expect(pm.monitor?.files).toBeDefined();
    expect((await s.getManagedPerson(MANAGED_NOW, kid.personId)).monitor).toBe(
      null,
    );
  });

  it('los datos personales: con documento, solo del evento y nunca guardados', async () => {
    const s = server();
    const d = await s.getManagedEvent(MANAGED_NOW);
    const kid = d.registrations.find((r) => r.role === 'participant')!;
    const p = await s.getManagedPersonal(MANAGED_NOW, kid.personId);
    expect(p.personId).toBe(kid.personId);
    expect(p.document?.number).toMatch(/^\d{8}[A-Z]$/);
    expect(ROUTES.managedPersonal.persist).toBe(false);
    await expect(
      s.getManagedPersonal(MANAGED_NOW, 'f-per-01'),
    ).rejects.toMatchObject({ reason: 'person_out_of_scope' });
    await expect(
      server({ persona: 'monitor' }).getManagedPersonal(
        MANAGED_NOW,
        kid.personId,
      ),
    ).rejects.toMatchObject({ reason: 'event_out_of_scope' });
  });
});
