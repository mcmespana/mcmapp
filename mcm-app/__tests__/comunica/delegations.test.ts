/**
 * Varias delegaciones (plan 17): la delegación de trabajo en el falso, en la
 * cabecera del cliente, en las claves de la caché y en la cola.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { createHttpClient } from '@/services/comunica/client';
import {
  DELEGATION_HEADER,
  delegationForRequest,
  getWorkingDelegation,
  setWorkingDelegation,
} from '@/services/comunica/delegation';
import { createOutbox } from '@/services/comunica/outbox';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { areaKey } from '@/hooks/comunica/useAreaQuery';

const D1 = 'f-del-villaclara';
const D2 = 'f-del-puertoalto';

beforeEach(() => {
  setStorageBackend(memoryBackend());
  setWorkingDelegation(null);
});

describe('el falso con una persona de dos delegaciones', () => {
  const fake = (wanted: () => string | null) =>
    createFakeServer(
      { latencyMs: 0, persona: 'twoDelegations' },
      { getDelegation: () => wanted() },
    );

  it('en la de su ficha es monitor sin grupo; en la otra, coordina y lleva P1', async () => {
    let d: string | null = null;
    const s = fake(() => d);
    const home = await s.getMe();
    expect(home.me.delegation.id).toBe(D1);
    expect(home.me.teamDelegations?.map((x) => x.id)).toEqual([D1, D2]);
    expect(home.me.roles).toEqual(['monitor']);
    expect((await s.getGroups()).myGroupIds).toEqual([]);

    d = D2;
    const there = await s.getMe();
    // La de la ficha no cambia: manda en lo personal.
    expect(there.me.delegation.id).toBe(D1);
    expect(there.me.roles).toContain('coordination');
    const groups = await s.getGroups();
    expect(groups.groups.map((g) => g.code)).toEqual(['P1']);
    expect(groups.myGroupIds).toHaveLength(1);
    // Y la coordinación de Puerto Alto no vale en Villaclara.
    await expect(s.getCoordination()).resolves.toBeTruthy();
    d = null;
    await expect(s.getCoordination()).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('una delegación que no es suya: 403 wrong_delegation', async () => {
    const s = createFakeServer(
      { latencyMs: 0, persona: 'monitor' },
      { getDelegation: () => D2 },
    );
    await expect(s.getGroups()).rejects.toMatchObject({
      code: 'forbidden',
      reason: 'wrong_delegation',
    });
  });

  it('la ficha de un grupo de otra de sus delegaciones dice de cuál es', async () => {
    const s = fake(() => null);
    const p1 = s.data.groups.find((g) => g.code === 'P1')!;
    const detail = await s.getGroupDetail(p1.id);
    expect(detail.delegationId).toBe(D2);
  });
});

describe('la cabecera', () => {
  it('va en lo de equipo y no en lo personal', async () => {
    const seen: Record<string, string | undefined> = {};
    const c = createHttpClient({
      baseUrl: 'https://api.ejemplo.org',
      fetchImpl: async (url, init) => {
        const h = (init?.headers ?? {}) as Record<string, string>;
        seen[String(url)] = h[DELEGATION_HEADER];
        return new Response('{}', { status: 500 });
      },
    });
    setWorkingDelegation(D2);
    await c.getGroups().catch(() => undefined);
    await c.getMyMonitorProfile().catch(() => undefined);
    expect(seen['https://api.ejemplo.org/v1/groups']).toBe(D2);
    expect(
      Object.entries(seen).find(([u]) => u.includes('/v1/me/monitor'))?.[1],
    ).toBeUndefined();
    setWorkingDelegation(null);
    await c.getGroups().catch(() => undefined);
    expect(seen['https://api.ejemplo.org/v1/groups']).toBeUndefined();
  });
});

describe('la caché', () => {
  it('lo de equipo lleva la delegación si no es la de la ficha; lo personal, no', () => {
    expect(areaKey(['pasar-lista', 'groups'])).toEqual([
      'comunica',
      'pasar-lista',
      'groups',
    ]);
    setWorkingDelegation(D2);
    expect(areaKey(['pasar-lista', 'groups'])).toEqual([
      'comunica',
      `d:${D2}`,
      'pasar-lista',
      'groups',
    ]);
    expect(areaKey(['yo', 'monitor'])).toEqual(['comunica', 'yo', 'monitor']);
  });
});

describe('la cola', () => {
  it('una escritura sube con su delegación aunque luego se cambie el selector', async () => {
    const used: (string | null)[] = [];
    const reads: (string | null)[] = [];
    const outbox = createOutbox({
      personId: 'p',
      handlers: {
        roll: async () => {
          used.push(delegationForRequest(true));
          // Una lectura a la vez: va con la de trabajo, no con la de la cola.
          reads.push(delegationForRequest(false));
          return {};
        },
      },
      schedule: () => undefined,
    });
    await outbox.load();
    setWorkingDelegation(D2);
    await outbox.enqueue({
      key: 'roll:a',
      kind: 'roll',
      payload: {},
      clientId: '6a1f3c20-7d4e-4b8a-9c2d-000000000171',
    });
    setWorkingDelegation(null);
    await outbox.enqueue({
      key: 'roll:b',
      kind: 'roll',
      payload: {},
      clientId: '6a1f3c20-7d4e-4b8a-9c2d-000000000172',
    });
    await outbox.flush();
    expect(used).toEqual([D2, null]);
    expect(reads).toEqual([null, null]);
    expect(getWorkingDelegation()).toBeNull();
    outbox.dispose();
  });
});

describe('guardarraíl: la clave de una consulta en el cuerpo de un componente', () => {
  it('no se calcula con `areaKey` (el compilador la memoriza y no cambia de delegación)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const root = path.join(__dirname, '..', '..', 'components', 'comunica');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (f.endsWith('.tsx')) files.push(f);
      }
    };
    walk(root);
    // `const x = areaKey(` al nivel del cuerpo (dos espacios de sangría).
    const offenders = files.filter((f) =>
      /^ {2}const \w+ = areaKey\(/m.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
