// services/comunica/nativeStores.web.ts
//
// En web no hay llavero ni base de datos cifrada: los cajones van a
// AsyncStorage (`localStorage`) y el secreto del servidor de verdad, a memoria
// (se vuelve a entrar al recargar). Ver `nativeStores.ts`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SecretStore } from './session';
import type { KvBackend } from './storage';

export const secureKeyName = (key: string) =>
  key.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^_+/, '') || 'comunica';

export function secureSecretStore(): SecretStore | null {
  return null;
}

export function defaultKvBackend(): KvBackend {
  return AsyncStorage;
}
