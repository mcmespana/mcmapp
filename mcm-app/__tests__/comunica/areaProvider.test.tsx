/**
 * Guardarraíles del plan 01 §7 con el CABLEADO REAL: el proveedor del área,
 * los hooks de verdad y el servidor falso.
 *
 *   · Ninguna consulta de salud ni de datos personales llega al almacén del
 *     móvil (lo que de verdad queda escrito, no un `QueryClient` de mentira).
 *   · Salir borra consultas, cola y sesión, y nada de esa persona vuelve a
 *     escribirse ni a subirse después (ni el reintento programado de la cola
 *     ni el guardado de la caché).
 */
import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import ComunicaAreaProvider, {
  useArea,
} from '@/components/comunica/comun/ComunicaAreaProvider';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { Outbox } from '@/services/comunica/outbox';
import { dehydrateArea } from '@/services/comunica/persist';
import {
  __resetSessionForTests,
  signIn,
  signOut,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import {
  GRUPOS_KEYS,
  useHealth,
  usePeople,
  usePersonal,
} from '@/hooks/comunica/useGrupos';

jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
    prefetch: jest.fn().mockResolvedValue(true),
  },
}));

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

const probe: { outbox: Outbox | null } = { outbox: null };
const seeOutbox = (o: Outbox | null) => {
  probe.outbox = o;
};

function Reader({ pid }: { pid: string }) {
  usePeople();
  useHealth(pid, true);
  usePersonal(pid, true);
  const { outbox } = useArea();
  useEffect(() => seeOutbox(outbox), [outbox]);
  return null;
}

async function setup() {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  const be = memoryBackend();
  setStorageBackend(be);
  const api = getComunicaApi();
  const fake = getFakeServer()!;
  fake.setControls({ latencyMs: 0 });
  const t = fake.issueSession('coordination');
  await signIn(t, t.me);
  // Alguien con salud de verdad (texto) y datos personales.
  const people = await api.getPeople();
  let pid = '';
  let healthTexts: string[] = [];
  for (const p of people.people) {
    const h = await api.getHealth(p.id).catch(() => null);
    if (h && h.items.length > 0) {
      pid = p.id;
      healthTexts = h.items.map((i) => i.text);
      break;
    }
  }
  expect(pid).not.toBe('');
  const personal = await api.getPersonal(pid);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = create(
      <ComunicaAreaProvider client={qc}>
        <Reader pid={pid} />
      </ComunicaAreaProvider>,
    );
  });
  // Llegan las tres lecturas y pasa el guardado (1 s de espera).
  for (let i = 0; i < 40; i++) {
    if (qc.getQueryData(areaKey(GRUPOS_KEYS.health(pid)))) break;
    await wait(25);
  }
  await wait(1_200);
  return {
    be,
    api,
    fake,
    qc,
    tree: tree!,
    me: t.me,
    pid,
    healthTexts,
    personal,
  };
}

afterEach(() => {
  __resetComunicaApiForTests();
  __resetSessionForTests();
});

describe('el proveedor del área, de verdad', () => {
  it('la salud y los datos personales nunca llegan al almacén', async () => {
    const { be, qc, tree, me, pid, healthTexts, personal } = await setup();
    expect(qc.getQueryData(areaKey(GRUPOS_KEYS.health(pid)))).toBeTruthy();
    expect(qc.getQueryData(areaKey(GRUPOS_KEYS.personal(pid)))).toBeTruthy();

    const saved = be.dump()[`@comunica/${me.personId}/queries`];
    expect(saved).toBeTruthy();
    expect(saved).toContain(`"${pid}"`); // `people` sí se guarda
    for (const text of healthTexts) expect(saved).not.toContain(text);
    for (const v of [
      personal.address,
      personal.email,
      personal.document?.number,
    ]) {
      if (v) expect(saved).not.toContain(v);
    }
    // Y las dos capas por separado: los hooks marcan `persist: false`…
    const meta = (k: readonly unknown[]) =>
      qc.getQueryCache().find({ queryKey: areaKey(k as string[]) })?.meta;
    expect(meta(GRUPOS_KEYS.health(pid))?.persist).toBe(false);
    expect(meta(GRUPOS_KEYS.personal(pid))?.persist).toBe(false);
    expect(meta(GRUPOS_KEYS.people)?.persist).toBe(true);
    // …y lo que se guarda descarta la salud aunque venga mal marcada.
    const health = qc.getQueryCache().find({
      queryKey: areaKey(GRUPOS_KEYS.health(pid)),
    })!;
    // `meta` es un getter de `options.meta`: se marca mal a propósito ahí.
    health.options.meta = { persist: true };
    expect(health.meta?.persist).toBe(true);
    expect(JSON.stringify(dehydrateArea(qc))).not.toContain(healthTexts[0]);

    act(() => tree.unmount());
    qc.clear();
  });

  it('salir borra consultas, cola y sesión, y nada de esa persona vuelve', async () => {
    const { be, api, fake, qc, tree, me } = await setup();
    const outbox = probe.outbox!;
    expect(outbox).toBeTruthy();
    // Una lista que no puede subir (CRM caído): queda con un reintento
    // programado a los 2 s.
    const saveRoll = jest.spyOn(api, 'saveRoll');
    fake.setControls({ crmDown: true });
    await act(async () => {
      await outbox.enqueue({
        key: 'roll:s:g',
        kind: 'roll',
        payload: { action: 'skip', marks: {}, notes: {} },
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        meta: { sessionId: 's', groupId: 'g' },
      });
    });
    await wait(50);
    expect(outbox.get('roll:s:g')?.status).toBe('failed');
    expect(be.dump()[`@comunica/${me.personId}/outbox`]).toBeTruthy();
    const sent = saveRoll.mock.calls.length;

    await act(async () => {
      await signOut();
    });
    expect(outbox.disposed).toBe(true);
    expect(probe.outbox).toBeNull();
    // Pasa el reintento programado y el guardado de la caché.
    fake.setControls({ crmDown: false });
    await wait(2_500);
    expect(saveRoll.mock.calls.length).toBe(sent);
    expect(be.dump()).toEqual({});
    expect(await AsyncStorage.getItem('@comunica/session-person')).toBeNull();
    expect(await AsyncStorage.getItem('@comunica/refresh')).toBeNull();

    act(() => tree.unmount());
    qc.clear();
  }, 15_000);
});
