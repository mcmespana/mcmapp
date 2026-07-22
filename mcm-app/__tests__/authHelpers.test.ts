/**
 * Tests de utils/authHelpers.ts — la única capa de mutación/lectura de datos
 * por usuario (`users/{uid}/...`). Cubre `stripUndefined` (guarda de todos
 * los writes), los syncs de CONTIGO, `writeUserOnLogin`, `deleteUserData`
 * (borrado de cuenta) y las hidrataciones nuevas (`fetchContigoHabits`,
 * `fetchContigoRevisions`) del Plan 004.
 *
 * Firebase RTDB está mockeado en `__mocks__/firebase.ts` (mapeado en
 * jest.config.js); aquí controlamos las respuestas por llamada con
 * `mockResolvedValueOnce` y leemos los paths de las llamadas a `ref`.
 */
import { logger } from '@/utils/logger';
import { ref, get, set, remove, update } from 'firebase/database';
import {
  stripUndefined,
  syncContigoHabit,
  syncContigoBookmark,
  writeUserOnLogin,
  deleteUserData,
  fetchContigoHabits,
  fetchContigoRevisions,
} from '@/utils/authHelpers';
import type { DayRecord } from '@/hooks/useContigoHabits';

// Snapshot factory al estilo del SDK de Firebase (exists() + val()).
const snapshot = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

/** Path (2º argumento) de la N-ésima llamada a `ref(db, path)`. */
const refPath = (call = 0): string => (ref as jest.Mock).mock.calls[call][1];

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('stripUndefined', () => {
  it('elimina claves undefined de un objeto anidado', () => {
    const input = {
      a: 1,
      b: undefined,
      c: { d: undefined, e: 'ok' },
    };
    expect(stripUndefined(input)).toEqual({ a: 1, c: { e: 'ok' } });
  });

  it('limpia cada objeto de un array', () => {
    const input = [{ a: undefined, b: 1 }, { c: 2 }];
    expect(stripUndefined(input)).toEqual([{ b: 1 }, { c: 2 }]);
  });

  it('deja pasar primitivos tal cual', () => {
    expect(stripUndefined('texto')).toBe('texto');
    expect(stripUndefined(42)).toBe(42);
    expect(stripUndefined(null)).toBe(null);
  });
});

describe('syncContigoHabit', () => {
  it('escribe en users/{uid}/contigo/habits/{date} sin undefined', async () => {
    const record: DayRecord = {
      date: '2026-07-18',
      readingDone: true,
      prayerDone: false,
      prayerDuration: undefined,
      timestamp: 123,
    };
    await syncContigoHabit('u1', '2026-07-18', record);

    expect(refPath()).toBe('users/u1/contigo/habits/2026-07-18');
    const written = (set as jest.Mock).mock.calls[0][1];
    expect(written).not.toHaveProperty('prayerDuration');
    expect(written).toEqual({
      date: '2026-07-18',
      readingDone: true,
      prayerDone: false,
      timestamp: 123,
    });
  });
});

describe('syncContigoBookmark', () => {
  it('con bookmark=null elimina el path correcto', async () => {
    await syncContigoBookmark('u1', '2026-07-18', null);

    expect(refPath()).toBe('users/u1/contigo/bookmarks/2026-07-18');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
  });
});

describe('writeUserOnLogin', () => {
  const mcm = {
    profileType: 'joven',
    delegationId: 'castellon',
    onboardingCompleted: true,
  };

  it('actualiza con claves aplanadas y no pisa createdAt si ya existe', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    (get as jest.Mock).mockResolvedValueOnce(snapshot(1_600_000_000_000));

    await writeUserOnLogin('u1', 'Juan', 'j@x.com', null, 'google', mcm);

    expect(update).toHaveBeenCalledTimes(1);
    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload).toMatchObject({
      displayName: 'Juan',
      email: 'j@x.com',
      provider: 'google',
      'mcm/profileType': 'joven',
      'mcm/delegationId': 'castellon',
      'mcm/onboardingCompleted': true,
      'meta/lastSeenAt': 1_700_000_000_000,
    });
    // createdAt ya existía → no se vuelve a escribir.
    expect(set).not.toHaveBeenCalled();
  });

  it('pone createdAt solo si el usuario es nuevo', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));

    await writeUserOnLogin('u1', null, null, null, 'apple', mcm);

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(expect.anything(), 1_700_000_000_000);
  });
});

describe('deleteUserData', () => {
  it('elimina users/{uid}', async () => {
    await deleteUserData('u1');
    expect(refPath()).toBe('users/u1');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('propaga el error (a diferencia de los sync*, que lo tragan)', async () => {
    (remove as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(deleteUserData('u1')).rejects.toThrow('boom');
  });
});

describe('fetchContigoHabits', () => {
  it('devuelve {} si el nodo no existe', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(fetchContigoHabits('u1')).resolves.toEqual({});
  });

  it('filtra entradas que no son objetos', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        '2026-07-18': { date: '2026-07-18', readingDone: true },
        '2026-07-19': 'basura',
      }),
    );
    const result = await fetchContigoHabits('u1');
    expect(Object.keys(result)).toEqual(['2026-07-18']);
  });

  it('devuelve {} y loguea en error', async () => {
    (get as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(fetchContigoHabits('u1')).resolves.toEqual({});
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('fetchContigoRevisions', () => {
  it('devuelve {} si el nodo no existe', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(fetchContigoRevisions('u1')).resolves.toEqual({});
  });

  it('filtra entradas sin `grateful`', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        '2026-07-18': {
          date: '2026-07-18',
          type: 'grateful',
          grateful: { mode: 'list', items: ['a'], revision: '' },
        },
        '2026-07-19': { date: '2026-07-19' },
      }),
    );
    const result = await fetchContigoRevisions('u1');
    expect(Object.keys(result)).toEqual(['2026-07-18']);
  });
});
