// Plan 08, tarea 1: el contrato de los avisos (registro del móvil y `data` de
// cada aviso) y el servidor falso de dispositivos.

import { z } from 'zod';
import {
  COMUNICA_CHANNEL_IDS,
  ComunicaPushData,
  DeviceRegistration,
  ROUTES,
} from '@/services/comunica/contract';
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';

const UUID = (n: number) =>
  `3b241101-e2bb-4255-8caf-${String(n).padStart(12, '0')}`;

const registration = (n = 1, patch: Partial<DeviceRegistration> = {}) => ({
  clientId: UUID(n),
  deviceId: UUID(100),
  pushToken: 'ExponentPushToken[abc123]',
  platform: 'android' as const,
  appVersion: '2.1.0',
  channels: { ...COMUNICA_CHANNEL_IDS },
  prefs: { rollCallDue: true, groupChanges: false },
  ...patch,
});

describe('contrato de los avisos (plan 08)', () => {
  it('acepta un registro bien formado', () => {
    expect(DeviceRegistration.safeParse(registration()).success).toBe(true);
  });

  it('rechaza tokens que no son de Expo y canales que la app no crea', () => {
    expect(
      DeviceRegistration.safeParse(registration(1, { pushToken: 'abc' }))
        .success,
    ).toBe(false);
    expect(
      DeviceRegistration.safeParse({
        ...registration(),
        channels: { rollCall: 'default', groups: 'comunica-grupos' },
      }).success,
    ).toBe(false);
    expect(
      DeviceRegistration.safeParse({ ...registration(), platform: 'web' })
        .success,
    ).toBe(false);
  });

  it('el `data` de un aviso valida tipo, versión e ids', () => {
    const ok = {
      source: 'comunica',
      v: 1,
      id: `comunica:${UUID(5)}`,
      type: 'rollcall_due',
      groupId: 'f-grp-c1',
      sessionId: 'f-ses-01',
    };
    expect(ComunicaPushData.safeParse(ok).success).toBe(true);
    expect(ComunicaPushData.safeParse({ ...ok, v: 2 }).success).toBe(false);
    expect(ComunicaPushData.safeParse({ ...ok, type: 'nuevo' }).success).toBe(
      false,
    );
    expect(
      ComunicaPushData.safeParse({ ...ok, groupId: '../../etc' }).success,
    ).toBe(false);
    expect(ComunicaPushData.safeParse({ ...ok, id: 'abc' }).success).toBe(
      false,
    );
  });

  it('guardarraíl: `ComunicaPushData` no tiene campos de texto libre', () => {
    // Ni nombres ni salud en un aviso: la pantalla bloqueada la ve cualquiera.
    // Todo campo es un literal, un enum o una cadena con forma (regex).
    for (const [key, field] of Object.entries(ComunicaPushData.shape)) {
      let f: z.ZodType = field as z.ZodType;
      if (f instanceof z.ZodOptional) f = f.unwrap() as z.ZodType;
      const free =
        f instanceof z.ZodString &&
        !(f as z.ZodString).def.checks?.some(
          (c) =>
            (c as { _zod: { def: { format?: string } } })._zod.def.format ===
            'regex',
        );
      expect({ key, free }).toEqual({ key, free: false });
    }
  });

  it('las rutas de dispositivos no se guardan en el móvil', () => {
    expect(ROUTES.registerDevice.persist).toBe(false);
    expect(ROUTES.unregisterDevice.persist).toBe(false);
    expect(ROUTES.unregisterDevice.method).toBe('DELETE');
  });
});

describe('servidor falso: dispositivos', () => {
  const server = () => createFakeServer({ latencyMs: 0 });

  it('guarda el alta y no duplica con el mismo clientId', async () => {
    const s = server();
    const a = await s.registerDevice(registration(1));
    const b = await s.registerDevice(registration(1));
    expect(a).toEqual(b);
    expect(s.deviceRegistry.size).toBe(1);
    expect(s.deviceRegistry.get(UUID(100))?.persona).toBe('monitor');
  });

  it('un pushToken, un dispositivo: el de otro deviceId se borra', async () => {
    const s = server();
    await s.registerDevice(registration(1));
    await s.registerDevice(registration(2, { deviceId: UUID(101) }));
    expect([...s.deviceRegistry.keys()]).toEqual([UUID(101)]);
  });

  it('borra el suyo; el de otra persona es forbidden', async () => {
    const s = server();
    await s.registerDevice(registration(1));
    s.setControls({ persona: 'other' });
    await expect(s.unregisterDevice(UUID(100))).rejects.toMatchObject({
      code: 'forbidden',
    });
    s.setControls({ persona: 'monitor' });
    await s.unregisterDevice(UUID(100));
    expect(s.deviceRegistry.size).toBe(0);
    // Borrar lo que ya no está no es un error.
    await expect(s.unregisterDevice(UUID(100))).resolves.toBeUndefined();
  });

  it('da 401 sin sesión', async () => {
    const s = createFakeServer(
      { latencyMs: 0 },
      { getAccessToken: () => null },
    );
    await expect(s.registerDevice(registration(1))).rejects.toBeInstanceOf(
      ComunicaApiError,
    );
    await expect(s.registerDevice(registration(1))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(s.unregisterDevice(UUID(100))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rechaza un registro mal formado y empieza de cero con reset', async () => {
    const s = server();
    await expect(
      s.registerDevice({ ...registration(1), pushToken: 'x' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await s.registerDevice(registration(3));
    s.reset();
    expect(s.deviceRegistry.size).toBe(0);
  });
});
