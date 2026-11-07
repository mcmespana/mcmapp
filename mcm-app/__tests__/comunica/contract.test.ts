import {
  GroupDetail,
  GroupsResponse,
  HealthNote,
  NoticeWrite,
  ParticipantProfile,
  PeopleIndex,
  PersonalData,
  ScarfWrite,
  Me,
  Mark,
  PersonSummary,
  RollCallSummary,
  RollWrite,
  ROUTES,
  WriteResult,
} from '@/services/comunica/contract';
import { z } from 'zod';

const person = {
  id: 'f-per-01',
  firstName: 'Lucía',
  lastName: 'Arenas Bosque',
  badges: { healthNote: true, noPhotos: false, notHomeAlone: false },
};

describe('services/comunica/contract', () => {
  it('admite un ejemplo válido de cada tipo compartido', () => {
    expect(PersonSummary.parse(person)).toEqual(person);
    expect(
      Me.parse({
        personId: 'f-per-01',
        name: 'Lucía',
        delegation: { id: 'f-del', name: 'Villaclara' },
        roles: ['monitor'],
        scope: 'delegation',
        canSeeHealth: true,
      }),
    ).toBeTruthy();
    expect(Mark.parse(null)).toBeNull();
    expect(
      RollCallSummary.parse({
        sessionId: 's',
        status: 'skipped',
        takenAt: '2026-10-24T18:00:00+02:00',
        counts: { came: 0, missed: 0 },
      }),
    ).toBeTruthy();
    expect(
      WriteResult.parse({
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        status: 'queued',
      }),
    ).toBeTruthy();
  });

  it('rechaza lo que no es del contrato', () => {
    expect(PersonSummary.safeParse({ ...person, badges: {} }).success).toBe(
      false,
    );
    expect(Mark.safeParse('absent').success).toBe(false);
    // Una fecha sin zona es la trampa del CRM: no entra.
    expect(
      RollCallSummary.safeParse({
        sessionId: 's',
        status: 'taken',
        takenAt: '2026-10-24 18:00:00',
        counts: { came: 1, missed: 0 },
      }).success,
    ).toBe(false);
    expect(
      RollWrite.safeParse({
        clientId: 'no-es-uuid',
        action: 'save',
        marks: {},
        notes: {},
      }).success,
    ).toBe(false);
    expect(
      RollWrite.safeParse({
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        action: 'save',
        marks: { a: 'yes' },
        notes: { a: 'x'.repeat(256) },
      }).success,
    ).toBe(false);
    expect(GroupsResponse.safeParse({ generatedAt: 'ayer' }).success).toBe(
      false,
    );
    expect(
      RollWrite.safeParse({
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        action: 'save',
        marks: { a: 'absent' },
        notes: {},
      }).success,
    ).toBe(false);
  });

  it('desmarcar: el PUT admite `null` para quitar una marca guardada', () => {
    expect(
      RollWrite.parse({
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        action: 'save',
        marks: { a: 'yes', b: null },
        notes: { a: '' },
      }).marks,
    ).toEqual({ a: 'yes', b: null });
  });

  it('la foto solo por https (lleva el token de acceso)', () => {
    const ok = { ...person, photoUrl: 'https://fotos.ejemplo.org/p/1' };
    expect(PersonSummary.safeParse(ok).success).toBe(true);
    for (const photoUrl of [
      'http://fotos.ejemplo.org/p/1',
      'ftp://fotos.ejemplo.org/p/1',
      'javascript:alert(1)',
    ]) {
      expect(PersonSummary.safeParse({ ...person, photoUrl }).success).toBe(
        false,
      );
    }
  });

  // Guardarraíl (plan 00 §6): la salud solo viaja en `/people/:id/health`.
  it('ningún esquema que se guarda lleva texto de salud', () => {
    const textFields = (schema: z.ZodType, path: string[] = []): string[] => {
      const def = (schema as unknown as { def: { type: string } }).def;
      const s = schema as unknown as Record<string, unknown>;
      switch (def.type) {
        case 'object':
          return Object.entries(
            (s as { shape: Record<string, z.ZodType> }).shape,
          ).flatMap(([k, v]) => textFields(v, [...path, k]));
        case 'array':
          return textFields((s as { element: z.ZodType }).element, path);
        case 'nullable':
        case 'optional':
          return textFields((s as { unwrap: () => z.ZodType }).unwrap(), path);
        case 'union':
          return (s as { options: z.ZodType[] }).options.flatMap((o) =>
            textFields(o, path),
          );
        case 'record':
          return textFields(
            (def as unknown as { valueType: z.ZodType }).valueType,
            path,
          );
        case 'string':
          return [path.join('.')];
        default:
          return [];
      }
    };
    for (const [name, route] of Object.entries(ROUTES)) {
      const health = textFields(route.response).filter((f) =>
        /health|salud|medic|alerg/i.test(f),
      );
      if (route.persist) expect({ name, health }).toEqual({ name, health: [] });
    }
    expect(textFields(HealthNote)).toContain('items.text');
    expect(ROUTES.health.persist).toBe(false);
  });
});

describe('contrato de Grupos y fichas (plan 05)', () => {
  const T = '2026-10-24T10:00:00+02:00';
  const row = {
    ...person,
    schoolLevel: { key: 'eso1', label: '1 ESO' },
    age: 12,
    groupId: null,
    unassignedMembershipId: 'f-rel-01',
  };
  const group = {
    id: 'g',
    code: 'C1',
    name: 'Brújula',
    stage: 'com',
    schoolLevels: ['1º ESO'],
    counts: { participants: null, monitors: 2 },
  };
  const profile = {
    generatedAt: T,
    person: {
      id: 'p',
      firstName: 'Lucía',
      lastName: 'Arenas',
      fullName: 'Lucía Arenas',
      schoolLevel: { key: null, label: 'Curso puente' },
    },
    group: null,
    phones: { own: '622 14 87 03' },
    guardians: [{ id: 'f', fullName: 'Marta Arenas', relationship: 'Madre' }],
    consents: {
      goHomeAlone: false,
      photos: null,
      whatsapp: null,
      healthData: true,
      outings: true,
      participation: true,
      dataProtection: null,
    },
    badges: person.badges,
    scarf: 'unknown',
    events: [
      {
        eventId: 'e',
        name: 'Salida',
        startsAt: T,
        endsAt: T,
        status: 'no_roll',
      },
    ],
    notices: [
      { id: 'n', date: '2026-10-17', reason: 'x', familyNotified: false },
    ],
    noticeLimit: 3,
    attendance: null,
  };

  it('admite cada forma', () => {
    expect(
      PeopleIndex.parse({
        generatedAt: T,
        season: '2026-2027',
        seasonClosed: false,
        people: [row],
      }).people[0].groupId,
    ).toBeNull();
    expect(
      GroupDetail.parse({
        generatedAt: T,
        group,
        monitors: [{ id: 'm', firstName: 'A', lastName: 'B' }],
        participants: [{ ...row, groupId: 'g' }],
      }).group.counts.participants,
    ).toBeNull();
    expect(ParticipantProfile.parse(profile).scarf).toBe('unknown');
    expect(
      PersonalData.parse({ generatedAt: T, personId: 'p', city: 'Villaclara' }),
    ).toBeTruthy();
  });

  it('rechaza lo que no es del contrato', () => {
    expect(
      ParticipantProfile.safeParse({ ...profile, scarf: 'morado' }).success,
    ).toBe(false);
    expect(
      ScarfWrite.safeParse({
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        scarf: 'unknown',
      }).success,
    ).toBe(false);
    expect(
      NoticeWrite.safeParse({
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        date: '17/10/2026',
        reason: 'x',
        familyNotified: true,
      }).success,
    ).toBe(false);
  });

  it('la ficha no se queda con un texto de salud que le cuelen', () => {
    const parsed = ParticipantProfile.parse({
      ...profile,
      health: 'Alergia a los frutos secos',
      person: { ...profile.person, allergies: 'Frutos secos' },
    });
    expect(JSON.stringify(parsed)).not.toMatch(/frutos secos/i);
  });

  it('las rutas nuevas están en el catálogo con su persist', () => {
    expect(ROUTES.people.persist).toBe(true);
    expect(ROUTES.group.persist).toBe(true);
    expect(ROUTES.person.persist).toBe(true);
    expect(ROUTES.personal.persist).toBe(false);
    expect(ROUTES.health.persist).toBe(false);
  });
});
