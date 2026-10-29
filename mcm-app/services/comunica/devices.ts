// services/comunica/devices.ts
//
// Este móvil en NUESTRO servidor, para los avisos del área (plan 08):
//
//   · Las preferencias («¿Has pasado lista?», «Novedades en tu grupo», «Listas
//     sin subir»), en AsyncStorage: no son sensibles y son del móvil, así que
//     se quedan aunque se salga del área.
//   · El `deviceId` (UUID del móvil) y la huella del último alta, también en
//     AsyncStorage pero «con la sesión»: se borran al salir, y si entra otra
//     persona, otro `deviceId`. Nada de esto va a la caché de consultas.
//     OJO: fuera del prefijo `@comunica/`, que `nativeStores.ts` muda a
//     SQLite cada arranque.
//   · El alta va por la COLA (`key: 'device'`: gana la última, así un cambio
//     de preferencias pisa al anterior) y solo se repite si algo cambia
//     (token, preferencias, versión, canales, persona).
//   · La baja, al salir, NO va por la cola (se vacía al salir): llamada
//     directa antes del `logout`, con 3 s de tope (`addBeforeSignOut`).
//
// Sin React ni nada nativo: quien llama da el permiso y el token.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ComunicaApi } from './client';
import { COMUNICA_CHANNEL_IDS, type DeviceRegistration } from './contract';
import type { Outbox } from './outbox';
import { addBeforeSignOut, addSignOutCleanup } from './session';
import { uuidV4 } from '@/utils/comunica/uuid';
import { logger } from '@/utils/logger';

// ── Preferencias ────────────────────────────────────────────────────────────

export interface NoticePrefs {
  /** «¿Has pasado lista?» (lo manda el servidor). */
  rollCallDue: boolean;
  /** «Novedades en tu grupo» (lo manda el servidor). */
  groupChanges: boolean;
  /** «Tienes N listas sin subir» (lo programa el móvil). */
  outboxReminder: boolean;
}

export const DEFAULT_NOTICE_PREFS: NoticePrefs = {
  rollCallDue: true,
  groupChanges: true,
  outboxReminder: true,
};

const PREFS_KEY = '@mcm_comunica_notice_prefs';
const DEVICE_KEY = '@mcm_comunica_device';

let prefs: NoticePrefs = DEFAULT_NOTICE_PREFS;
let prefsLoaded: Promise<NoticePrefs> | null = null;
const prefsListeners = new Set<() => void>();

export const getNoticePrefs = (): NoticePrefs => prefs;

export function subscribeNoticePrefs(listener: () => void): () => void {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

/** Lee las preferencias guardadas (una vez). */
export function loadNoticePrefs(): Promise<NoticePrefs> {
  if (!prefsLoaded) {
    prefsLoaded = AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as Partial<NoticePrefs>) : {};
        const next = { ...DEFAULT_NOTICE_PREFS };
        for (const k of Object.keys(next) as (keyof NoticePrefs)[]) {
          if (typeof saved[k] === 'boolean') next[k] = saved[k];
        }
        prefs = next;
        prefsListeners.forEach((l) => l());
        return prefs;
      })
      .catch(() => prefs);
  }
  return prefsLoaded;
}

/** Cambia una preferencia al instante; se guarda por detrás. */
export async function setNoticePref(
  key: keyof NoticePrefs,
  value: boolean,
): Promise<void> {
  await loadNoticePrefs();
  prefs = { ...prefs, [key]: value };
  prefsListeners.forEach((l) => l());
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    logger.warn('[comunica] no se han podido guardar los avisos', e);
  }
}

// ── El móvil en el servidor ─────────────────────────────────────────────────

interface DeviceRecord {
  personId: string;
  deviceId: string;
  /** Lo último que se mandó (sin `clientId`): si no cambia, no se repite. */
  fingerprint: string;
}

async function readRecord(): Promise<DeviceRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_KEY);
    const r = raw ? (JSON.parse(raw) as DeviceRecord) : null;
    return r && typeof r.deviceId === 'string' ? r : null;
  } catch {
    return null;
  }
}

/** El `deviceId` de este móvil para quien ha entrado (o `null`). */
export async function currentDeviceId(): Promise<string | null> {
  return (await readRecord())?.deviceId ?? null;
}

/** Al salir: se olvida el `deviceId` (con otra persona, otro). */
export async function forgetDevice(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_KEY);
  } catch {}
}

/** La clave y el tipo de la entrada de la cola. */
export const DEVICE_OUTBOX = { key: 'device', kind: 'device' } as const;

export type DeviceSync = 'queued' | 'unchanged' | 'skipped';

export interface DeviceSyncInput {
  personId: string;
  platform: string;
  appVersion: string;
  /** ¿Hay permiso de notificaciones? */
  permitted: () => Promise<boolean>;
  /** El token de Expo (pedirlo si no lo hay). `null` si no se puede. */
  pushToken: () => Promise<string | null>;
  prefs: Pick<NoticePrefs, 'rollCallDue' | 'groupChanges'>;
  enqueue: Outbox['enqueue'];
  newId?: () => string;
}

/**
 * Da de alta el móvil si hace falta: con sesión, en iOS o Android, con
 * permiso y con token. Solo si algo ha cambiado desde la última vez.
 */
export async function syncDeviceRegistration({
  personId,
  platform,
  appVersion,
  permitted,
  pushToken,
  prefs: p,
  enqueue,
  newId = uuidV4,
}: DeviceSyncInput): Promise<DeviceSync> {
  if (platform !== 'ios' && platform !== 'android') return 'skipped';
  if (!(await permitted())) return 'skipped';
  const token = await pushToken();
  if (!token) return 'skipped';
  const prev = await readRecord();
  const deviceId = prev?.personId === personId ? prev.deviceId : newId();
  const registration: Omit<DeviceRegistration, 'clientId'> = {
    deviceId,
    pushToken: token,
    platform,
    appVersion,
    channels: { ...COMUNICA_CHANNEL_IDS },
    prefs: { rollCallDue: p.rollCallDue, groupChanges: p.groupChanges },
  };
  const fingerprint = JSON.stringify([personId, registration]);
  if (prev?.personId === personId && prev.fingerprint === fingerprint) {
    return 'unchanged';
  }
  await enqueue({
    ...DEVICE_OUTBOX,
    payload: registration,
    clientId: newId(),
    meta: {},
  });
  try {
    await AsyncStorage.setItem(
      DEVICE_KEY,
      JSON.stringify({ personId, deviceId, fingerprint }),
    );
  } catch {}
  return 'queued';
}

/**
 * Al salir (antes del `logout`, con la sesión viva): baja directa del móvil
 * y, después, olvidar el `deviceId` y cancelar los avisos locales. Devuelve
 * cómo quitarlo (lo instala `ComunicaBackground`).
 */
export function installDeviceSignOut(
  api: () => Pick<ComunicaApi, 'unregisterDevice'>,
  cancelLocal: () => Promise<void>,
): () => void {
  const offBefore = addBeforeSignOut(async () => {
    const id = await currentDeviceId();
    if (!id) return;
    try {
      await api().unregisterDevice(id);
    } catch (e) {
      // El servidor borra igual los móviles de una sesión cerrada.
      logger.warn('[comunica] no se ha podido dar de baja el móvil', e);
    }
  });
  const offAfter = addSignOutCleanup(() =>
    Promise.all([forgetDevice(), cancelLocal()]),
  );
  return () => {
    offBefore();
    offAfter();
  };
}

/** Solo tests. */
export function __resetDevicesForTests(): void {
  prefs = DEFAULT_NOTICE_PREFS;
  prefsLoaded = null;
  prefsListeners.clear();
}
