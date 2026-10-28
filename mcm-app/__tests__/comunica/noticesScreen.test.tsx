/**
 * Plan 08, tarea 7: «Avisos en este móvil» con permiso concedido, denegado y
 * con el alta esperando en la cola (sin conexión).
 */
/* eslint-disable import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Switch, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

let mockPermission: 'granted' | 'denied' | 'undetermined' = 'granted';
let mockUpload: { status: string } | undefined;
const mockSetPref = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useTabBarClearance', () => {
  const f = (extra = 0) => 100 + extra;
  return { __esModule: true, default: f, useTabBarClearance: f };
});
jest.mock('@/components/tabs/useTabScroll', () => ({
  useTabScroll: () => ({
    scrollRef: { current: null },
    onScroll: undefined,
    contentPaddingBottom: 100,
  }),
}));
jest.mock('@/notifications/usePushNotifications', () => ({
  tryRegisterPushToken: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/comunica/localNotices', () => ({
  localNoticesAvailable: true,
  readNoticePermission: () => Promise.resolve(mockPermission),
  requestNoticePermission: () => Promise.resolve(mockPermission),
}));
jest.mock('@/hooks/comunica/useNoticePrefs', () => ({
  useNoticePrefs: () => ({
    prefs: { rollCallDue: true, groupChanges: false, outboxReminder: true },
    loaded: true,
    setPref: mockSetPref,
  }),
}));
jest.mock('@/hooks/comunica/useOutbox', () => ({
  useOutbox: () => ({ get: () => mockUpload, outbox: null }),
}));

import NoticesScreen from '@/components/comunica/avisos/NoticesScreen';

async function mount() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <HeroUINativeProvider>
          <NoticesScreen />
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  const text = tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
  return { tree, text, switches: tree.root.findAllByType(Switch) };
}

beforeEach(() => {
  mockPermission = 'granted';
  mockUpload = undefined;
  mockSetPref.mockClear();
});

describe('«Avisos en este móvil»', () => {
  it('concedido: tres interruptores con su preferencia y explicación', async () => {
    const { text, switches } = await mount();
    expect(text).toContain('Los avisos están activados en este móvil');
    expect(text).toContain('¿Has pasado lista?');
    expect(text).toContain('Listas sin subir');
    expect(text).toContain('Novedades en tu grupo');
    expect(switches.map((s) => s.props.value)).toEqual([true, true, false]);
    expect(switches.every((s) => !s.props.disabled)).toBe(true);
    await act(async () => switches[2].props.onValueChange(true));
    expect(mockSetPref).toHaveBeenCalledWith('groupChanges', true);
  });

  it('denegado: «Abrir Ajustes» y los interruptores apagados', async () => {
    mockPermission = 'denied';
    const { text, switches } = await mount();
    expect(text).toContain('Los avisos están desactivados');
    expect(text).toContain('Primero activa los avisos de MCM App en Ajustes.');
    expect(text).toContain('Abrir Ajustes');
    expect(switches.every((s) => s.props.disabled && !s.props.value)).toBe(
      true,
    );
  });

  it('sin pedir aún: «Activar los avisos»', async () => {
    mockPermission = 'undetermined';
    const { text } = await mount();
    expect(text).toContain('Activar los avisos');
  });

  it('sin conexión: el alta espera en la cola y se dice', async () => {
    mockUpload = { status: 'pending' };
    const { text } = await mount();
    expect(text).toContain('Guardada en el móvil');
  });
});
