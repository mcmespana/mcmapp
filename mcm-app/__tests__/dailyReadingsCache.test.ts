/**
 * Tests de la poda de la caché de lecturas diarias
 * (`utils/dailyReadingsCache.ts`).
 *
 * Contexto (plan `plans/012-daily-readings-cache-prune.md`): la caché guardaba
 * una clave por día (5-15 KB) y nada la podaba jamás — varios MB al año que la
 * app no reclamaba nunca. El riesgo del arreglo es exactamente uno: un prefijo
 * codicioso que se lleve claves ajenas. De ahí el centinela sobre
 * `@contigo_bookmarks`, que es donde viven los guardados de verdad del usuario.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  selectKeysToPrune,
  pruneDailyReadingsCache,
  DAILY_READINGS_PREFIX,
  DEFAULT_RETENTION_DAYS,
} from '@/utils/dailyReadingsCache';

// El mock compartido de AsyncStorage no implementa `getAllKeys`/`multiRemove`;
// se añaden aquí y no en el mock global para no cambiar el arnés de los demás.
const store = new Set<string>();
const asMock = AsyncStorage as unknown as {
  getAllKeys: jest.Mock;
  multiRemove: jest.Mock;
};

beforeEach(() => {
  store.clear();
  asMock.getAllKeys = jest.fn(() => Promise.resolve([...store]));
  asMock.multiRemove = jest.fn((keys: string[]) => {
    keys.forEach((k) => store.delete(k));
    return Promise.resolve();
  });
});

const HOY = '2026-08-07';

describe('selectKeysToPrune', () => {
  it('borra lo anterior a la retención y conserva lo de dentro', () => {
    // 60 días antes del 2026-08-07 es el 2026-06-08, y ese día se CONSERVA:
    // el corte es estricto (`fecha < corte`), o sea retención inclusiva.
    const keys = [
      `${DAILY_READINGS_PREFIX}2026-08-07`, // hoy
      `${DAILY_READINGS_PREFIX}2026-07-01`, // 37 días → dentro
      `${DAILY_READINGS_PREFIX}2026-06-08`, // 60 días justos → dentro
      `${DAILY_READINGS_PREFIX}2026-06-07`, // 61 días → fuera
      `${DAILY_READINGS_PREFIX}2025-01-15`, // año pasado → fuera
    ];
    expect(selectKeysToPrune(keys, HOY)).toEqual([
      `${DAILY_READINGS_PREFIX}2026-06-07`,
      `${DAILY_READINGS_PREFIX}2025-01-15`,
    ]);
  });

  it('respeta una retención personalizada', () => {
    const keys = [
      `${DAILY_READINGS_PREFIX}2026-08-01`,
      `${DAILY_READINGS_PREFIX}2026-07-20`,
    ];
    expect(selectKeysToPrune(keys, HOY, 7)).toEqual([
      `${DAILY_READINGS_PREFIX}2026-07-20`,
    ]);
  });

  it('NO toca claves ajenas (centinela: los guardados del usuario)', () => {
    const keys = [
      '@contigo_bookmarks', // ← aquí viven los subrayados y guardados
      '@contigo_habits',
      '@mcm_notifications_history',
      'calendar_events',
      DAILY_READINGS_PREFIX, // prefijo sin fecha
      `${DAILY_READINGS_PREFIX}2020-01-01_backup`, // sufijo extra
      `${DAILY_READINGS_PREFIX}2020-1-1`, // fecha sin padding
      `${DAILY_READINGS_PREFIX}nope`,
    ];
    expect(selectKeysToPrune(keys, HOY)).toEqual([]);
  });

  it('basura con forma de fecha antigua sí se va', () => {
    // Casa el patrón y queda por detrás del corte: es basura, fuera.
    expect(
      selectKeysToPrune([`${DAILY_READINGS_PREFIX}2026-13-99`], '2027-06-01'),
    ).toEqual([`${DAILY_READINGS_PREFIX}2026-13-99`]);
  });

  it('lista vacía → nada que borrar', () => {
    expect(selectKeysToPrune([], HOY)).toEqual([]);
  });

  it('la retención por defecto son 60 días', () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(60);
  });
});

describe('pruneDailyReadingsCache', () => {
  it('borra exactamente lo seleccionado y devuelve el contador', async () => {
    store.add(`${DAILY_READINGS_PREFIX}2026-08-07`);
    store.add(`${DAILY_READINGS_PREFIX}2025-01-15`);
    store.add(`${DAILY_READINGS_PREFIX}2025-02-20`);
    store.add('@contigo_bookmarks');

    await expect(pruneDailyReadingsCache(HOY)).resolves.toBe(2);

    expect(asMock.multiRemove).toHaveBeenCalledTimes(1);
    expect([...store].sort()).toEqual([
      '@contigo_bookmarks',
      `${DAILY_READINGS_PREFIX}2026-08-07`,
    ]);
  });

  it('sin nada que borrar no llama a multiRemove', async () => {
    store.add(`${DAILY_READINGS_PREFIX}2026-08-07`);
    await expect(pruneDailyReadingsCache(HOY)).resolves.toBe(0);
    expect(asMock.multiRemove).not.toHaveBeenCalled();
  });

  it('si el borrado falla, no lanza (la poda nunca rompe la carga)', async () => {
    store.add(`${DAILY_READINGS_PREFIX}2025-01-15`);
    asMock.multiRemove = jest.fn(() =>
      Promise.reject(new Error('storage full')),
    );

    await expect(pruneDailyReadingsCache(HOY)).resolves.toBe(0);
  });

  it('si getAllKeys falla, tampoco lanza', async () => {
    asMock.getAllKeys = jest.fn(() => Promise.reject(new Error('boom')));
    await expect(pruneDailyReadingsCache(HOY)).resolves.toBe(0);
  });
});
