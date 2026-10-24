/**
 * Grupos y fichas de punta a punta contra el servidor falso (plan 05):
 * precarga para el sábado sin red, vincular por la cola, avisos, y los
 * guardarraíles de la salud y de las fotos al salir.
 */
import { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { createFakeServer } from '@/services/comunica/fake';
import { createOutbox } from '@/services/comunica/outbox';
import {
  __resetSessionForTests,
  addSignOutCleanup,
  configureSession,
  memorySecretStore,
  signOut,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { clearPhotoCache } from '@/services/comunica/photos';
import { dehydrateArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import {
  GRUPOS_KEYS,
  groupPlaceholder,
  prefetchMyFichas,
} from '@/hooks/comunica/useGrupos';
import { withPendingGroups } from '@/utils/comunica/people';
import { numberNotices } from '@/utils/comunica/notices';

jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
    prefetch: jest.fn().mockResolvedValue(true),
  },
}));

const SATURDAY = '2026-10-24T15:00:00Z';
const CLIENT = (n: number) =>
  `3b241101-e2bb-4255-8caf-${String(n).padStart(12, '0')}`;
const server = (patch = {}) =>
  createFakeServer({ latencyMs: 0, clock: SATURDAY, ...patch });

beforeEach(() => setStorageBackend(memoryBackend()));

// Sin temporizadores de recogida: si no, Jest se queda esperando 5 minutos.
const newClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

describe('precarga y sin conexión', () => {
  it('sin red, la ficha de un chaval de tu grupo se abre sin haberla visitado', async () => {
    const s = server();
    const qc = newClient();
    const n = await prefetchMyFichas(qc, s);
    expect(n).toBeGreaterThan(10);
    s.setControls({ offline: true });
    const groups = await qc.getQueryData<{ myGroupIds: string[] }>(
      areaKey(['pasar-lista', 'groups']),
    )!;
    const pid = s.data.groups.find((g) => g.id === groups.myGroupIds[0])!
      .participantIds[0];
    const saved = JSON.stringify(dehydrateArea(qc));
    expect(saved).toContain(`"${pid}"`);
    expect(qc.getQueryData(areaKey(GRUPOS_KEYS.person(pid)))).toBeTruthy();
    qc.clear();
  });

  it('ningún texto de salud de los fixtures llega al almacén persistido', async () => {
    const s = server();
    const qc = newClient();
    await prefetchMyFichas(qc, s);
    await qc.fetchQuery({
      queryKey: areaKey(GRUPOS_KEYS.people),
      queryFn: () => s.getPeople(),
      meta: { persist: true },
    });
    // La salud y los datos personales, como los pide la pantalla.
    const withHealth = Object.keys(s.data.health).find(
      (id) =>
        s.data.profiles[id] &&
        s.data.people.find((p) => p.id === id)!.delegationId ===
          s.data.delegations[0].id,
    )!;
    await qc.fetchQuery({
      queryKey: areaKey(GRUPOS_KEYS.health(withHealth)),
      queryFn: () => s.getHealth(withHealth),
      meta: { persist: false },
    });
    await qc.fetchQuery({
      queryKey: areaKey(GRUPOS_KEYS.personal(withHealth)),
      queryFn: () => s.getPersonal(withHealth),
      meta: { persist: false },
    });
    const saved = JSON.stringify(dehydrateArea(qc));
    // (Se comprueba a mano: un `toContain` fallido con un JSON tan largo
    // tarda una eternidad en pintar el diff.)
    const leaked = [
      ...Object.values(s.data.health).flatMap((items) =>
        items.map((i) => i.text),
      ),
      // Ni datos personales (el documento).
      ...Object.values(s.data.profiles).flatMap((p) =>
        p.document ? [p.document.number] : [],
      ),
    ].filter((text) => saved.includes(text));
    expect(leaked).toEqual([]);
    // Las marcas son solo booleanos.
    const person = qc.getQueryData<{ badges: Record<string, unknown> }>(
      areaKey(
        GRUPOS_KEYS.person(
          s.data.groups.find((g) => g.code === 'C1')!.participantIds[0],
        ),
      ),
    )!;
    for (const v of Object.values(person.badges)) {
      expect(typeof v).toBe('boolean');
    }
    qc.clear();
  });

  it('un grupo sale al instante con los chavales de people', async () => {
    const s = server();
    const people = await s.getPeople();
    const groups = await s.getGroups();
    const gid = groups.myGroupIds[0];
    const ph = groupPlaceholder(people, groups, gid)!;
    expect(ph.monitors).toEqual([]);
    expect(ph.participants.length).toBe(
      s.data.groups.find((g) => g.id === gid)!.participantIds.length,
    );
    expect('monitorNames' in ph.group).toBe(false);
  });
});

describe('escrituras por la cola', () => {
  it('vincular encola, mueve la fila al momento y acaba applied', async () => {
    const s = server({ persona: 'coordination' });
    const people = await s.getPeople();
    const loose = people.people.find((p) => p.unassignedMembershipId)!;
    const c1 = s.data.groups.find((g) => g.code === 'C1')!;
    const box = createOutbox({
      personId: 'p',
      handlers: {
        'membership-group': (e) =>
          s.assignGroup(e.meta.membershipId, {
            groupId: (e.payload as { groupId: string }).groupId,
            clientId: e.clientId,
          }),
      },
    });
    await box.enqueue({
      key: `membership-group:${loose.unassignedMembershipId}`,
      kind: 'membership-group',
      clientId: CLIENT(1),
      payload: { groupId: c1.id },
      meta: { membershipId: loose.unassignedMembershipId!, personId: loose.id },
    });
    // Al momento, ya en su grupo.
    const pending = new Map(
      box
        .entries()
        .filter((e) => e.kind === 'membership-group')
        .map((e) => [
          e.meta.membershipId,
          (e.payload as { groupId: string }).groupId,
        ]),
    );
    expect(
      withPendingGroups(people.people, pending).find((p) => p.id === loose.id)!
        .groupId,
    ).toBe(c1.id);
    await box.flush();
    expect(box.entries()[0].status).toBe('applied');
    expect(
      (await s.getPeople()).people.find((p) => p.id === loose.id)!.groupId,
    ).toBe(c1.id);
  });

  it('como monitor, vincular queda en failed (403) y no se reintenta solo', async () => {
    const s = server();
    const people = await s.getPeople();
    const loose = people.people.find((p) => p.unassignedMembershipId)!;
    const box = createOutbox({
      personId: 'p',
      handlers: {
        'membership-group': (e) =>
          s.assignGroup(e.meta.membershipId, {
            groupId: s.data.groups[0].id,
            clientId: e.clientId,
          }),
      },
    });
    await box.enqueue({
      key: 'membership-group:x',
      kind: 'membership-group',
      clientId: CLIENT(2),
      payload: {},
      meta: { membershipId: loose.unassignedMembershipId! },
    });
    await box.flush();
    expect(box.entries()[0]).toMatchObject({
      status: 'failed',
      error: { code: 'forbidden', auto: false },
    });
  });

  it('un aviso de mañana se queda en hoy y se numera en su sitio', async () => {
    const s = server();
    const pid = s.data.groups.find((g) => g.code === 'C1')!.participantIds[2];
    const before = await s.getPerson(pid);
    const res = await s.createNotice(pid, {
      clientId: CLIENT(3),
      date: '2026-10-25',
      reason: 'Prueba de mañana',
      familyNotified: false,
    });
    expect(res.notice.date).toBe('2026-10-24');
    const list = numberNotices([...before.notices, res.notice]);
    expect(list[list.length - 1]).toMatchObject({
      reason: 'Prueba de mañana',
      number: before.notices.length + 1,
    });
  });
});

describe('salir', () => {
  it('vacía la caché de fotos de expo-image', async () => {
    __resetSessionForTests();
    configureSession({
      refresh: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
      secrets: memorySecretStore(),
    });
    addSignOutCleanup(clearPhotoCache);
    await signOut();
    expect(Image.clearDiskCache).toHaveBeenCalled();
    expect(Image.clearMemoryCache).toHaveBeenCalled();
  });
});
