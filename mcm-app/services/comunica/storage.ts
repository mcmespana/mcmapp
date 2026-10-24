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
// Hoy va sobre AsyncStorage. El plan pide `expo-sqlite` (sin el tope de 6 MB
// de Android) y llega con la 2.2: entonces se cambia `backend` y nada más.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

export type Drawer = 'queries' | 'outbox' | 'drafts';
const DRAWERS: readonly Drawer[] = ['queries', 'outbox', 'drafts'];

const PREFIX = '@comunica';
/** Personas con algo guardado, para poder borrarlo todo al salir. */
const PEOPLE_KEY = `${PREFIX}/people`;

export interface KvBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

let backend: KvBackend = AsyncStorage;

/** Solo tests (y la 2.2): cambiar dónde se guarda. */
export function setStorageBackend(next: KvBackend): void {
  backend = next;
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

export async function writeDrawer(
  personId: string,
  drawer: Drawer,
  value: unknown,
): Promise<void> {
  const list = await people();
  if (!list.includes(personId)) {
    await backend.setItem(PEOPLE_KEY, JSON.stringify([...list, personId]));
  }
  await backend.setItem(keyOf(personId, drawer), JSON.stringify(value));
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
