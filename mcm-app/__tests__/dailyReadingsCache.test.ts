/**
 * Tests de `utils/dailyReadingsCache.ts` (Plan 012): `useDailyReadings`
 * cacheaba cada día bajo su propia clave sin podar nunca — un usuario diario
 * acumula varios MB al año que la app no reclama.
 *
 * El mock global de AsyncStorage (`__mocks__/@react-native-async-storage/`)
 * no implementa `getAllKeys`/`multiRemove`; se sustituye SOLO en este
 * fichero por uno que sí los tiene (no se toca el mock compartido).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DAILY_READINGS_PREFIX,
  selectKeysToPrune,
  pruneDailyReadingsCache,
} from '@/utils/dailyReadingsCache';

// jest.mock se hoista sobre los imports automáticamente.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
      multiRemove: jest.fn((keys: string[]) => {
        keys.forEach((k) => delete store[k]);
        return Promise.resolve();
      }),
      __setStore: (next: Record<string, string>) => {
        Object.keys(store).forEach((k) => delete store[k]);
        Object.assign(store, next);
      },
      __getStore: () => store,
    },
  };
});

const TODAY = '2026-08-06';

describe('selectKeysToPrune', () => {
  it('selecciona claves más viejas que la retención, deja las de dentro de la ventana', () => {
    const keys = [
      `${DAILY_READINGS_PREFIX}2026-01-01`, // muy vieja → fuera
      `${DAILY_READINGS_PREFIX}2026-08-01`, // dentro de 60 días → se queda
      `${DAILY_READINGS_PREFIX}2026-08-06`, // hoy → se queda
    ];
    const result = selectKeysToPrune(keys, TODAY, 60);
    expect(result).toEqual([`${DAILY_READINGS_PREFIX}2026-01-01`]);
  });

  it('claves ajenas no casan: se ignoran aunque sean "viejas"', () => {
    const keys = [
      '@contigo_bookmarks',
      `${DAILY_READINGS_PREFIX}sin-fecha`,
      '@mcm_notifications_history',
    ];
    expect(selectKeysToPrune(keys, TODAY)).toEqual([]);
  });

  it('una fecha inválida pero "menor" que el corte por comparación de string se poda igual (es basura)', () => {
    // La selección compara STRINGS, no fechas reales — "2020-13-99" no es una
    // fecha válida, pero como string es menor que el corte (año 2020 < 2026),
    // así que se poda igual. Es el comportamiento correcto: es basura.
    const keys = [`${DAILY_READINGS_PREFIX}2020-13-99`];
    expect(selectKeysToPrune(keys, TODAY)).toEqual(keys);
  });

  it('lista vacía → vacío', () => {
    expect(selectKeysToPrune([], TODAY)).toEqual([]);
  });
});

describe('pruneDailyReadingsCache', () => {
  beforeEach(() => {
    (AsyncStorage as any).__setStore({});
    jest.clearAllMocks();
  });

  it('borra exactamente lo seleccionado y devuelve el contador', async () => {
    (AsyncStorage as any).__setStore({
      [`${DAILY_READINGS_PREFIX}2026-01-01`]: '{}',
      [`${DAILY_READINGS_PREFIX}2026-08-06`]: '{}',
      '@contigo_bookmarks': '[]',
    });

    const count = await pruneDailyReadingsCache(TODAY);

    expect(count).toBe(1);
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      `${DAILY_READINGS_PREFIX}2026-01-01`,
    ]);
    const remaining = Object.keys((AsyncStorage as any).__getStore());
    expect(remaining).toEqual([
      `${DAILY_READINGS_PREFIX}2026-08-06`,
      '@contigo_bookmarks',
    ]);
  });

  it('un multiRemove que falla no lanza (se traga el error)', async () => {
    (AsyncStorage as any).__setStore({
      [`${DAILY_READINGS_PREFIX}2026-01-01`]: '{}',
    });
    (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );

    await expect(pruneDailyReadingsCache(TODAY)).resolves.toBe(0);
  });
});
