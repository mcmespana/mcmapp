// services/comunica/nativeStores.ts
//
// Los dos almacenes nativos del área, detrás de un adaptador (plan 01 §7):
// nada de `expo-sqlite` ni de `expo-secure-store` entra en el grafo de web,
// que usa `nativeStores.web.ts`.
//
//   · Cajones (`storage.ts`): una base de datos `expo-sqlite` cifrada con
//     SQLCipher, una fila por cajón. Sin el tope de ~2 MB por fila de
//     AsyncStorage en Android, que tiraba la caché entera (revisión A8). La
//     clave son 32 bytes de `randomblob` de SQLite (el generador seguro del
//     sistema) y vive en el llavero, solo en este móvil.
//   · Secretos (`session.ts`): el token de refresco del servidor de verdad, en
//     el llavero (`expo-secure-store`).
//
// Los dos paquetes entran en la build 2.1. Un binario anterior (o Jest) no los
// tiene: se cargan con `require` dentro de un `try` y, si faltan o fallan, los
// cajones van a AsyncStorage y el secreto a memoria (se vuelve a entrar al
// abrir la app). Se avisa una vez, sin datos.
//
// La primera vez con SQLite, lo que hubiera en AsyncStorage del área (los
// probadores del canal preview) se pasa a la base de datos y se borra de allí:
// una lista sin subir no se pierde por cambiar de almacén.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SecretStore } from './session';
import type { KvBackend } from './storage';
import { logger } from '@/utils/logger';

const DB_NAME = 'comunica.db';
/** El llavero solo admite letras, números, «.», «-» y «_». */
const DB_KEY_NAME = 'comunica.dbkey';

type SecureStoreModule = typeof import('expo-secure-store');
type SQLiteModule = typeof import('expo-sqlite');
type Database = Awaited<ReturnType<SQLiteModule['openDatabaseAsync']>>;

function loadSecureStore(): SecureStoreModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-secure-store') as SecureStoreModule;
    return typeof m?.getItemAsync === 'function' ? m : null;
  } catch {
    return null;
  }
}

function loadSQLite(): SQLiteModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-sqlite') as SQLiteModule;
    return typeof m?.openDatabaseAsync === 'function' ? m : null;
  } catch {
    return null;
  }
}

/** La clave del llavero, válida para `expo-secure-store`. */
export const secureKeyName = (key: string) =>
  key.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^_+/, '') || 'comunica';

/** Secretos en el llavero. `null` si este binario no lo tiene. */
export function secureSecretStore(): SecretStore | null {
  const ss = loadSecureStore();
  if (!ss) return null;
  const opts = { keychainAccessible: ss.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  return {
    get: async (k) => (await ss.getItemAsync(secureKeyName(k), opts)) ?? null,
    set: (k, v) => ss.setItemAsync(secureKeyName(k), v, opts),
    remove: (k) => ss.deleteItemAsync(secureKeyName(k), opts),
  };
}

/** 64 caracteres hexadecimales, la forma de clave «cruda» de SQLCipher. */
const isRawKey = (k: unknown): k is string =>
  typeof k === 'string' && /^[0-9a-f]{64}$/.test(k);

async function dbKey(
  sqlite: SQLiteModule,
  ss: SecureStoreModule,
): Promise<string> {
  const opts = { keychainAccessible: ss.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  const saved = await ss.getItemAsync(DB_KEY_NAME, opts);
  if (isRawKey(saved)) return saved;
  const mem = await sqlite.openDatabaseAsync(':memory:');
  try {
    const row = await mem.getFirstAsync<{ k: string }>(
      'SELECT lower(hex(randomblob(32))) AS k',
    );
    if (!isRawKey(row?.k)) throw new Error('clave sin generar');
    await ss.setItemAsync(DB_KEY_NAME, row.k, opts);
    return row.k;
  } finally {
    await mem.closeAsync().catch(() => {});
  }
}

async function openKeyed(sqlite: SQLiteModule, key: string) {
  const db = await sqlite.openDatabaseAsync(DB_NAME);
  try {
    await db.execAsync(`PRAGMA key = "x'${key}'"`);
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)',
    );
    return db;
  } catch (e) {
    await db.closeAsync().catch(() => {});
    throw e;
  }
}

async function openDatabase(): Promise<Database | null> {
  const sqlite = loadSQLite();
  const ss = loadSecureStore();
  // Sin llavero no hay dónde guardar la clave: mejor AsyncStorage que una
  // base de datos sin cifrar que parece cifrada.
  if (!sqlite || !ss) return null;
  const key = await dbKey(sqlite, ss);
  try {
    return await openKeyed(sqlite, key);
  } catch {
    // La clave no abre el fichero (el llavero se borró y el fichero no, p. ej.):
    // lo guardado no se puede leer de ninguna forma. Se empieza de cero.
    await sqlite.deleteDatabaseAsync(DB_NAME).catch(() => {});
    return openKeyed(sqlite, key);
  }
}

const sqliteKv = (db: Database): KvBackend => ({
  getItem: async (k) =>
    (
      await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM kv WHERE key = ?',
        k,
      )
    )?.value ?? null,
  setItem: async (k, v) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
      k,
      v,
    );
  },
  removeItem: async (k) => {
    await db.runAsync('DELETE FROM kv WHERE key = ?', k);
  },
});

/** Las claves del área que había en AsyncStorage (las de `storage.ts`). */
const AREA_PREFIX = '@comunica/';
const SESSION_KEYS = new Set(['@comunica/refresh', '@comunica/session-person']);

async function moveFromAsyncStorage(to: KvBackend): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) => k.startsWith(AREA_PREFIX) && !SESSION_KEYS.has(k),
  );
  if (keys.length === 0) return;
  for (const k of keys) {
    const v = await AsyncStorage.getItem(k);
    if (v !== null && (await to.getItem(k)) === null) await to.setItem(k, v);
  }
  await AsyncStorage.multiRemove(keys);
}

/**
 * Dónde guarda `storage.ts` en el móvil: SQLite cifrado si se puede, si no
 * AsyncStorage. Se decide la primera vez que se usa (abrir la base de datos
 * es asíncrono) y todas las operaciones esperan a esa decisión.
 */
export function defaultKvBackend(): KvBackend {
  let ready: Promise<KvBackend> | null = null;
  const resolve = () => {
    if (!ready) {
      ready = (async () => {
        try {
          const db = await openDatabase();
          if (!db) return AsyncStorage;
          const kv = sqliteKv(db);
          await moveFromAsyncStorage(kv).catch((e) =>
            logger.warn('[comunica] no se ha podido mover lo guardado', e),
          );
          return kv;
        } catch (e) {
          logger.warn('[comunica] sin base de datos cifrada', e);
          return AsyncStorage;
        }
      })();
    }
    return ready;
  };
  return {
    getItem: async (k) => (await resolve()).getItem(k),
    setItem: async (k, v) => (await resolve()).setItem(k, v),
    removeItem: async (k) => (await resolve()).removeItem(k),
  };
}
