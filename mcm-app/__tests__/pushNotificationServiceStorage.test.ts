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
