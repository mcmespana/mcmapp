// Plan 08, tarea 4: la rama `comunica` de `usePushNotifications`. Un aviso del
// área no entra en la campana (ni en primer plano ni al tocarlo), refresca lo
// que toca y lleva a donde decide la app.

import React from 'react';
import { render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import usePushNotifications from '@/notifications/usePushNotifications';
import {
  saveReceivedNotificationLocally,
  markNotificationAsRead,
} from '@/services/pushNotificationService';
import {
  __resetBridgeForTests,
  onComunicaNotice,
} from '@/services/comunica/bridge';
import { trackEvent } from '@/utils/analytics';

jest.mock('@/services/pushNotificationService', () => ({
  saveTokenToFirebase: jest.fn(() => Promise.resolve()),
  cachePushToken: jest.fn(() => Promise.resolve()),
  updateLastActive: jest.fn(() => Promise.resolve()),
  saveReceivedNotificationLocally: jest.fn(() => Promise.resolve()),
  markNotificationAsRead: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/notifications/androidChannels', () => ({
  syncAndroidNotificationChannels: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/contexts/NotificationsContext', () => ({
  useNotifications: () => ({ refreshCount: jest.fn() }),
}));
jest.mock('@/hooks/useResolvedProfileConfig', () => ({
  useResolvedProfileConfig: () => ({ notificationTopics: [] }),
}));
jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => ({
    profile: { profileType: 'monitor', delegationId: null },
  }),
}));
jest.mock('@/contexts/EventSubscriptionsContext', () => ({
  useEventSubscriptions: () => ({ eventTopics: [] }),
}));
let mockMode: 'native' | 'legacy' = 'native';
jest.mock('@/hooks/comunica/useComunicaMode', () => ({
  useComunicaMode: () => mockMode,
}));
jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const ID = 'comunica:3b241101-e2bb-4255-8caf-000000000001';
const content = (data: Record<string, unknown>) => ({
  request: { content: { title: 'Novedades en C1', body: 'x', data } },
});

function Harness() {
  usePushNotifications();
  return null;
}

const listeners = () => {
  const received = (
    Notifications.addNotificationReceivedListener as jest.Mock
  ).mock.calls.at(-1)[0];
  const response = (
    Notifications.addNotificationResponseReceivedListener as jest.Mock
  ).mock.calls.at(-1)[0];
  return { received, response };
};

beforeEach(() => {
  jest.clearAllMocks();
  __resetBridgeForTests();
  mockMode = 'native';
});

describe('avisos del área en usePushNotifications', () => {
  it('en primer plano: no van a la campana y se anuncian al área', async () => {
    const heard: unknown[] = [];
    onComunicaNotice((n) => heard.push(n));
    await render(<Harness />);
    listeners().received(
      content({
        source: 'comunica',
        v: 1,
        id: ID,
        type: 'group_changed',
        groupId: 'f-grp-c1',
      }),
    );
    expect(saveReceivedNotificationLocally).not.toHaveBeenCalled();
    expect(heard).toHaveLength(1);
  });

  it('al tocarlo: destino de la app, sin campana y analítica sin ids', async () => {
    await render(<Harness />);
    listeners().response({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: content({
        source: 'comunica',
        v: 1,
        id: ID,
        type: 'rollcall_due',
        groupId: 'f-grp-c1',
        internalRoute: '/(tabs)/fotos',
      }),
    });
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/comunica/pasar-lista/[groupId]',
      params: { groupId: 'f-grp-c1' },
    });
    expect(saveReceivedNotificationLocally).not.toHaveBeenCalled();
    expect(markNotificationAsRead).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('notificacion_abierta', {
      categoria: 'comunica',
    });
  });

  it('con el área nativa apagada, a la pestaña', async () => {
    mockMode = 'legacy';
    await render(<Harness />);
    listeners().response({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: content({
        source: 'comunica',
        v: 1,
        id: ID,
        type: 'group_changed',
        groupId: 'f-grp-c1',
      }),
    });
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/comunica' });
  });

  it('los del Panel siguen yendo a la campana', async () => {
    await render(<Harness />);
    listeners().received(content({ id: 'panel-1', category: 'eventos' }));
    expect(saveReceivedNotificationLocally).toHaveBeenCalledTimes(1);
  });
});
