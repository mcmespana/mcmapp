// services/comunica/storage.ts
//
// Lo que el área guarda en el móvil (plan 01 §3), con ESPACIO POR PERSONA: si
// otra persona entra en el mismo móvil no ve lo de la anterior, y al salir se
// borra todo. Es la regla del service worker del plugin
// (`PASAR-LISTA-ROADMAP.md`, «Privacidad»).
//
// Tres cajones por persona, cada uno un JSON:
//   · `queries` — la caché de consultas (solo las de `persist: true`).
//   · `outbox`  — la cola de escrituras.
//   · `drafts`  — los borradores de las listas a medio marcar.
//
// En el móvil va sobre `expo-sqlite` cifrado (`nativeStores.ts`, desde la
// build 2.1); en web y en un binario sin el paquete, sobre AsyncStorage.

import { defaultKvBackend } from './nativeStores';
import { logger } from '@/utils/logger';

/**
 * `delegation`: la delegación de trabajo elegida (plan 17); no es secreta.
 * `profile`: a quién se ve (uno mismo o un hijo) y si lo eligió ella (plan 11):
 * solo un id y un booleano, nada de nombres.
 * `home`: lo de la portada que recuerda la persona (hasta cuándo oculta el saludo, plan 11).
 * `payattempt`: el intento de pago con tarjeta en curso (plan 15): `attemptId`, `pid`, de dónde sale y la hora. SIN importes; se borra al terminar y al salir.
 */
export type Drawer =
  | 'queries'
  | 'outbox'
  | 'drafts'
  | 'delegation'
  | 'profile'
  | 'home'
  | 'payattempt';
const DRAWERS: readonly Drawer[] = [
  'queries',
  'outbox',
  'drafts',
  'delegation',
  'profile',
  'home',
  'payattempt',
];

const PREFIX = '@comunica';
/** Personas con algo guardado, para poder borrarlo todo al salir. */
const PEOPLE_KEY = `${PREFIX}/people`;

export interface KvBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

let chosen: KvBackend | null = null;
const backend = {
  getItem: (k: string) => (chosen ??= defaultKvBackend()).getItem(k),
  setItem: (k: string, v: string) =>
    (chosen ??= defaultKvBackend()).setItem(k, v),
  removeItem: (k: string) => (chosen ??= defaultKvBackend()).removeItem(k),
};

/** Solo tests: cambiar dónde se guarda. */
export function setStorageBackend(next: KvBackend): void {
  chosen = next;
}

export function memoryBackend(): KvBackend & {
  dump(): Record<string, string>;
} {
  const store: Record<string, string> = {};
  return {
    getItem: async (k) => store[k] ?? null,
    setItem: async (k, v) => {
      store[k] = v;
    },
    removeItem: async (k) => {
      delete store[k];
    },
    dump: () => ({ ...store }),
  };
}

const keyOf = (personId: string, drawer: Drawer) =>
  `${PREFIX}/${encodeURIComponent(personId)}/${drawer}`;

async function people(): Promise<string[]> {
  try {
    const raw = await backend.getItem(PEOPLE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function readDrawer<T>(
  personId: string,
  drawer: Drawer,
): Promise<T | null> {
  try {
    const raw = await backend.getItem(keyOf(personId, drawer));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    logger.warn('[comunica] cajón ilegible', drawer, e);
    return null;
  }
}

/**
 * Guarda un cajón. Nunca lanza: si el móvil no deja escribir (lleno, una fila
 * demasiado grande en Android), se avisa y devuelve `false`. Quien guarda en
 * segundo plano no tiene que acordarse de capturar nada, y lo que había antes
 * se queda como estaba.
 */
export async function writeDrawer(
  personId: string,
  drawer: Drawer,
  value: unknown,
): Promise<boolean> {
  try {
    const json = JSON.stringify(value);
    const list = await people();
    if (!list.includes(personId)) {
      await backend.setItem(PEOPLE_KEY, JSON.stringify([...list, personId]));
    }
    await backend.setItem(keyOf(personId, drawer), json);
    return true;
  } catch (e) {
    logger.warn('[comunica] no se ha podido guardar', drawer, e);
    return false;
  }
}

/** Borra lo de una persona. */
export async function clearPerson(personId: string): Promise<void> {
  await Promise.all(DRAWERS.map((d) => backend.removeItem(keyOf(personId, d))));
  const list = await people();
  await backend.setItem(
    PEOPLE_KEY,
    JSON.stringify(list.filter((p) => p !== personId)),
  );
}

/** Salir: borra TODO lo del área en el móvil, de todas las personas. */
export async function clearAll(): Promise<void> {
  const list = await people();
  await Promise.all(list.map((p) => clearPerson(p)));
  await backend.removeItem(PEOPLE_KEY);
}
