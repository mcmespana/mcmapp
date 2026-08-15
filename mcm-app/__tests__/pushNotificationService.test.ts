/**
 * Tests de `services/pushNotificationService.ts` — la parte que NO cubren ya
 * `dismissNotification.test.ts` (borrado) ni
 * `pushNotificationServiceStorage.test.ts` (concurrencia del historial).
 *
 * Aquí se cubre lo que decide si llega una notificación y si el badge dice la
 * verdad:
 *  - el registro del token en Firebase (id derivado del token, sin `undefined`
 *    en el payload — RTDB rechaza el nodo entero si se cuela uno),
 *  - `updateLastActive`, que además hace de red de seguridad reescribiendo el
 *    token si el nodo se perdió,
 *  - la normalización del historial remoto (botón único legacy vs array),
 *  - el contador de no leídas: dedupe local/Firebase, marcadas como leídas y
 *    la regla de los 60 días,
 *  - la inicialización de usuario nuevo (deja 3 sin leer, marca el resto).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { set, get, update, onValue, ref } from 'firebase/database';
import {
  getDeviceId,
  cachePushToken,
  getCachedPushToken,
  saveTokenToFirebase,
  updateLastActive,
  getNotificationsHistory,
  subscribeToNotifications,
  getUnreadNotificationsCount,
  isNotificationOlderThan60Days,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getReadNotificationIds,
  getLocalNotificationsHistory,
  saveReceivedNotificationLocally,
  initializeNewUserReadStatus,
} from '@/services/pushNotificationService';
import type {
  NotificationData,
  ReceivedNotification,
} from '@/types/notifications';

jest.mock('@/utils/firebaseApp', () => ({ getFirebaseApp: () => ({}) }));

const HISTORY_KEY = '@mcm_notifications_history';
const READ_KEY = '@mcm_read_notifications';

const mSet = set as unknown as jest.Mock;
const mGet = get as unknown as jest.Mock;
const mUpdate = update as unknown as jest.Mock;
const mOnValue = onValue as unknown as jest.Mock;
const mRef = ref as unknown as jest.Mock;

/** Snapshot mínimo con el que se conforma el servicio. */
const snap = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

function remota(
  id: string,
  createdAt: string,
  extra: Partial<NotificationData> = {},
): NotificationData {
  return {
    id,
    title: `T-${id}`,
    body: `B-${id}`,
    createdAt,
    ...extra,
  } as NotificationData;
}

function local(
  id: string,
  receivedAt: string,
  extra: Partial<ReceivedNotification> = {},
): ReceivedNotification {
  return {
    id,
    title: `T-${id}`,
    body: `B-${id}`,
    receivedAt,
    isRead: false,
    ...extra,
  } as ReceivedNotification;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mSet.mockResolvedValue(undefined);
  mUpdate.mockResolvedValue(undefined);
});

describe('identidad del dispositivo y token cacheado', () => {
  it('getDeviceId genera un id y lo reutiliza en la siguiente llamada', async () => {
    const primero = await getDeviceId();
    expect(primero).toMatch(/^device_\d+_/);
    expect(await getDeviceId()).toBe(primero);
  });

  it('cachePushToken lo persiste y getCachedPushToken lo recupera', async () => {
    await cachePushToken('ExponentPushToken[abc]');
    expect(await AsyncStorage.getItem('@mcm_push_token')).toBe(
      'ExponentPushToken[abc]',
    );
    expect(await getCachedPushToken()).toBe('ExponentPushToken[abc]');
  });
});

describe('saveTokenToFirebase', () => {
  it('usa el token saneado como id del nodo', async () => {
    await saveTokenToFirebase('ExponentPushToken[abc-123]');
    expect(mRef).toHaveBeenCalledWith(
      expect.anything(),
      'pushTokens/token_ExponentPushToken_abc_123_',
    );
  });

  it('no manda ningún undefined en el payload (RTDB rechaza el nodo entero)', async () => {
    await saveTokenToFirebase('tok');
    const payload = mSet.mock.calls[0][1];
    expect(JSON.stringify(payload)).not.toContain('undefined');
    expect(payload.profileType).toBeNull();
    expect(payload.delegationId).toBeNull();
    expect(payload.topics).toEqual([]);
    expect(typeof payload.registeredAt).toBe('string');
    expect(typeof payload.deviceInfo.osVersion).toBe('string');
  });

  it('incluye la metadata de perfil cuando se pasa', async () => {
    await saveTokenToFirebase('tok', {
      profileType: 'monitor',
      delegationId: 'madrid',
      topics: ['general', 'eventos'],
    });
    const payload = mSet.mock.calls[0][1];
    expect(payload.profileType).toBe('monitor');
    expect(payload.delegationId).toBe('madrid');
    expect(payload.topics).toEqual(['general', 'eventos']);
  });

  it('propaga el error si Firebase falla (el caller debe enterarse)', async () => {
    mSet.mockRejectedValueOnce(new Error('permission_denied'));
    await expect(saveTokenToFirebase('tok')).rejects.toThrow(
      'permission_denied',
    );
  });
});

describe('updateLastActive', () => {
  it('sin token en caché no escribe nada (evita nodos zombi)', async () => {
    // El token vive en una variable de módulo, así que hace falta una copia
    // limpia del servicio para simular un arranque sin token.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresco = require('@/services/pushNotificationService');
    await fresco.updateLastActive();
    expect(mSet).not.toHaveBeenCalled();
    expect(mUpdate).not.toHaveBeenCalled();
  });

  it('actualiza lastActive si el nodo ya existe', async () => {
    await cachePushToken('tok');
    mGet.mockResolvedValueOnce(
      snap({ token: 'tok', registeredAt: '2026-01-01T00:00:00.000Z' }),
    );
    await updateLastActive();
    expect(mSet).not.toHaveBeenCalled();
    expect(mUpdate).toHaveBeenCalledTimes(1);
    expect(Object.keys(mUpdate.mock.calls[0][1])).toEqual(['lastActive']);
  });

  it('propaga los cambios de perfil al nodo existente', async () => {
    await cachePushToken('tok');
    mGet.mockResolvedValueOnce(snap({ token: 'tok' }));
    await updateLastActive({
      profileType: 'familia',
      delegationId: null,
      topics: ['general'],
    });
    expect(mUpdate.mock.calls[0][1]).toMatchObject({
      profileType: 'familia',
      delegationId: null,
      topics: ['general'],
    });
  });

  it('reescribe el token si el nodo se perdió, conservando registeredAt', async () => {
    await cachePushToken('tok');
    mGet.mockResolvedValueOnce(snap({ registeredAt: '2025-05-05T00:00:00Z' }));
    await updateLastActive();
    expect(mUpdate).not.toHaveBeenCalled();
    expect(mSet).toHaveBeenCalledTimes(1);
    expect(mSet.mock.calls[0][1].registeredAt).toBe('2025-05-05T00:00:00Z');
    expect(mSet.mock.calls[0][1].token).toBe('tok');
  });

  it('escribe el nodo entero si no existía', async () => {
    await cachePushToken('tok');
    mGet.mockResolvedValueOnce(snap(null));
    await updateLastActive();
    expect(mSet).toHaveBeenCalledTimes(1);
  });

  it('un fallo de Firebase no propaga (es una actualización de fondo)', async () => {
    await cachePushToken('tok');
    mGet.mockRejectedValueOnce(new Error('offline'));
    await expect(updateLastActive()).resolves.toBeUndefined();
  });
});

describe('getNotificationsHistory', () => {
  it('devuelve lista vacía si no hay nodo', async () => {
    mGet.mockResolvedValueOnce(snap(null));
    expect(await getNotificationsHistory()).toEqual([]);
  });

  it('ordena de más reciente a más antigua', async () => {
    mGet.mockResolvedValueOnce(
      snap({
        vieja: { title: 'v', body: 'v', createdAt: '2026-01-01T00:00:00Z' },
        nueva: { title: 'n', body: 'n', createdAt: '2026-08-01T00:00:00Z' },
      }),
    );
    const res = await getNotificationsHistory();
    expect(res.map((n) => n.id)).toEqual(['nueva', 'vieja']);
  });

  it('usa la clave del nodo como id si el registro no trae uno', async () => {
    mGet.mockResolvedValueOnce(
      snap({ clave: { title: 't', body: 'b', createdAt: '2026-01-01' } }),
    );
    expect((await getNotificationsHistory())[0].id).toBe('clave');
  });

  it('unifica el botón legacy en el array actionButtons', async () => {
    mGet.mockResolvedValueOnce(
      snap({
        a: {
          title: 't',
          body: 'b',
          createdAt: '2026-01-01',
          actionButton: { text: 'Abrir', url: 'https://x' },
        },
      }),
    );
    const n = (await getNotificationsHistory())[0];
    expect(n.actionButtons).toHaveLength(1);
    expect(n.actionButton).toEqual(n.actionButtons![0]);
  });

  it('devuelve lista vacía (no revienta) si Firebase falla', async () => {
    mGet.mockRejectedValueOnce(new Error('offline'));
    expect(await getNotificationsHistory()).toEqual([]);
  });
});

describe('subscribeToNotifications', () => {
  it('entrega las notificaciones ordenadas en cada emisión', () => {
    const cb = jest.fn();
    let emitir: (s: unknown) => void = () => {};
    mOnValue.mockImplementationOnce((_ref: unknown, handler: any) => {
      emitir = handler;
      return jest.fn();
    });
    subscribeToNotifications(cb);
    emitir(
      snap({
        a: { title: 'a', body: 'a', createdAt: '2026-01-01T00:00:00Z' },
        b: { title: 'b', body: 'b', createdAt: '2026-02-01T00:00:00Z' },
      }),
    );
    expect(cb.mock.calls[0][0].map((n: NotificationData) => n.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('entrega lista vacía si el nodo no existe', () => {
    const cb = jest.fn();
    mOnValue.mockImplementationOnce((_r: unknown, handler: any) => {
      handler(snap(null));
      return jest.fn();
    });
    subscribeToNotifications(cb);
    expect(cb).toHaveBeenCalledWith([]);
  });

  it('devuelve la función de baja de onValue', () => {
    const unsub = jest.fn();
    mOnValue.mockReturnValueOnce(unsub);
    expect(subscribeToNotifications(jest.fn())).toBe(unsub);
  });

  it('devuelve un no-op si la suscripción falla', () => {
    mOnValue.mockImplementationOnce(() => {
      throw new Error('sin permisos');
    });
    expect(() => subscribeToNotifications(jest.fn())()).not.toThrow();
  });
});

describe('isNotificationOlderThan60Days', () => {
  it('sin fecha, no cuenta como vieja', () => {
    expect(isNotificationOlderThan60Days(undefined)).toBe(false);
  });

  it('distingue por el umbral de 60 días', () => {
    const hace = (d: number) =>
      new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
    expect(isNotificationOlderThan60Days(hace(59))).toBe(false);
    expect(isNotificationOlderThan60Days(hace(61))).toBe(true);
  });
});

describe('marcar como leídas', () => {
  it('markNotificationAsRead marca también los duplicados por contenido', async () => {
    await saveReceivedNotificationLocally(local('1', '2026-08-01T10:00:00Z'));
    // Mismo contenido, otro id y fuera de la ventana de dedupe de 5 min.
    await saveReceivedNotificationLocally({
      ...local('1', '2026-08-01T12:00:00Z'),
      id: '2',
    });
    await markNotificationAsRead('1');
    const hist = await getLocalNotificationsHistory();
    expect(hist.every((n) => n.isRead)).toBe(true);
    expect(await getReadNotificationIds()).toEqual(new Set(['1']));
  });

  it('markAllNotificationsAsRead acumula los ids leídos', async () => {
    await saveReceivedNotificationLocally(local('1', '2026-08-01T10:00:00Z'));
    await saveReceivedNotificationLocally(local('2', '2026-08-01T11:00:00Z'));
    await markAllNotificationsAsRead(['1', '2', '99']);
    const ids = await getReadNotificationIds();
    expect(ids).toEqual(new Set(['1', '2', '99']));
    const hist = await getLocalNotificationsHistory();
    expect(hist.every((n) => n.isRead)).toBe(true);
  });

  it('marcar sin historial local guarda igualmente los ids', async () => {
    await markNotificationAsRead('solo-remota');
    expect(await getReadNotificationIds()).toEqual(new Set(['solo-remota']));
  });
});

describe('getUnreadNotificationsCount', () => {
  const hoy = () => new Date().toISOString();

  it('cuenta local + Firebase sin repetir el mismo contenido', async () => {
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([local('1', hoy())]),
    );
    mGet.mockResolvedValueOnce(
      // 'T-1|B-1' es el mismo contenido que la local → no debe contarse dos veces.
      snap({
        1: { title: 'T-1', body: 'B-1', createdAt: hoy() },
        2: { title: 'T-2', body: 'B-2', createdAt: hoy() },
      }),
    );
    expect(await getUnreadNotificationsCount()).toBe(2);
  });

  it('descuenta las marcadas como leídas', async () => {
    await AsyncStorage.setItem(READ_KEY, JSON.stringify(['2']));
    mGet.mockResolvedValueOnce(
      snap({
        1: { title: 'T-1', body: 'B-1', createdAt: hoy() },
        2: { title: 'T-2', body: 'B-2', createdAt: hoy() },
      }),
    );
    expect(await getUnreadNotificationsCount()).toBe(1);
  });

  it('descuenta las locales con isRead', async () => {
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ ...local('1', hoy()), isRead: true }]),
    );
    mGet.mockResolvedValueOnce(snap(null));
    expect(await getUnreadNotificationsCount()).toBe(0);
  });

  it('no cuenta las de más de 60 días', async () => {
    const vieja = new Date(
      Date.now() - 70 * 24 * 60 * 60 * 1000,
    ).toISOString();
    mGet.mockResolvedValueOnce(
      snap({ 1: { title: 'T', body: 'B', createdAt: vieja } }),
    );
    expect(await getUnreadNotificationsCount()).toBe(0);
  });

  it('aplica el filtro de audiencia sobre las de Firebase', async () => {
    mGet.mockResolvedValueOnce(
      snap({
        1: { title: 'T-1', body: 'B-1', createdAt: hoy() },
        2: { title: 'T-2', body: 'B-2', createdAt: hoy() },
      }),
    );
    const count = await getUnreadNotificationsCount((n) => n.id === '1');
    expect(count).toBe(1);
  });

  it('devuelve 0 si algo peta', async () => {
    await AsyncStorage.setItem(HISTORY_KEY, 'no-json');
    mGet.mockResolvedValueOnce(snap(null));
    expect(await getUnreadNotificationsCount()).toBe(0);
  });
});

describe('initializeNewUserReadStatus', () => {
  const reciente = (dias: number) =>
    new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  it('deja sin leer las 3 más recientes y marca el resto', async () => {
    const notifs = [
      remota('a', reciente(1)),
      remota('b', reciente(2)),
      remota('c', reciente(3)),
      remota('d', reciente(4)),
      remota('e', reciente(5)),
    ];
    expect(await initializeNewUserReadStatus(notifs)).toBe(true);
    expect(await getReadNotificationIds()).toEqual(new Set(['d', 'e']));
  });

  it('las de más de 4 meses se marcan aunque estén entre las 3 primeras', async () => {
    const notifs = [remota('vieja', reciente(200)), remota('nueva', reciente(1))];
    await initializeNewUserReadStatus(notifs);
    expect(await getReadNotificationIds()).toEqual(new Set(['vieja']));
  });

  it('solo se ejecuta una vez', async () => {
    expect(await initializeNewUserReadStatus([remota('a', reciente(1))])).toBe(
      true,
    );
    expect(await initializeNewUserReadStatus([remota('b', reciente(1))])).toBe(
      false,
    );
  });

  it('con 3 o menos no marca ninguna', async () => {
    await initializeNewUserReadStatus([
      remota('a', reciente(1)),
      remota('b', reciente(2)),
    ]);
    expect(await getReadNotificationIds()).toEqual(new Set());
  });
});
