// Plan 08, tarea 3: el alta del móvil por la cola (con huella, sin repetir),
// sin permiso no hay alta, y al salir se da de baja y se olvida — con el
// servidor falso de verdad y la cola de verdad.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeServer } from '@/services/comunica/fake';
import { createOutbox } from '@/services/comunica/outbox';
import {
  __resetSessionForTests,
  BEFORE_SIGN_OUT_MS,
  configureSession,
  currentAccessToken,
  memorySecretStore,
  signIn,
  signOut,
  withSession,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import {
  __resetDevicesForTests,
  currentDeviceId,
  DEVICE_OUTBOX,
  getNoticePrefs,
  installDeviceSignOut,
  loadNoticePrefs,
  setNoticePref,
  syncDeviceRegistration,
} from '@/services/comunica/devices';
import type { DeviceRegistration } from '@/services/comunica/contract';

const TOKEN = 'ExponentPushToken[movil-de-prueba]';
let seq = 0;
const newId = () =>
  `3b241101-e2bb-4255-8caf-${String((seq += 1)).padStart(12, '0')}`;

async function setup() {
  __resetSessionForTests();
  __resetDevicesForTests();
  await AsyncStorage.clear();
  setStorageBackend(memoryBackend());
  const fake = createFakeServer(
    { latencyMs: 0 },
    { getAccessToken: currentAccessToken },
  );
  configureSession({
    refresh: (r) => fake.refresh(r),
    logout: (r) => fake.logout(r),
    secrets: memorySecretStore(),
  });
  const api = withSession(fake);
  const t = fake.issueSession('monitor');
  await signIn(t, t.me);
  const outbox = createOutbox({
    personId: t.me.personId,
    handlers: {
      device: (e) =>
        api.registerDevice({
          ...(e.payload as Omit<DeviceRegistration, 'clientId'>),
          clientId: e.clientId,
        }),
    },
  });
  const cancelLocal = jest.fn(() => Promise.resolve());
  const off = installDeviceSignOut(() => api, cancelLocal);
  const sync = (
    patch: Partial<Parameters<typeof syncDeviceRegistration>[0]> = {},
  ) =>
    syncDeviceRegistration({
      personId: t.me.personId,
      platform: 'android',
      appVersion: '2.1.0',
      permitted: async () => true,
      pushToken: async () => TOKEN,
      prefs: getNoticePrefs(),
      enqueue: (i) => outbox.enqueue(i),
      newId,
      ...patch,
    });
  return { fake, outbox, sync, cancelLocal, off, me: t.me };
}

describe('registro del móvil (plan 08)', () => {
  it('con sesión, permiso y token: alta por la cola, una vez', async () => {
    const { fake, outbox, sync } = await setup();
    expect(await sync()).toBe('queued');
    await outbox.flush();
    expect(outbox.get(DEVICE_OUTBOX.key)?.status).toBe('applied');
    const [device] = [...fake.deviceRegistry.values()];
    expect(device.registration).toMatchObject({
      pushToken: TOKEN,
      platform: 'android',
      channels: { rollCall: 'comunica-listas', groups: 'comunica-grupos' },
      prefs: { rollCallDue: true, groupChanges: true },
    });
    // Sin cambios, no se repite.
    expect(await sync()).toBe('unchanged');
  });

  it('un cambio de preferencias repite el alta con el mismo deviceId', async () => {
    const { fake, outbox, sync } = await setup();
    await sync();
    await outbox.flush();
    const id = await currentDeviceId();
    await setNoticePref('groupChanges', false);
    expect(await sync({ prefs: getNoticePrefs() })).toBe('queued');
    await outbox.flush();
    expect(fake.deviceRegistry.size).toBe(1);
    expect(fake.deviceRegistry.get(id!)?.registration.prefs.groupChanges).toBe(
      false,
    );
  });

  it('sin permiso, sin token o en web: no hay alta', async () => {
    const { fake, outbox, sync } = await setup();
    expect(await sync({ permitted: async () => false })).toBe('skipped');
    expect(await sync({ pushToken: async () => null })).toBe('skipped');
    expect(await sync({ platform: 'web' })).toBe('skipped');
    await outbox.flush();
    expect(outbox.entries()).toHaveLength(0);
    expect(fake.deviceRegistry.size).toBe(0);
  });

  it('otra persona en el mismo móvil: otro deviceId', async () => {
    const { sync } = await setup();
    await sync();
    const first = await currentDeviceId();
    await sync({ personId: 'otra-persona' });
    expect(await currentDeviceId()).not.toBe(first);
  });

  it('al salir: baja en el servidor, se olvida y se cancelan los avisos', async () => {
    const { fake, outbox, sync, cancelLocal } = await setup();
    await sync();
    await outbox.flush();
    expect(fake.deviceRegistry.size).toBe(1);
    await signOut();
    expect(fake.deviceRegistry.size).toBe(0);
    expect(await currentDeviceId()).toBeNull();
    expect(cancelLocal).toHaveBeenCalled();
  });

  it('si la baja no contesta, se sale igual (tope de 3 s)', async () => {
    const { fake, outbox, sync } = await setup();
    await sync();
    await outbox.flush();
    fake.setControls({ latencyMs: 60_000 });
    jest.useFakeTimers();
    try {
      const out = signOut();
      await jest.advanceTimersByTimeAsync(BEFORE_SIGN_OUT_MS + 10);
      fake.setControls({ latencyMs: 0 });
      await jest.advanceTimersByTimeAsync(60_000);
      await out;
    } finally {
      jest.useRealTimers();
    }
    expect(await currentDeviceId()).toBeNull();
  });

  it('las preferencias se guardan en el móvil', async () => {
    await setup();
    await setNoticePref('outboxReminder', false);
    __resetDevicesForTests();
    expect((await loadNoticePrefs()).outboxReminder).toBe(false);
  });
});
