import {
  GroupsResponse,
  HealthNote,
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
    expect(textFields(HealthNote)).toContain('text');
    expect(ROUTES.health.persist).toBe(false);
  });
});
