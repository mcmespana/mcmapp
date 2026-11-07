/**
 * Concurrencia de las escrituras locales de notificaciones (Plan 006):
 * `saveReceivedNotificationLocally` hace un ciclo getItem→mutar→setItem
 * sobre `@mcm_notifications_history`. Sin `withStorageLock`, dos llamadas
 * disparadas sin await entre ellas pueden intercalarse y una notificación
 * desaparece del historial.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveReceivedNotificationLocally,
  getLocalNotificationsHistory,
  dismissNotification,
  clearLocalNotifications,
  markNotificationAsRead,
  markNotificationAsUnread,
  getReadNotificationIds,
  getForcedUnreadIds,
  getUnreadNotificationsCount,
} from '@/services/pushNotificationService';
import type { ReceivedNotification } from '@/types/notifications';

const mk = (id: string): ReceivedNotification => ({
  id,
  title: `Título ${id}`,
  body: `Cuerpo ${id}`,
  receivedAt: new Date().toISOString(),
  isRead: false,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('saveReceivedNotificationLocally — escrituras concurrentes', () => {
  it('dos llamadas sin await entre ellas NO se pisan: ambas notificaciones quedan guardadas', async () => {
    const a = saveReceivedNotificationLocally(mk('a'));
    const b = saveReceivedNotificationLocally(mk('b'));

    await Promise.all([a, b]);

    const history = await getLocalNotificationsHistory();
    expect(history.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });
});

describe('dismissNotification y clearLocalNotifications entran en la cola', () => {
  it('descartar dos notificaciones a la vez no resucita ninguna', async () => {
    await saveReceivedNotificationLocally(mk('a'));
    await saveReceivedNotificationLocally(mk('b'));
    await saveReceivedNotificationLocally(mk('c'));

    // Sin lock, el segundo descarte parte del snapshot previo al primero y
    // devuelve al historial la notificación que el primero acababa de quitar.
    await Promise.all([
      dismissNotification(mk('a')),
      dismissNotification(mk('b')),
    ]);

    const history = await getLocalNotificationsHistory();
    expect(history.map((n) => n.id)).toEqual(['c']);
  });

  it('un guardado concurrente con el borrado del historial no deja estado a medias', async () => {
    await saveReceivedNotificationLocally(mk('viejo'));

    await Promise.all([
      clearLocalNotifications(),
      saveReceivedNotificationLocally(mk('nuevo')),
    ]);

    // Las dos operaciones se serializan, así que el resultado es uno de los dos
    // estados coherentes: vacío (si el guardado fue primero) o solo el nuevo.
    // Lo que NO puede pasar es que quede el viejo.
    const history = await getLocalNotificationsHistory();
    expect(history.map((n) => n.id)).not.toContain('viejo');
  });
});

describe('markNotificationAsUnread', () => {
  it('deshace «leída»: copia local, duplicados por contenido y lista de leídas', async () => {
    await saveReceivedNotificationLocally(mk('a'));
    await saveReceivedNotificationLocally({
      ...mk('b'),
      title: 'Título a',
      body: 'Cuerpo a',
    });
    await markNotificationAsRead('a');
    expect((await getReadNotificationIds()).has('a')).toBe(true);

    await markNotificationAsUnread('a');

    expect((await getReadNotificationIds()).has('a')).toBe(false);
    const history = await getLocalNotificationsHistory();
    expect(history.every((n) => n.isRead === false)).toBe(true);
  });

  it('funciona con una notificación solo de Firebase (sin copia local)', async () => {
    await markNotificationAsRead('solo-remota');
    await markNotificationAsUnread('solo-remota');
    expect((await getReadNotificationIds()).has('solo-remota')).toBe(false);
  });
});

describe('no leída a mano en una notificación de más de 60 días', () => {
  const old = (id: string) => ({
    id,
    title: `Vieja ${id}`,
    body: 'cuerpo',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
  });

  it('cuenta en el badge hasta que se vuelve a marcar como leída', async () => {
    const history = [old('v1')];
    expect(await getUnreadNotificationsCount(history)).toBe(0); // por antigüedad

    await markNotificationAsUnread('v1');
    expect((await getForcedUnreadIds()).has('v1')).toBe(true);
    expect(await getUnreadNotificationsCount(history)).toBe(1);

    await markNotificationAsRead('v1');
    expect((await getForcedUnreadIds()).has('v1')).toBe(false);
    expect(await getUnreadNotificationsCount(history)).toBe(0);
  });
});
