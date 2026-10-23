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

export type ComunicaApiTarget =
  { kind: 'fake' } | { kind: 'http'; baseUrl: string } | { kind: 'off' };

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
let tokenGetter: (() => string | null | Promise<string | null>) | undefined;

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

/** El cliente del área. Lanza si no hay servidor: antes, `isComunicaApiAvailable`. */
export function getComunicaApi(): ComunicaApi {
  if (api) return api;
  const t = comunicaApiTarget();
  if (t.kind === 'off') throw new Error('Área nativa de Comunica sin servidor');
  if (t.kind === 'fake') {
    fake = createFakeServer();
    api = fake;
  } else {
    api = createHttpClient({
      baseUrl: t.baseUrl,
      getToken: () => tokenGetter?.() ?? null,
    });
  }
  return api;
}

/** Los mandos del falso (panel secreto). `null` si se habla con el de verdad. */
export function getFakeServer(): FakeServer | null {
  if (comunicaApiTarget().kind !== 'fake') return null;
  getComunicaApi();
  return fake;
}

/** El plan 02 engancha aquí la sesión. */
export function setComunicaTokenGetter(
  getter: (() => string | null | Promise<string | null>) | undefined,
): void {
  tokenGetter = getter;
}

/** Solo tests: olvida el servidor elegido. */
export function __resetComunicaApiForTests(): void {
  target = null;
  api = null;
  fake = null;
}
