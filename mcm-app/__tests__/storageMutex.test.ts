/**
 * Tests del mutex por clave de AsyncStorage (`utils/storageMutex.ts`) y de la
 * concurrencia real de sus dos consumidores.
 *
 * El bug que arregla (plan `plans/006-asyncstorage-write-serialization.md`):
 * varios módulos hacían `getItem → parse → mutar → setItem` sobre la misma clave
 * sin serializar. Si dos ciclos se intercalan, el segundo `setItem` escribe una
 * copia obsoleta y el cambio del primero desaparece — en silencio, porque cada
 * `catch` loguea y sigue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  withStorageLock,
  __resetStorageLocksForTests,
} from '@/utils/storageMutex';
import {
  upsertLocalBookmark,
  loadLocalBookmarks,
  removeLocalBookmark,
  BOOKMARKS_KEY,
  type StoredBookmark,
} from '@/utils/contigoBookmarks';
import {
  saveReceivedNotificationLocally,
  getLocalNotificationsHistory,
} from '@/services/pushNotificationService';
import type { ReceivedNotification } from '@/types/notifications';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  jest.clearAllMocks();
  __resetStorageLocksForTests();
  await AsyncStorage.clear();
});

describe('withStorageLock', () => {
  it('dos operaciones sobre la misma clave corren en serie, no intercaladas', async () => {
    const marks: string[] = [];
    const op = (name: string, delay: number) => async () => {
      marks.push(`${name}:inicio`);
      await tick(delay);
      marks.push(`${name}:fin`);
    };

    // La primera tarda MÁS que la segunda: si no hubiera lock, B acabaría antes.
    const a = withStorageLock('k', op('A', 30));
    const b = withStorageLock('k', op('B', 0));
    await Promise.all([a, b]);

    expect(marks).toEqual(['A:inicio', 'A:fin', 'B:inicio', 'B:fin']);
  });

  it('claves distintas no se bloquean entre sí', async () => {
    const marks: string[] = [];
    const a = withStorageLock('k1', async () => {
      marks.push('A:inicio');
      await tick(30);
      marks.push('A:fin');
    });
    const b = withStorageLock('k2', async () => {
      marks.push('B:inicio');
      marks.push('B:fin');
    });
    await Promise.all([a, b]);

    // B no espera a A: acaba antes aunque se encolara después.
    expect(marks.indexOf('B:fin')).toBeLessThan(marks.indexOf('A:fin'));
  });

  it('un fallo no rompe la cadena, pero sí llega a su propio caller', async () => {
    const marks: string[] = [];
    const failing = withStorageLock('k', async () => {
      await tick(5);
      throw new Error('boom');
    });
    const next = withStorageLock('k', async () => {
      marks.push('siguiente');
      return 'ok';
    });

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
    expect(marks).toEqual(['siguiente']);
  });

  it('devuelve el valor de `fn`', async () => {
    await expect(withStorageLock('k', async () => 42)).resolves.toBe(42);
  });
});

describe('concurrencia real de los consumidores', () => {
  const bookmark = (date: string, at: number): StoredBookmark => ({
    date,
    bookmarkedAt: at,
    readings: null,
  });

  it('dos upsert de subrayados sin await entre ellos: no se pierde ninguno', async () => {
    // Con el código viejo, el segundo `setItem` podía escribir un snapshot que
    // no incluía el primero, y ese subrayado desaparecía.
    await Promise.all([
      upsertLocalBookmark(bookmark('2026-08-01', 1)),
      upsertLocalBookmark(bookmark('2026-08-02', 2)),
      upsertLocalBookmark(bookmark('2026-08-03', 3)),
    ]);

    const list = await loadLocalBookmarks();
    expect(list.map((b) => b.date).sort()).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ]);
  });

  it('upsert y remove concurrentes acaban en un estado consistente', async () => {
    await upsertLocalBookmark(bookmark('2026-08-01', 1));

    await Promise.all([
      upsertLocalBookmark(bookmark('2026-08-02', 2)),
      removeLocalBookmark('2026-08-01'),
    ]);

    const list = await loadLocalBookmarks();
    expect(list.map((b) => b.date)).toEqual(['2026-08-02']);
    // Y lo persistido coincide con lo que devuelve la lectura.
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it('dos notificaciones guardadas a la vez: las dos quedan en el historial', async () => {
    const notif = (id: string): ReceivedNotification => ({
      id,
      title: `Título ${id}`,
      body: `Cuerpo ${id}`,
      receivedAt: new Date(2026, 7, 1, 10, 0).toISOString(),
      isRead: false,
    });

    await Promise.all([
      saveReceivedNotificationLocally(notif('a')),
      saveReceivedNotificationLocally(notif('b')),
    ]);

    const history = await getLocalNotificationsHistory();
    expect(history.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });
});
