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
