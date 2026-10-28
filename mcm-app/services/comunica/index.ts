// services/comunica/index.ts
//
// La única puerta a los datos del área nativa. Las pantallas piden
// `getComunicaApi()` y no saben si detrás está el servidor de verdad o el
// falso. Se elige con `EXPO_PUBLIC_COMUNICA_API`:
//
//   · `fake`          → el servidor falso, con datos inventados.
//   · `https://…`     → `mcm-comunica-api`.
//   · sin variable    → el falso en desarrollo; en un bundle de producción,
//                       NADA: el área nativa no se enciende (plan 00 tarea 5).
//
// El canal preview hornea `EXPO_PUBLIC_COMUNICA_API=fake` en su OTA
// (`.github/workflows/ota-preview.yml`) para que los probadores la vean con
// datos inventados mientras no haya servidor.

import { createHttpClient, type ComunicaApi } from './client';
import { createFakeServer, type FakeServer } from './fake';
import { secureSecretStore } from './nativeStores';
import { clearPhotoCache } from './photos';
import {
  addSignOutCleanup,
  configureSession,
  currentAccessToken,
  fakeOnlyAsyncSecretStore,
  memorySecretStore,
  withSession,
  type SecretStore,
} from './session';

export type { FakeControls, FakeServer } from './fake';
/** El código del servidor falso, para el Laboratorio Alpha. */
export { FAKE_CODE } from './fake/fixtures';

export type ComunicaApiTarget =
  { kind: 'fake' } | { kind: 'http'; baseUrl: string } | { kind: 'off' };

/**
 * Dónde vive el token de refresco (plan 02): con el servidor de verdad, en el
 * llavero; si el binario no lo tiene (o en web), en memoria. NUNCA en
 * AsyncStorage: eso solo con el falso, cuyos tokens no abren nada.
 */
export function chooseSecretStore(
  kind: 'fake' | 'http',
  secure: () => SecretStore | null,
): SecretStore {
  if (kind === 'fake') return fakeOnlyAsyncSecretStore;
  return secure() ?? memorySecretStore();
}

/** Puro, para poder probarlo: qué servidor toca con esta variable. */
export function resolveComunicaApiTarget(
  value: string | undefined,
  isDev: boolean,
): ComunicaApiTarget {
  const v = value?.trim();
  if (!v) return isDev ? { kind: 'fake' } : { kind: 'off' };
  if (v === 'fake') return { kind: 'fake' };
  if (/^https:\/\/\S+$/.test(v) || (isDev && /^http:\/\/\S+$/.test(v))) {
    return { kind: 'http', baseUrl: v };
  }
  return { kind: 'off' };
}

const isDev = (): boolean =>
  (globalThis as { __DEV__?: boolean }).__DEV__ ?? false;

let target: ComunicaApiTarget | null = null;
let api: ComunicaApi | null = null;
let fake: FakeServer | null = null;

export function comunicaApiTarget(): ComunicaApiTarget {
  if (!target) {
    target = resolveComunicaApiTarget(
      process.env.EXPO_PUBLIC_COMUNICA_API,
      isDev(),
    );
  }
  return target;
}

/** ¿Hay servidor (de verdad o falso)? Sin él, el área nativa no se enciende. */
export const isComunicaApiAvailable = () => comunicaApiTarget().kind !== 'off';

/**
 * El cliente del área, ya con la sesión puesta (`withSession`). Lanza si no hay
 * servidor: antes, `isComunicaApiAvailable`.
 */
export function getComunicaApi(): ComunicaApi {
  if (api) return api;
  const t = comunicaApiTarget();
  if (t.kind === 'off') throw new Error('Área nativa de Comunica sin servidor');
  let raw: ComunicaApi;
  if (t.kind === 'fake') {
    fake = createFakeServer({}, { getAccessToken: currentAccessToken });
    raw = fake;
    // Los mandos del falso, a mano para las capturas de web (Playwright no
    // llega al Laboratorio Alpha). Solo el falso: datos inventados.
    (globalThis as { __comunicaFake?: FakeServer }).__comunicaFake = fake;
  } else {
    raw = createHttpClient({
      baseUrl: t.baseUrl,
      getToken: currentAccessToken,
    });
  }
  configureSession({
    refresh: (r) => raw.refresh(r),
    logout: (r) => raw.logout(r),
    secrets: chooseSecretStore(t.kind, secureSecretStore),
  });
  // Salir vacía también las fotos de las fichas (plan 05).
  addSignOutCleanup(clearPhotoCache);
  api = withSession(raw);
  return api;
}

/** Los mandos del falso (panel secreto). `null` si se habla con el de verdad. */
export function getFakeServer(): FakeServer | null {
  if (comunicaApiTarget().kind !== 'fake') return null;
  getComunicaApi();
  return fake;
}

/**
 * La hora con la que la app evalúa sus reglas (qué sesión toca, qué falta).
 * Con el servidor falso, la de su reloj si se ha movido con los mandos
 * («sábado 15:00»); si no, la del móvil.
 */
export function comunicaNow(): Date {
  const clock = fake?.controls.clock;
  return clock ? new Date(clock) : new Date();
}

/** Solo tests: olvida el servidor elegido. */
export function __resetComunicaApiForTests(): void {
  target = null;
  api = null;
  fake = null;
}
