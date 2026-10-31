/**
 * Decisión `salud-no` (24/10/2026): si la familia dijo «no» a compartir la
 * salud, la FICHA enseña igualmente el texto que devuelva
 * `GET /v1/people/:id/health` a quien `canSeeHealth`. La marca y el globo de
 * las listas no (eso lo decide el servidor con `badges.healthNote`). Aquí se
 * comprueba que la pantalla no lo esconde por su cuenta mirando el
 * consentimiento ni la marca.
 */
/* eslint-disable @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import type { ParticipantProfile } from '@/services/comunica/contract';

let mockCanSeeHealth = true;
const PROFILE: ParticipantProfile = {
  generatedAt: '2026-10-24T13:00:00Z',
  person: {
    id: 'p-1',
    firstName: 'Lucía',
    lastName: 'Arenas Bosque',
    fullName: 'Lucía Arenas Bosque',
  },
  group: null,
  phones: {},
  guardians: [],
  // La familia ha dicho que NO a compartir la salud…
  consents: { healthData: false } as ParticipantProfile['consents'],
  // …y por eso el servidor no pone la marca en las listas.
  badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
  scarf: 'none',
  events: [],
  notices: [],
  noticeLimit: 3,
  attendance: null,
} as ParticipantProfile;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
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
jest.mock('@/services/comunica', () => ({
  comunicaNow: () => new Date('2026-10-24T13:00:00Z'),
}));
jest.mock('@/hooks/comunica/useGrupos', () => ({
  outboxKeys: { scarf: (id: string) => `scarf:${id}` },
  useParticipant: () => ({
    data: PROFILE,
    error: null,
    isPending: false,
    refetch: jest.fn(),
    generatedAt: PROFILE.generatedAt,
  }),
  useHealth: (_id: string, enabled: boolean) => ({
    data: enabled
      ? { items: [{ kind: 'allergies', text: 'Frutos secos' }] }
      : undefined,
    error: null,
  }),
  usePersonal: () => ({ data: undefined, error: null }),
  useGroupDetail: () => ({ data: undefined }),
}));
jest.mock('@/hooks/comunica/useMe', () => ({
  useMe: () => ({ me: { name: 'Ana', canSeeHealth: mockCanSeeHealth } }),
}));
jest.mock('@/hooks/comunica/useOutbox', () => ({
  useOutbox: () => ({ entries: [], outbox: null }),
}));
jest.mock('@/components/comunica/comun/PersonAvatar', () => () => null);
jest.mock('@/components/comunica/grupos/FichaAttendance', () => ({
  __esModule: true,
  default: () => null,
  useAttendance: () => ({ streak: 0 }),
}));
jest.mock('@/components/comunica/grupos/FichaNotices', () => () => null);
jest.mock('@/components/comunica/grupos/FichaParts', () => {
  const { Text: T, View: V } = require('react-native');
  return {
    FichaSection: ({
      title,
      children,
    }: {
      title: string;
      children: React.ReactNode;
    }) => (
      <V>
        <T>{title}</T>
        {children}
      </V>
    ),
    ConsentsFold: () => null,
    PersonalFold: () => null,
    ScarfBlock: () => null,
    Pager: () => null,
    openUrl: jest.fn(),
  };
});

import ParticipantScreen from '@/components/comunica/grupos/ParticipantScreen';

function shown(): string {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <HeroUINativeProvider>
          <ParticipantScreen personId="p-1" />
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
}

describe('la ficha y la salud con autorización «no»', () => {
  it('quien puede ver la salud ve el texto aunque la familia dijera que no', () => {
    mockCanSeeHealth = true;
    const text = shown();
    expect(text).toContain('Salud');
    expect(text).toContain('Frutos secos');
  });

  it('quien no puede ver la salud no la ve', () => {
    mockCanSeeHealth = false;
    expect(shown()).not.toContain('Frutos secos');
  });
});
