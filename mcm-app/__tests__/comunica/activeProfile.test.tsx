/**
 * «A quién se ve» con el CABLEADO REAL (plan 11, tarea 4): el proveedor del área, los hooks de verdad y el servidor falso.
 *
 *   · Solo familiar con varios hijos: hay que elegir; con uno, entra elegido; miembro o monitora, ella misma.
 *   · Elegir a un hijo cambia la persona y la audiencia, y se RECUERDA por persona (un id y un booleano, nada de nombres).
 *   · Un id que no es de la lista no hace nada.
 *   · Si el hijo recordado ya no viene en la lista, se vuelve a aplicar la tabla.
 *   · Si el CRM no contesta a los hijos, no hay nada «listo» (nunca una lista vacía inventada).
 *   · Salir borra lo recordado.
 */
import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient } from '@tanstack/react-query';
import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import {
  ActiveProfileProvider,
  useActiveProfile,
  type ActiveProfile,
} from '@/hooks/comunica/useActiveProfile';
import { __resetComunicaApiForTests, getFakeServer } from '@/services/comunica';
import {
  __resetSessionForTests,
  signIn,
  signOut,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import type { PersonaId } from '@/services/comunica/fake/fixtures';

jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
    prefetch: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

const probe: { current: ActiveProfile | null } = { current: null };
/** Los árboles montados: se desmontan al acabar cada test (si no, quedan temporizadores abiertos). */
const trees: ReactTestRenderer[] = [];
const clients: QueryClient[] = [];
function Probe() {
  const v = useActiveProfile();
  useEffect(() => {
    probe.current = v;
  });
  return null;
}

async function setup(
  persona: PersonaId,
  controls: Record<string, unknown> = {},
  be = memoryBackend(),
) {
  __resetSessionControlsForSetup();
  setStorageBackend(be);
  const fake = getFakeServer()!;
  fake.setControls({ latencyMs: 0, ...controls });
  const t = fake.issueSession(persona);
  await signIn(t, t.me);
  return { be, fake, me: t.me, ...(await mount()) };
}
function __resetSessionControlsForSetup() {
  __resetSessionForTests();
  __resetComunicaApiForTests();
}
async function mount() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = create(
      <ComunicaAreaProvider client={qc}>
        <ActiveProfileProvider>
          <Probe />
        </ActiveProfileProvider>
      </ComunicaAreaProvider>,
    );
  });
  trees.push(tree!);
  clients.push(qc);
  for (let i = 0; i < 40 && !probe.current?.ready; i++) await wait(25);
  return { qc, tree: tree! };
}

afterEach(async () => {
  await act(async () => {
    for (const tree of trees.splice(0)) {
      try {
        tree.unmount();
      } catch {
        /* ya desmontado en el test */
      }
    }
  });
  // Los reintentos de una consulta que falló (el CRM caído) dejarían temporizadores abiertos.
  for (const qc of clients.splice(0)) qc.clear();
  probe.current = null;
  __resetComunicaApiForTests();
  __resetSessionForTests();
});

describe('a quién se ve al abrir', () => {
  it('solo familiar con dos hijos: hay que elegir, y mientras tanto se ve a sí misma', async () => {
    const { me } = await setup('family');
    expect(probe.current).toMatchObject({
      ready: true,
      mustPick: true,
      chosen: false,
      isSelf: true,
      audience: 'guardian',
    });
    expect(probe.current!.active!.id).toBe(me.personId);
    expect(probe.current!.profiles!.children).toHaveLength(2);
  });

  it('solo familiar con un hijo: entra viendo a ese hijo, elegido solo', async () => {
    await setup('familyOne');
    expect(probe.current).toMatchObject({
      ready: true,
      mustPick: false,
      chosen: true,
      isSelf: false,
      audience: 'child',
    });
    expect(probe.current!.active).toMatchObject({
      id: 'f-hijo-nico',
      firstName: 'Nicolás',
    });
  });

  it('monitora con una hija, miembro sin hijos y familiar sin hijos: ellas mismas, sin preguntar', async () => {
    for (const persona of [
      'monitorMom',
      'memberNoKids',
      'familyNone',
      'monitor',
    ] as const) {
      probe.current = null;
      await setup(persona);
      expect(probe.current).toMatchObject({
        ready: true,
        mustPick: false,
        isSelf: true,
      });
      expect(probe.current!.audience).toBe(
        persona === 'familyNone' ? 'member' : 'member',
      );
      expect(probe.current!.profiles!.children.length).toBe(
        persona === 'monitorMom' ? 1 : 0,
      );
    }
  });
});

describe('elegir', () => {
  it('elegir a un hijo cambia la persona y la audiencia, y cuenta como elegido', async () => {
    await setup('family');
    await act(async () => probe.current!.setActive('f-hijo-lucia'));
    expect(probe.current).toMatchObject({
      mustPick: false,
      chosen: true,
      isSelf: false,
      audience: 'child',
    });
    expect(probe.current!.active).toMatchObject({
      id: 'f-hijo-lucia',
      firstName: 'Lucía',
    });
    await act(async () =>
      probe.current!.setActive(probe.current!.profiles!.self.id),
    );
    expect(probe.current).toMatchObject({
      isSelf: true,
      chosen: true,
      audience: 'guardian',
      mustPick: false,
    });
  });

  it('un id que no es de la lista (un hijo de otra familia) no hace nada', async () => {
    await setup('family');
    const before = probe.current!.active!.id;
    await act(async () => probe.current!.setActive('f-hijo-nico'));
    await act(async () => probe.current!.setActive('inventado'));
    expect(probe.current!.active!.id).toBe(before);
    expect(probe.current!.chosen).toBe(false);
  });

  it('se recuerda por persona (un id y un booleano, sin nombres) y se recupera al volver a abrir', async () => {
    const first = await setup('family');
    await act(async () => probe.current!.setActive('f-hijo-sin-nombre'));
    await wait(50);
    const saved = first.be.dump()[`@comunica/${first.me.personId}/profile`];
    expect(JSON.parse(saved!)).toEqual({
      activeId: 'f-hijo-sin-nombre',
      chosen: true,
    });
    expect(saved).not.toMatch(/Lucía|Marta|Villarroya/);
    // Se cierra la pantalla y se vuelve a abrir (misma sesión, mismo móvil).
    await act(async () => first.tree.unmount());
    probe.current = null;
    await mount();
    expect(probe.current).toMatchObject({
      ready: true,
      chosen: true,
      mustPick: false,
      isSelf: false,
    });
    expect(probe.current!.active!.id).toBe('f-hijo-sin-nombre');
    expect(probe.current!.active!.firstName).toBeNull(); // sin nombre: «Participante» en pantalla
  });

  it('si lo recordado ya no es de la lista (relación terminada), se vuelve a aplicar la tabla', async () => {
    const be = memoryBackend();
    const first = await setup('family', {}, be);
    await be.setItem(
      `@comunica/${first.me.personId}/profile`,
      JSON.stringify({ activeId: 'f-hijo-que-ya-no-es', chosen: true }),
    );
    await act(async () => first.tree.unmount());
    probe.current = null;
    await mount();
    expect(probe.current).toMatchObject({
      ready: true,
      mustPick: true,
      chosen: false,
      isSelf: true,
    });
  });
});

describe('seguridad y salida', () => {
  it('si el CRM no contesta a los hijos, no hay nada listo ni una lista vacía inventada', async () => {
    await setup('family', { profilesDown: true });
    await wait(200);
    expect(probe.current!.ready).toBe(false);
    expect(probe.current!.profiles).toBeUndefined();
    expect(probe.current!.active).toBeNull();
  });

  it('salir borra lo recordado', async () => {
    const { be, me } = await setup('family');
    await act(async () => probe.current!.setActive('f-hijo-lucia'));
    await wait(50);
    expect(be.dump()[`@comunica/${me.personId}/profile`]).toBeTruthy();
    await act(async () => {
      await signOut();
    });
    expect(be.dump()[`@comunica/${me.personId}/profile`]).toBeUndefined();
  });
});
