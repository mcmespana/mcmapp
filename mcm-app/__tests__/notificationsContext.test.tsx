/**
 * Tests de `NotificationsContext`: el contador de no leídas y el historial
 * visible del centro de notificaciones. Dos reglas importantes que no puede
 * ver un test del servicio en solitario:
 *
 *  - El historial se filtra por AUDIENCIA (perfil/delegación/evento) antes de
 *    mostrarse: sin esto, cualquiera vería avisos dirigidos a otro perfil.
 *  - El contador se refresca solo al volver la app a primer plano (AppState),
 *    no solo al montar — si no, el badge se queda con un número viejo tras
 *    recibir un push con la app en background.
 *
 * `services/pushNotificationService` y los contextos/hooks de los que
 * depende la audiencia van mockeados: aquí solo se testea la orquestación.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  getUnreadNotificationsCount,
  subscribeToNotifications,
  getReadNotificationIds,
} from '@/services/pushNotificationService';
import {
  NotificationsProvider,
  useNotifications,
} from '@/contexts/NotificationsContext';
import type { ProfileType } from '@/types/profileConfig';

jest.mock('@/services/pushNotificationService', () => ({
  getUnreadNotificationsCount: jest.fn(() => Promise.resolve(0)),
  subscribeToNotifications: jest.fn(() => jest.fn()),
  getReadNotificationIds: jest.fn(() => Promise.resolve(new Set())),
}));

let mockProfile: {
  profileType: ProfileType | null;
  delegationId: string | null;
} = { profileType: 'miembro', delegationId: null };
jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ profile: mockProfile }),
}));

let mockEventTopics: string[] = [];
jest.mock('@/contexts/EventSubscriptionsContext', () => ({
  useEventSubscriptions: () => ({ eventTopics: mockEventTopics }),
}));

let mockNotificationTopics: string[] = [];
jest.mock('@/hooks/useResolvedProfileConfig', () => ({
  useResolvedProfileConfig: () => ({
    notificationTopics: mockNotificationTopics,
  }),
}));

let onChangeCallback: ((state: string) => void) | null = null;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

async function mount() {
  return renderHook(() => useNotifications(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = { profileType: 'miembro', delegationId: null };
  mockEventTopics = [];
  mockNotificationTopics = [];
  onChangeCallback = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(
    (_event: any, cb: any) => {
      onChangeCallback = cb;
      return { remove: jest.fn() } as any;
    },
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('contador de no leídas', () => {
  it('llama a updateCount al montar y expone el resultado', async () => {
    (getUnreadNotificationsCount as jest.Mock).mockResolvedValueOnce(3);
    (getReadNotificationIds as jest.Mock).mockResolvedValueOnce(
      new Set(['a', 'b']),
    );
    const { result } = await mount();
    await waitFor(() => expect(result.current.unreadCount).toBe(3));
    expect(result.current.readIds).toEqual(new Set(['a', 'b']));
  });

  it('no revienta si el servicio falla', async () => {
    (getUnreadNotificationsCount as jest.Mock).mockRejectedValueOnce(
      new Error('sin red'),
    );
    const { result } = await mount();
    await waitFor(() => expect(getUnreadNotificationsCount).toHaveBeenCalled());
    expect(result.current.unreadCount).toBe(0);
  });

  it('refreshCount y markAllRefresh vuelven a pedir el contador', async () => {
    const { result } = await mount();
    await waitFor(() => expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1));
    await act(async () => result.current.refreshCount());
    expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(2);
    await act(async () => result.current.markAllRefresh());
    expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(3);
  });

  it('vuelve a pedir el contador cuando la app pasa a primer plano', async () => {
    const { result } = await mount();
    await waitFor(() => expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1));
    expect(onChangeCallback).not.toBeNull();
    await act(async () => onChangeCallback!('active'));
    expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(2);
  });

  it('NO vuelve a pedir el contador si la app pasa a background', async () => {
    const { result } = await mount();
    await waitFor(() => expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1));
    await act(async () => onChangeCallback!('background'));
    expect(getUnreadNotificationsCount).toHaveBeenCalledTimes(1);
    expect(result.current.unreadCount).toBe(0);
  });
});

describe('historial filtrado por audiencia', () => {
  it('oculta del historial visible las notificaciones de otro perfil', async () => {
    let onNotifications: ((n: any[]) => void) | null = null;
    (subscribeToNotifications as jest.Mock).mockImplementation((cb) => {
      onNotifications = cb;
      return jest.fn();
    });
    mockProfile = { profileType: 'monitor', delegationId: null };

    const { result } = await mount();
    const paraMi = {
      id: '1',
      audience: { match: 'all', todos: false, perfiles: ['monitor'], delegaciones: [], eventId: null },
    };
    const paraOtro = {
      id: '2',
      audience: { match: 'all', todos: false, perfiles: ['familia'], delegaciones: [], eventId: null },
    };
    const sinAudiencia = { id: '3' };

    await act(async () => onNotifications!([paraMi, paraOtro, sinAudiencia]));

    const ids = result.current.firebaseNotifications.map((n: any) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['1', '3']));
    expect(ids).not.toContain('2');
  });

  it('muestra notificaciones de evento solo si el usuario está suscrito a ese evento', async () => {
    let onNotifications: ((n: any[]) => void) | null = null;
    (subscribeToNotifications as jest.Mock).mockImplementation((cb) => {
      onNotifications = cb;
      return jest.fn();
    });
    mockEventTopics = ['event-jubileo2025'];

    const { result } = await mount();
    const deMiEvento = {
      id: '1',
      audience: { match: 'all', todos: false, perfiles: [], delegaciones: [], eventId: 'jubileo2025' },
    };
    const deOtroEvento = {
      id: '2',
      audience: { match: 'all', todos: false, perfiles: [], delegaciones: [], eventId: 'otro-evento' },
    };

    await act(async () => onNotifications!([deMiEvento, deOtroEvento]));

    const ids = result.current.firebaseNotifications.map((n: any) => n.id);
    expect(ids).toEqual(['1']);
  });
});

describe('fuera del provider', () => {
  it('devuelve los defaults sin reventar', async () => {
    const { result } = await renderHook(() => useNotifications());
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.firebaseNotifications).toEqual([]);
    expect(result.current.readIds).toEqual(new Set());
    expect(() => result.current.refreshCount()).not.toThrow();
  });
});
