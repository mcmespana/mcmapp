/**
 * Los almacenes nativos del área (`services/comunica/nativeStores.ts`):
 * SQLite cifrado para los cajones, el llavero para el token de refresco, y lo
 * que pasa cuando el binario no los tiene.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  chooseSecretStore,
  __resetComunicaApiForTests,
} from '@/services/comunica';
import {
  fakeOnlyAsyncSecretStore,
  type SecretStore,
} from '@/services/comunica/session';
// `nativeStores` carga los paquetes con `require` al usarlos: los mocks de
// abajo ya están puestos para entonces.
import {
  defaultKvBackend,
  secureKeyName,
  secureSecretStore,
} from '@/services/comunica/nativeStores';

// Una base de datos de mentira con la forma de `expo-sqlite`: guarda en un
// Map por nombre de fichero y apunta lo que se le pide.
const mockDb = {
  files: new Map<string, Map<string, string>>(),
  executed: [] as string[],
  failOpen: false,
  badKeyOnce: false,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async (name: string) => {
    if (mockDb.failOpen) throw new Error('sin módulo');
    if (!mockDb.files.has(name)) mockDb.files.set(name, new Map());
    const rows = mockDb.files.get(name)!;
    return {
      execAsync: async (sql: string) => {
        mockDb.executed.push(sql);
        if (sql.startsWith('CREATE') && mockDb.badKeyOnce) {
          mockDb.badKeyOnce = false;
          throw new Error('file is not a database');
        }
      },
      getFirstAsync: async (sql: string, k?: string) => {
        if (sql.includes('randomblob')) return { k: 'ab'.repeat(32) };
        const v = rows.get(k!);
        return v === undefined ? null : { value: v };
      },
      runAsync: async (sql: string, k: string, v?: string) => {
        if (sql.startsWith('INSERT')) rows.set(k, v!);
        else rows.delete(k);
      },
      closeAsync: async () => {},
    };
  }),
  deleteDatabaseAsync: jest.fn(async (name: string) => {
    mockDb.files.delete(name);
  }),
}));

const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockKeychain.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockKeychain.delete(k);
  }),
}));

beforeEach(async () => {
  mockDb.files.clear();
  mockDb.executed.length = 0;
  mockKeychain.clear();
  mockDb.failOpen = false;
  mockDb.badKeyOnce = false;
  await AsyncStorage.clear();
  __resetComunicaApiForTests();
});

describe('el token de refresco', () => {
  it('nombres válidos para el llavero', () => {
    expect(secureKeyName('@comunica/refresh')).toBe('comunica_refresh');
    expect(secureKeyName('comunica.dbkey')).toBe('comunica.dbkey');
  });

  it('con el servidor de verdad, al llavero; nunca a AsyncStorage', async () => {
    const store = chooseSecretStore('http', secureSecretStore);
    expect(store).not.toBe(fakeOnlyAsyncSecretStore);
    await store.set('@comunica/refresh', 'r-1');
    expect(mockKeychain.get('comunica_refresh')).toBe('r-1');
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await store.get('@comunica/refresh')).toBe('r-1');
    await store.remove('@comunica/refresh');
    expect(mockKeychain.size).toBe(0);
  });

  it('sin llavero en el binario, a memoria (y tampoco a AsyncStorage)', async () => {
    const store: SecretStore = chooseSecretStore('http', () => null);
    await store.set('@comunica/refresh', 'r-2');
    expect(await store.get('@comunica/refresh')).toBe('r-2');
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('con el falso, AsyncStorage (sus tokens no abren nada)', () => {
    expect(chooseSecretStore('fake', secureSecretStore)).toBe(
      fakeOnlyAsyncSecretStore,
    );
  });
});

describe('los cajones en SQLite cifrado', () => {
  it('genera la clave una vez, la guarda en el llavero y cifra con ella', async () => {
    const kv = defaultKvBackend();
    await kv.setItem('@comunica/p1/queries', '{"a":1}');
    expect(await kv.getItem('@comunica/p1/queries')).toBe('{"a":1}');
    expect(mockKeychain.get('comunica.dbkey')).toBe('ab'.repeat(32));
    expect(mockDb.executed[0]).toBe(`PRAGMA key = "x'${'ab'.repeat(32)}'"`);
    // Nada del área en AsyncStorage.
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    await kv.removeItem('@comunica/p1/queries');
    expect(await kv.getItem('@comunica/p1/queries')).toBeNull();
  });

  it('pasa lo que había en AsyncStorage (sin la sesión) y lo borra de allí', async () => {
    await AsyncStorage.multiSet([
      ['@comunica/people', '["p1"]'],
      ['@comunica/p1/outbox', '[{"key":"roll:s:g"}]'],
      ['@comunica/session-person', '{"personId":"p1"}'],
      ['otra-cosa', 'x'],
    ]);
    const kv = defaultKvBackend();
    expect(await kv.getItem('@comunica/p1/outbox')).toBe(
      '[{"key":"roll:s:g"}]',
    );
    expect(await kv.getItem('@comunica/people')).toBe('["p1"]');
    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual([
      '@comunica/session-person',
      'otra-cosa',
    ]);
  });

  it('si la clave no abre el fichero, empieza de cero', async () => {
    mockKeychain.set('comunica.dbkey', 'cd'.repeat(32));
    mockDb.files.set(
      'comunica.db',
      new Map([['@comunica/people', '["vieja"]']]),
    );
    mockDb.badKeyOnce = true;
    const kv = defaultKvBackend();
    expect(await kv.getItem('@comunica/people')).toBeNull();
    await kv.setItem('@comunica/people', '["p1"]');
    expect(await kv.getItem('@comunica/people')).toBe('["p1"]');
  });

  it('sin SQLite en el binario, AsyncStorage', async () => {
    mockDb.failOpen = true;
    const kv = defaultKvBackend();
    await kv.setItem('@comunica/people', '["p1"]');
    expect(await AsyncStorage.getItem('@comunica/people')).toBe('["p1"]');
  });
});
