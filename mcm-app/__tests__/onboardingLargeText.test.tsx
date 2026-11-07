/**
 * Onboarding con la letra del sistema grande.
 *
 * Con el zoom de letra alto (gente mayor, sobre todo en Android), el bloque fijo
 * de arriba (icono, título y subtítulo) se comía la pantalla y la lista de
 * perfiles quedaba en una rendija: no se veían las opciones. Con letra grande
 * ese bloque va DENTRO de la lista y se va con el scroll; con letra normal,
 * todo sigue como siempre (bloque fijo FUERA de la lista).
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Las animaciones en bucle (`withRepeat(-1)`) de la bienvenida no terminan
// nunca dentro de jest: aquí se quedan en una sola pasada.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    withRepeat: (animation: unknown) => animation,
  };
});

let mockLarge = false;
jest.mock('@/hooks/useLargeText', () => ({
  __esModule: true,
  ...jest.requireActual('@/hooks/useLargeText'),
  default: () => mockLarge,
}));
jest.mock('@/contexts/ProfileConfigContext', () => ({
  useProfileConfigContext: () => ({
    rawConfig: jest.requireActual('@/constants/defaultProfileConfig')
      .DEFAULT_PROFILE_CONFIG_DATA,
  }),
}));
jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ setProfile: jest.fn() }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock('@/components/SocialLoginSection', () => () => null);
jest.mock('@/utils/analytics', () => ({
  setAnalyticsProfile: jest.fn(),
  trackEvent: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

// eslint-disable-next-line import/first
import OnboardingScreen from '@/app/onboarding';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const textOf = (node: { props: { children?: unknown } }) =>
  [node.props.children].flat().join('');

async function renderProfileStep() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <OnboardingScreen />
      </SafeAreaProvider>,
    );
  });
  // Bienvenida → «¡Vamos allá!» → paso de perfil.
  const start = tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.findAllByType(Text).some((t) => textOf(t) === '¡Vamos allá!'),
  )[0];
  expect(start).toBeDefined();
  await act(async () => {
    start!.props.onPress();
  });
  return tree;
}

function titleInsideList(tree: ReactTestRenderer) {
  const titles = tree.root
    .findAllByType(Text)
    .filter((t) => textOf(t) === '¿Quién eres? (1 minuto)');
  // Un solo título pintado, nunca los dos.
  expect(titles).toHaveLength(1);
  const lists = tree.root.findAllByType(ScrollView);
  return lists.some((l) =>
    l.findAllByType(Text).some((t) => textOf(t) === '¿Quién eres? (1 minuto)'),
  );
}

describe('onboarding y letra grande', () => {
  it('con letra normal, el título va fijo encima de la lista (como siempre)', async () => {
    mockLarge = false;
    const tree = await renderProfileStep();
    expect(titleInsideList(tree)).toBe(false);
  });

  it('con letra grande, el título va dentro de la lista y hace scroll', async () => {
    mockLarge = true;
    const tree = await renderProfileStep();
    expect(titleInsideList(tree)).toBe(true);
  });
});
