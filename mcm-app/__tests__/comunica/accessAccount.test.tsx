/**
 * «Entra en Comunica» con la cuenta de la app (14/11/2026, el lanzamiento):
 *
 *   · La comprobación sale sola al abrir; la persona solo pulsa «Entrar en Comunica» y entra (con la animación).
 *   · Un correo que no está en Comunica: fuera la tarjeta, el aviso con ese correo y el formulario vacío para escribir otro.
 *   · Un correo de varias fichas: al pulsar, «¿Quién eres?».
 *   · Un pase que no vale se pide otra vez a Firebase y se repite una vez (el `bad_app_token` del 14/11).
 *   · Si el servidor cerró la sesión y no se había salido a propósito, se vuelve a entrar sola; tras «Salir», no.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));
jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useTabBarClearance', () => {
  const f = (extra = 0) => 100 + extra;
  return { __esModule: true, default: f, useTabBarClearance: f };
});
let mockEmail: string | null = null;
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockEmail ? { email: mockEmail, provider: 'google' } : null,
  }),
}));
// El pase de Firebase: el falso solo mira el correo de dentro. `mockFreshOnly`:
// el que hay guardado no vale y solo sirve uno recién pedido.
let mockFreshOnly = false;
const mockGetIdToken = jest.fn(async (fresh?: boolean) => {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const email = mockFreshOnly && !fresh ? '' : mockEmail;
  return `${b64({ alg: 'RS256' })}.${b64(email ? { email } : {})}.firma`;
});
jest.mock('@/utils/firebaseAuth', () => ({
  getFirebaseAuth: () => ({
    currentUser: mockEmail ? { getIdToken: mockGetIdToken } : null,
  }),
}));

import AccessScreen from '@/components/comunica/acceso/AccessScreen';
import { WELCOME_MS } from '@/components/comunica/acceso/WelcomeOverlay';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import {
  __resetSessionForTests,
  APP_ACCOUNT_OPT_OUT_KEY,
  getSessionState,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
const byLabel = (tree: ReactTestRenderer, label: string, prop: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props[prop] === 'function' &&
      n.props.accessibilityLabel === label,
  );
const press = async (tree: ReactTestRenderer, label: string) => {
  const b = byLabel(tree, label, 'onPress').at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  await act(async () => {
    b.props.onPress();
  });
};
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

let tree: ReactTestRenderer;
let fake: FakeServer;

async function open(email: string | null, revoked = false) {
  mockEmail = email;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <AccessScreen revoked={revoked} />
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  // La comprobación de fondo.
  await wait(20);
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockFreshOnly = false;
  await AsyncStorage.clear();
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0 });
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
  });
  __resetComunicaApiForTests();
  __resetSessionForTests();
});

describe('«Entra en Comunica» con la cuenta de la app', () => {
  it('enseña el correo y un botón; al pulsar, la entrada y dentro', async () => {
    await open('monitor@ejemplo.org');
    const t = texts(tree);
    expect(t).toContain('Tienes la sesión iniciada con');
    expect(t).toContain('monitor@ejemplo.org');
    expect(t).toContain('La sesión se quedará abierta en la app.');
    // Sin pulsar no se entra.
    expect(getSessionState().status).not.toBe('signedIn');
    await press(tree, 'Entrar en Comunica');
    expect(texts(tree)).toMatch(/¡Hola, /);
    await wait(WELCOME_MS + 50);
    expect(getSessionState().status).toBe('signedIn');
  });

  it('un correo que no está: el aviso con ese correo y el formulario vacío para otro', async () => {
    await open('nadie@ejemplo.org');
    const t = texts(tree);
    expect(t).toContain('nadie@ejemplo.org no está en Comunica.');
    expect(t).toContain('Escribe el correo que tiene tu delegación.');
    expect(t).not.toContain('Tienes la sesión iniciada con');
    expect(byLabel(tree, 'Tu correo', 'onChangeText')[0].props.value).toBe('');
    expect(
      byLabel(tree, 'Entrar con el DNI', 'onPress').length,
    ).toBeGreaterThan(0);
  });

  it('un correo de varias fichas: al pulsar, «¿Quién eres?»', async () => {
    await open('dos@ejemplo.org');
    await press(tree, 'Entrar en Comunica');
    await wait(10);
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/comunica/acceso-elegir' }),
    );
  });

  it('un pase que no vale se pide otra vez a Firebase y entra', async () => {
    mockFreshOnly = true;
    await open('monitor@ejemplo.org');
    expect(mockGetIdToken).toHaveBeenCalledWith(true);
    await press(tree, 'Entrar en Comunica');
    await wait(WELCOME_MS + 50);
    expect(getSessionState().status).toBe('signedIn');
  });

  it('«Usar otro correo» y «Entrar con el DNI» siempre a mano; se puede volver a la cuenta', async () => {
    await open('monitor@ejemplo.org');
    await press(tree, 'Entrar con el DNI');
    expect(
      byLabel(tree, 'Tu DNI o NIE', 'onChangeText').length,
    ).toBeGreaterThan(0);
    await press(tree, 'Entrar como monitor@ejemplo.org');
    expect(texts(tree)).toContain('Tienes la sesión iniciada con');
    await press(tree, 'Usar otro correo');
    expect(byLabel(tree, 'Tu correo', 'onChangeText').length).toBeGreaterThan(
      0,
    );
  });

  it('sin cuenta de la app: el formulario del código', async () => {
    await open(null);
    expect(texts(tree)).toContain('Te mandamos un código a tu correo.');
    expect(texts(tree)).not.toContain('Tienes la sesión iniciada con');
  });

  it('el servidor cerró la sesión: se vuelve a entrar sola', async () => {
    await open('monitor@ejemplo.org', true);
    await wait(WELCOME_MS + 50);
    expect(getSessionState().status).toBe('signedIn');
  });

  it('…pero no si había salido a propósito', async () => {
    await AsyncStorage.setItem(APP_ACCOUNT_OPT_OUT_KEY, '1');
    await open('monitor@ejemplo.org', true);
    await wait(WELCOME_MS + 50);
    expect(getSessionState().status).not.toBe('signedIn');
    expect(texts(tree)).toContain('Tienes la sesión iniciada con');
  });
});
