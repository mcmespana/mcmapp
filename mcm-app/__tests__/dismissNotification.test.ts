import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dismissNotification,
  getDismissedNotificationKeys,
  getLocalNotificationsHistory,
} from '@/services/pushNotificationService';

const HISTORY_KEY = '@mcm_notifications_history';

const makeLocal = (id: string, title: string, body: string) => ({
  id,
  title,
  body,
  receivedAt: new Date().toISOString(),
  isRead: false,
});

describe('dismissNotification', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('quita la notificación del historial local', async () => {
    const a = makeLocal('1', 'Hola', 'Cuerpo A');
    const b = makeLocal('2', 'Adiós', 'Cuerpo B');
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([a, b]));

    await dismissNotification(a);

    const remaining = await getLocalNotificationsHistory();
    expect(remaining.map((n) => n.id)).toEqual(['2']);
  });

  it('registra id y clave de contenido como descartados', async () => {
    const a = makeLocal('1', 'Hola', 'Cuerpo A');
    await dismissNotification(a);

    const dismissed = await getDismissedNotificationKeys();
    expect(dismissed.has('1')).toBe(true);
    expect(dismissed.has('Hola|Cuerpo A')).toBe(true);
  });

  it('descarta también un duplicado de Firebase con otro id pero mismo contenido', async () => {
    const local = makeLocal('local-1', 'Evento', 'Mañana a las 10');
    await dismissNotification(local);

    const dismissed = await getDismissedNotificationKeys();
    // El equivalente de Firebase llega con otro id pero mismo título+cuerpo:
    // su clave de contenido ya está descartada, así que quedaría oculto.
    expect(dismissed.has('Evento|Mañana a las 10')).toBe(true);
  });

  it('acumula varias notificaciones descartadas', async () => {
    await dismissNotification(makeLocal('1', 'A', 'a'));
    await dismissNotification(makeLocal('2', 'B', 'b'));

    const dismissed = await getDismissedNotificationKeys();
    expect(dismissed.has('1')).toBe(true);
    expect(dismissed.has('2')).toBe(true);
  });
});
