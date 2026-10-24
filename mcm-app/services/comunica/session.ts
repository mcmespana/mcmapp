// services/comunica/session.ts
//
// La sesión del área nativa (plan 02): quién ha entrado y sus tokens.
//
//   · Token de ACCESO (corto, ~15 min): solo en memoria.
//   · Token de REFRESCO (meses, rota en cada uso): en el almacén de secretos.
//     Con el servidor de verdad, `expo-secure-store` (llega con la 2.2; hasta
//     entonces, en memoria: se vuelve a entrar al abrir la app). Con el
//     servidor FALSO sus tokens no valen nada fuera del móvil, y se guardan en
//     AsyncStorage para que los probadores no tengan que entrar cada vez. Un
//     test vigila que con el de verdad nunca toque AsyncStorage.
//   · Quién es (`personId` y su `Me`): en AsyncStorage, no es secreto, y hace
//     falta para entrar sin cobertura y para el espacio por persona (plan 01).
//
// Ante un 401: se refresca una vez y se repite (`withSession`). Si el refresco
// falla, la sesión acaba ('revoked'), pero NO se borra nada en silencio: lo que
// haya en la cola sigue ahí hasta que la persona salga o vuelva a entrar.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ComunicaApi } from './client';
import { isComunicaApiError } from './client';
import type { Me, Tokens } from './contract';
import { clearAll } from './storage';
import { logger } from '@/utils/logger';

export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const memorySecretStore = (): SecretStore => {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => {
      m.set(k, v);
    },
    remove: async (k) => {
      m.delete(k);
    },
  };
};

/** Solo para el servidor FALSO: sus tokens no abren nada de verdad. */
export const fakeOnlyAsyncSecretStore: SecretStore = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};

const REFRESH_KEY = '@comunica/refresh';
const PERSON_KEY = '@comunica/session-person';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionState {
  status: SessionStatus;
  me: Me | null;
  /** Por qué no hay sesión: salió, o el servidor la revocó. */
  reason?: 'signedOut' | 'revoked';
}

interface Deps {
  refresh: ComunicaApi['refresh'];
  logout: ComunicaApi['logout'];
  secrets: SecretStore;
}

let deps: Deps | null = null;
let state: SessionState = { status: 'loading', me: null };
let accessToken: string | null = null;
let accessExp = 0;
let refreshing: Promise<string | null> | null = null;
let initPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = (next: SessionState) => {
  state = next;
  listeners.forEach((l) => l());
};

export function configureSession(next: Deps): void {
  deps = next;
}

export const getSessionState = (): SessionState => state;
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Al arrancar: ¿había sesión guardada? Sin red se entra igual. */
export function initSession(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const [refresh, rawMe] = await Promise.all([
        deps?.secrets.get(REFRESH_KEY) ?? null,
        AsyncStorage.getItem(PERSON_KEY),
      ]);
      const me = rawMe ? (JSON.parse(rawMe) as Me) : null;
      emit(
        refresh && me
          ? { status: 'signedIn', me }
          : { status: 'signedOut', me: null },
      );
    } catch (e) {
      logger.warn('[comunica] sesión ilegible', e);
      emit({ status: 'signedOut', me: null });
    }
  })();
  return initPromise;
}

function setAccess(tokens: Tokens) {
  accessToken = tokens.accessToken;
  // Un minuto de margen: mejor refrescar antes que recibir un 401.
  accessExp = Date.now() + (tokens.expiresIn - 60) * 1000;
}

export async function signIn(tokens: Tokens, me: Me): Promise<void> {
  if (!deps) throw new Error('Sesión sin configurar');
  setAccess(tokens);
  await deps.secrets.set(REFRESH_KEY, tokens.refreshToken);
  await AsyncStorage.setItem(PERSON_KEY, JSON.stringify(me));
  emit({ status: 'signedIn', me });
}

/** Actualiza el `Me` guardado (cuando `/v1/me` trae algo nuevo). */
export async function updateMe(me: Me): Promise<void> {
  if (state.status !== 'signedIn') return;
  if (JSON.stringify(state.me) === JSON.stringify(me)) return;
  await AsyncStorage.setItem(PERSON_KEY, JSON.stringify(me));
  emit({ ...state, me });
}

/** El token de acceso tal cual está (sin refrescar). */
export const currentAccessToken = (): string | null =>
  accessToken && Date.now() < accessExp ? accessToken : null;

/** Un token de acceso válido, refrescando si hace falta (una vez a la vez). */
export async function getAccessToken(force = false): Promise<string | null> {
  if (!force && currentAccessToken()) return accessToken;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refresh = await deps?.secrets.get(REFRESH_KEY);
      if (!deps || !refresh) return null;
      const tokens = await deps.refresh(refresh);
      setAccess(tokens);
      await deps.secrets.set(REFRESH_KEY, tokens.refreshToken);
      return tokens.accessToken;
    } catch (e) {
      if (isComunicaApiError(e) && e.code === 'unauthenticated') {
        await endSession('revoked');
      }
      // Sin red: se sigue «dentro» con lo guardado; la petición fallará por
      // red y la cola reintentará.
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function endSession(reason: 'signedOut' | 'revoked') {
  accessToken = null;
  accessExp = 0;
  await deps?.secrets.remove(REFRESH_KEY);
  await AsyncStorage.removeItem(PERSON_KEY);
  emit({ status: 'signedOut', me: null, reason });
}

/** Salir: revoca en el servidor (si se puede) y borra TODO lo del área. */
export async function signOut(): Promise<void> {
  const refresh = await deps?.secrets.get(REFRESH_KEY);
  if (refresh && deps) {
    await deps.logout(refresh).catch(() => {});
  }
  await clearAll();
  await endSession('signedOut');
}

/**
 * Envuelve el cliente: pone el token antes de cada llamada con sesión y, ante
 * un 401, refresca una vez y repite.
 */
export function withSession(api: ComunicaApi): ComunicaApi {
  const authed =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      await getAccessToken();
      try {
        return await fn(...args);
      } catch (e) {
        if (!isComunicaApiError(e) || e.code !== 'unauthenticated') throw e;
        const token = await getAccessToken(true);
        if (!token) throw e;
        return fn(...args);
      }
    };
  return {
    requestCode: (b) => api.requestCode(b),
    verify: (b) => api.verify(b),
    refresh: (t) => api.refresh(t),
    logout: (t) => api.logout(t),
    exchange: (b) => api.exchange(b),
    webPass: authed((b) => api.webPass(b)),
    getMe: authed(() => api.getMe()),
    getGroups: authed((o) => api.getGroups(o)),
    getToday: authed((o) => api.getToday(o)),
    getRoll: authed((s, g, o) => api.getRoll(s, g, o)),
    saveRoll: authed((s, g, b) => api.saveRoll(s, g, b)),
    getHealth: authed((id) => api.getHealth(id)),
  };
}

/** Solo tests. */
export function __resetSessionForTests(): void {
  deps = null;
  state = { status: 'loading', me: null };
  accessToken = null;
  accessExp = 0;
  refreshing = null;
  initPromise = null;
  listeners.clear();
}
