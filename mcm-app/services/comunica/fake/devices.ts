// services/comunica/fake/devices.ts
//
// Los móviles registrados para los avisos del área (plan 08 «Datos»), en el
// servidor falso. En memoria, como el resto del falso; van aparte de
// `index.ts` para no engordarlo. Se porta como piden los requisitos del
// servidor de verdad:
//   · Sin sesión, 401 (lo pone `gate`).
//   · Alta idempotente por `deviceId` y por `clientId`.
//   · Un `pushToken`, un dispositivo y una persona: si el mismo token llega con
//     otro `deviceId`, el anterior se borra.
//   · Borrar, solo el tuyo: el de otra persona es `forbidden` (exista o no
//     da igual: lo que no existe se da por borrado).

import { DeviceRegistration, type RouteName, WriteResult } from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { PersonaId } from './fixtures';
import type { FakeServer } from './index';

export interface FakeDevice {
  persona: PersonaId;
  registration: DeviceRegistration;
}

/** Lo que el falso añade a `ComunicaApi` para los tests y los mandos. */
export interface DevicesFake {
  /** Los móviles dados de alta, por `deviceId`. */
  readonly deviceRegistry: Map<string, FakeDevice>;
}

type DevicesApi = Pick<ComunicaApi, 'registerDevice' | 'unregisterDevice'> &
  DevicesFake;
/** El literal del servidor en `index.ts`: todo menos estas rutas y las `C`. */
export type Core<C> = Omit<FakeServer, keyof C | keyof DevicesApi>;

/**
 * Las rutas de dispositivos. Comparten con `index.ts` la puerta (`gate`: red,
 * sesión, CRM caído), quién llama y los `clientId` ya vistos.
 */
export function routes(
  gate: (route: RouteName, write?: boolean) => Promise<void>,
  persona: () => PersonaId,
  seen: Map<string, unknown>,
): DevicesApi {
  const ctx = { gate, persona, seen };
  const registry = new Map<string, FakeDevice>();
  return {
    deviceRegistry: registry,

    async registerDevice(body) {
      await ctx.gate('registerDevice', true);
      const parsed = DeviceRegistration.safeParse(body);
      if (!parsed.success) {
        throw new ComunicaApiError(
          'validation',
          'Registro del móvil no válido',
          422,
          'bad_body',
        );
      }
      const reg = parsed.data;
      const repeated = ctx.seen.get(reg.clientId);
      if (repeated) return WriteResult.parse(repeated);
      for (const [id, d] of registry) {
        if (id !== reg.deviceId && d.registration.pushToken === reg.pushToken) {
          registry.delete(id);
        }
      }
      registry.set(reg.deviceId, { persona: ctx.persona(), registration: reg });
      const result = WriteResult.parse({
        clientId: reg.clientId,
        status: 'applied',
      });
      ctx.seen.set(reg.clientId, result);
      return result;
    },

    async unregisterDevice(deviceId) {
      await ctx.gate('unregisterDevice', true);
      const d = registry.get(deviceId);
      if (d && d.persona !== ctx.persona()) {
        throw new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
      }
      registry.delete(deviceId);
    },
  };
}
