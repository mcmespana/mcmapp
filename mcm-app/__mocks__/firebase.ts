/**
 * Mock de Firebase para tests.
 * Simula las funciones de Firebase que usa la app sin necesidad de conexión real.
 */

// Mock de firebase/app
export const initializeApp = jest.fn(() => ({}));
export const getApps = jest.fn(() => [{}]);

// Mock de firebase/database
const mockSnapshot = {
  exists: jest.fn(() => true),
  val: jest.fn(() => ({
    updatedAt: '12345',
    data: { test: 'data' },
  })),
};

/**
 * Nodos registrados por path para los tests que necesitan que `get()` conteste
 * distinto según lo que se pida. `useFirebaseData` ya no lee el nodo entero:
 * pide `<path>/updatedAt`, `<path>/hidden` y `<path>/data` por separado (leer
 * el nodo entero se traía las `respuestas` de las encuestas, y las reglas ya
 * no lo permiten). Sin esto habría que encadenar `mockResolvedValueOnce` en el
 * orden exacto de las llamadas, que es justo el tipo de test que se rompe cada
 * vez que se toca el hook.
 */
const nodes = new Map<string, any>();

/** Registra el nodo `{ updatedAt, data, hidden }` que vive en `path`. */
export const __setMockNode = (path: string, value: any) => {
  nodes.set(path, value);
};

function snapshotFor(value: unknown) {
  return {
    exists: () => value !== undefined && value !== null,
    val: () => value,
  };
}

/** Resuelve `<path>` o `<path>/<hijo>` contra los nodos registrados. */
function resolvePath(path: string): { hit: boolean; value: unknown } {
  if (nodes.has(path)) return { hit: true, value: nodes.get(path) };
  const slash = path.lastIndexOf('/');
  if (slash > 0) {
    const parent = path.slice(0, slash);
    const child = path.slice(slash + 1);
    if (nodes.has(parent)) {
      return { hit: true, value: nodes.get(parent)?.[child] };
    }
  }
  return { hit: false, value: undefined };
}

const defaultGet = (reference?: { path?: string }) => {
  const path = reference?.path;
  if (typeof path === 'string') {
    const { hit, value } = resolvePath(path);
    if (hit) return Promise.resolve(snapshotFor(value));
  }
  return Promise.resolve(mockSnapshot);
};

export const getDatabase = jest.fn(() => ({}));
export const ref = jest.fn((_db?: unknown, path?: string) => ({ path }));
export const get = jest.fn(defaultGet);

/**
 * Vacía los nodos registrados y devuelve `get` a su implementación por
 * defecto. `jest.clearAllMocks()` NO quita las implementaciones puestas con
 * `mockResolvedValue`, así que sin esto un test se las cuela al siguiente.
 */
export const __resetMockDb = () => {
  nodes.clear();
  get.mockReset();
  get.mockImplementation(defaultGet);
  runTransaction.mockReset();
  runTransaction.mockImplementation(defaultRunTransaction);
};
export const set = jest.fn(() => Promise.resolve());

/**
 * `runTransaction` como el de verdad, pero contra los nodos registrados con
 * `__setMockNode`: aplica la función al valor que haya en `path` (o `null`),
 * y si devuelve `undefined` aborta (`committed: false`) sin tocar nada. Como
 * el SDK, primero llama con `null` si el nodo existe y "no estaba en caché"
 * NO se simula: se le da el valor de verdad desde la primera vuelta. Una copia
 * por llamada, para que la función no pueda cambiar el nodo por debajo.
 */
const defaultRunTransaction = async (
  reference: { path?: string } | undefined,
  apply: (current: any) => any,
) => {
  const path = reference?.path ?? '';
  const { value } = resolvePath(path);
  const current =
    value === undefined || value === null
      ? null
      : JSON.parse(JSON.stringify(value));
  const next = apply(current);
  if (next === undefined) {
    return { committed: false, snapshot: snapshotFor(value) };
  }
  if (next === null) nodes.delete(path);
  else nodes.set(path, JSON.parse(JSON.stringify(next)));
  return { committed: true, snapshot: snapshotFor(next) };
};
export const runTransaction = jest.fn(defaultRunTransaction);
export const update = jest.fn(() => Promise.resolve());
export const remove = jest.fn(() => Promise.resolve());
export const onValue = jest.fn(() => jest.fn());
export const off = jest.fn();
let pushKeyCounter = 0;
export const push = jest.fn(() => ({ key: `mock-key-${++pushKeyCounter}` }));

// Helper para cambiar lo que devuelve Firebase en cada test
export const __setMockSnapshot = (data: any) => {
  mockSnapshot.val.mockReturnValue(data);
  mockSnapshot.exists.mockReturnValue(data !== null);
};

export const __resetMocks = () => {
  nodes.clear();
  initializeApp.mockClear();
  getApps.mockClear();
  getDatabase.mockClear();
  ref.mockClear();
  get.mockClear();
  mockSnapshot.exists.mockReturnValue(true);
  mockSnapshot.val.mockReturnValue({
    updatedAt: '12345',
    data: { test: 'data' },
  });
};
