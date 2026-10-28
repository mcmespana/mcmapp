// services/comunica/session.ts
//
// La sesión del área nativa (plan 02): quién ha entrado y sus tokens.
//
//   · Token de ACCESO (corto, ~15 min): solo en memoria.
//   · Token de REFRESCO (meses, rota en cada uso): en el almacén de secretos.
//     Con el servidor de verdad, el llavero (`expo-secure-store`, desde la
//     build 2.1; sin él, en memoria: se vuelve a entrar al abrir la app). Con
//     el servidor FALSO sus tokens no valen nada fuera del móvil, y se guardan
//     en AsyncStorage para que los probadores no tengan que entrar cada vez.
//     Un test vigila que con el de verdad nunca toque AsyncStorage
//     (`chooseSecretStore` de `index.ts`).
//   · Quién es (`personId` y su `Me`): en AsyncStorage, no es secreto, y hace
//     falta para entrar sin cobertura y para el espacio por persona (plan 01).
//
// Ante un 401: se refresca una vez y se repite (`withSession`). Si el refresco
// falla (o no hay con qué refrescar), la sesión acaba ('revoked'), pero NO se
// borra nada en silencio: lo que haya en la cola sigue ahí hasta que la persona
// salga o vuelva a entrar.
//
// Cada entrada y cada salida abre una «época» nueva. Lo que empezó en una
// época y acaba en otra no vale: una llamada de A que termina con B dentro
// falla como 401 (y no se repite con el token de B), y un refresco de A que
// vuelve tras salir no reescribe nada.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ComunicaApi } from './client';
import { ComunicaApiError, isComunicaApiError } from './client';
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
let epoch = 0;
const listeners = new Set<() => void>();
const signOutCleanups = new Set<() => unknown>();
const beforeSignOut = new Set<() => Promise<unknown>>();
/** Lo que se hace con la sesión aún viva al salir espera esto como mucho. */
export const BEFORE_SIGN_OUT_MS = 3_000;
const sessionEndHooks = new Set<() => void>();

/**
 * Algo más que borrar al salir (las fotos de `expo-image`, plan 05). Lo
 * registra `services/comunica/index.ts`: así este fichero no importa nada
 * nativo y se prueba sin mocks.
 */
export function addSignOutCleanup(fn: () => unknown): () => void {
  signOutCleanups.add(fn);
  return () => {
    signOutCleanups.delete(fn);
  };
}

/**
 * Lo que hay que hacer al salir CON la sesión todavía viva (dar de baja el
 * móvil en nuestro servidor, plan 08): corre antes que nada, con un tope de
 * `BEFORE_SIGN_OUT_MS` entre todo. Si falla o tarda, se sale igual.
 */
export function addBeforeSignOut(fn: () => Promise<unknown>): () => void {
  beforeSignOut.add(fn);
  return () => {
    beforeSignOut.delete(fn);
  };
}

/**
 * Lo que hay que apagar en cuanto se acaba la sesión (salir o revocada), antes
 * de borrar nada: la cola de esa persona (`ComunicaAreaProvider`). Síncrono.
 */
export function onSessionEnd(fn: () => void): () => void {
  sessionEndHooks.add(fn);
  return () => {
    sessionEndHooks.delete(fn);
  };
}

/** El 401 de una llamada que empezó con otra sesión. */
const sessionChanged = () =>
  new ComunicaApiError(
    'unauthenticated',
    'La sesión ha cambiado',
    401,
    'session_changed',
  );

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
  const started = epoch;
  initPromise = (async () => {
    try {
      const [refresh, rawMe] = await Promise.all([
        deps?.secrets.get(REFRESH_KEY) ?? null,
        AsyncStorage.getItem(PERSON_KEY),
      ]);
      // Si mientras se leía alguien ha entrado (un enlace), manda eso.
      if (epoch !== started) return;
      const me = rawMe ? (JSON.parse(rawMe) as Me) : null;
      emit(
        refresh && me
          ? { status: 'signedIn', me }
          : { status: 'signedOut', me: null },
      );
    } catch (e) {
      logger.warn('[comunica] sesión ilegible', e);
      if (epoch === started) emit({ status: 'signedOut', me: null });
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
  epoch += 1;
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
  // Sin sesión no se refresca nada (ni lo que quede de la anterior).
  if (state.status !== 'signedIn') return null;
  if (!force && currentAccessToken()) return accessToken;
  if (refreshing) return refreshing;
  const started = epoch;
  let p: Promise<string | null> | null = null;
  p = (async () => {
    try {
      const refresh = await deps?.secrets.get(REFRESH_KEY);
      if (epoch !== started) return null;
      if (!deps || !refresh) {
        // Un 401 sin con qué refrescar: la sesión no sirve. A la puerta.
        if (force) await endSession('revoked');
        return null;
      }
      const tokens = await deps.refresh(refresh);
      // Se ha salido (o ha entrado otra persona) mientras tanto: ni se usa ni
      // se guarda.
      if (epoch !== started) return null;
      setAccess(tokens);
      await deps.secrets.set(REFRESH_KEY, tokens.refreshToken);
      return tokens.accessToken;
    } catch (e) {
      if (
        epoch === started &&
        isComunicaApiError(e) &&
        e.code === 'unauthenticated'
      ) {
        await endSession('revoked');
      }
      // Sin red: se sigue «dentro» con lo guardado; la petición fallará por
      // red y la cola reintentará.
      return null;
    } finally {
      // El de otra época ya no es «el refresco en vuelo».
      if (refreshing === p) refreshing = null;
    }
  })();
  refreshing = p;
  return p;
}

async function endSession(reason: 'signedOut' | 'revoked') {
  // Primero, que nada de esta sesión siga: época nueva, sin token, la cola
  // apagada y el estado fuera. Luego se borra lo guardado.
  epoch += 1;
  accessToken = null;
  accessExp = 0;
  refreshing = null;
  sessionEndHooks.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      logger.warn('[comunica] al acabar la sesión', e);
    }
  });
  emit({ status: 'signedOut', me: null, reason });
  try {
    await deps?.secrets.remove(REFRESH_KEY);
    await AsyncStorage.removeItem(PERSON_KEY);
  } catch (e) {
    logger.warn('[comunica] no se ha podido borrar la sesión', e);
  }
}

/**
 * Salir, en este orden: lo de `addBeforeSignOut` (con tope), se acaba la sesión (la cola se apaga y ya no hay
 * token), se revoca en el servidor si se puede y se borra TODO lo del área.
 * Así ningún reintento de la cola escribe ni sube nada después de borrar.
 */
export async function signOut(): Promise<void> {
  if (beforeSignOut.size > 0) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all([...beforeSignOut].map((fn) => fn().catch(() => {}))),
      new Promise((r) => {
        timer = setTimeout(r, BEFORE_SIGN_OUT_MS);
      }),
    ]);
    clearTimeout(timer);
  }
  const refresh = await deps?.secrets.get(REFRESH_KEY).catch(() => null);
  const logout = deps?.logout;
  await endSession('signedOut');
  if (refresh && logout) {
    await logout(refresh).catch(() => {});
  }
  await clearAll();
  await Promise.all(
    [...signOutCleanups].map(async (fn) => {
      try {
        await fn();
      } catch (e) {
        logger.warn('[comunica] limpieza al salir', e);
      }
    }),
  );
}

/**
 * Envuelve el cliente: pone el token antes de cada llamada con sesión y, ante
 * un 401, refresca una vez y repite.
 */
export function withSession(api: ComunicaApi): ComunicaApi {
  const authed =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const started = epoch;
      // Cada paso comprueba que sigue la misma sesión: lo de A nunca se pide
      // (ni se repite) con el token de B, ni su respuesta llega a B.
      const call = async () => {
        if (epoch !== started) throw sessionChanged();
        const r = await fn(...args);
        if (epoch !== started) throw sessionChanged();
        return r;
      };
      await getAccessToken();
      try {
        return await call();
      } catch (e) {
        if (!isComunicaApiError(e) || e.code !== 'unauthenticated') throw e;
        if (epoch !== started) throw e;
        const token = await getAccessToken(true);
        if (!token) throw e;
        return call();
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
    getPeople: authed((o) => api.getPeople(o)),
    getGroupDetail: authed((g, o) => api.getGroupDetail(g, o)),
    getPerson: authed((id, o) => api.getPerson(id, o)),
    getPersonal: authed((id) => api.getPersonal(id)),
    createNotice: authed((id, b) => api.createNotice(id, b)),
    setScarf: authed((id, b) => api.setScarf(id, b)),
    assignGroup: authed((id, b) => api.assignGroup(id, b)),
    getCoordination: authed((o) => api.getCoordination(o)),
    getCoordinationSummary: authed((o) => api.getCoordinationSummary(o)),
    getMonitorsRoll: authed((p, o) => api.getMonitorsRoll(p, o)),
    saveMonitorsRoll: authed((s, b) => api.saveMonitorsRoll(s, b)),
    getMeetings: authed((o) => api.getMeetings(o)),
    createMeeting: authed((b) => api.createMeeting(b)),
    getMonitor: authed((id, o) => api.getMonitor(id, o)),
    getFollowUps: authed((id) => api.getFollowUps(id)),
    createFollowUp: authed((id, b) => api.createFollowUp(id, b)),
    createSessionToday: authed((id, b) => api.createSessionToday(id, b)),
    getEvents: authed((o) => api.getEvents(o)),
    getEventRoll: authed((id, o) => api.getEventRoll(id, o)),
    saveEventRoll: authed((id, b) => api.saveEventRoll(id, b)),
    registerDevice: authed((b) => api.registerDevice(b)),
    unregisterDevice: authed((id) => api.unregisterDevice(id)),
    photoSource: (url) => api.photoSource(url),
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
  epoch = 0;
  listeners.clear();
  signOutCleanups.clear();
  beforeSignOut.clear();
  sessionEndHooks.clear();
}
