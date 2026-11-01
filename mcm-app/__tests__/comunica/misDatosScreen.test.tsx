/**
 * «Mis datos» y «Datos de Lucía» con el CABLEADO REAL (plan 12, tareas 5-7 y
 * los tests de pantalla): el proveedor del área, los hooks y el servidor
 * falso. A quién se ve lo da un `ActiveProfileContext` fijo (el proveedor del
 * plan 11 tiene sus propios tests).
 *
 *   · El miembro ve MCM (y «Nivel COM» con la etapa COM); el hijo no.
 *   · Guardar solo el móvil escribe un campo (el contador del falso).
 *   · Sin conexión, «Guardar» apagado y los cambios siguen ahí.
 *   · Otro `pid`: 403.
 *   · `completar=pago`: quien no tiene DNI lo escribe; quien lo tiene, no.
 *   · Nada de los datos ni de la salud llega a lo que se guarda en el móvil.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import { onlineManager, QueryClient } from '@tanstack/react-query';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockParams: { pid?: string; completar?: string } = {};
jest.mock('expo-router', () => {
  const { Text: T } = require('react-native');
  return {
    Stack: {
      Screen: ({ options }: { options?: { title?: string } }) => (
        <T>{`título:${options?.title ?? ''}`}</T>
      ),
    },
    useRouter: () => mockRouter,
    usePreventRemove: jest.fn(),
    useLocalSearchParams: () => mockParams,
  };
});
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
jest.mock('@/components/tabs/useTabScroll', () => ({
  useTabScroll: (_n: string, extra = 0) => ({
    scrollRef: { current: null },
    onScroll: undefined,
    contentPaddingBottom: 100 + extra,
  }),
}));
jest.mock('@/components/BottomSheet', () => {
  const { Text: T, View: V } = require('react-native');
  return ({
    visible,
    title,
    children,
  }: {
    visible: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    visible ? (
      <V>
        <T>{title}</T>
        {children}
      </V>
    ) : null;
});
const mockToast = jest.fn();
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToast } }),
}));
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.clearDiskCache = jest.fn().mockResolvedValue(true);
  Image.clearMemoryCache = jest.fn().mockResolvedValue(true);
  return { Image };
});
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import PersonDetailsScreen, {
  resolveDetailsPid,
} from '@/components/comunica/datos/PersonDetailsScreen';
import {
  ActiveProfileContext,
  type ActiveProfile,
} from '@/hooks/comunica/useActiveProfile';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import { dehydrateArea } from '@/services/comunica/persist';
import { __resetSessionForTests, signIn } from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { nativeHrefFor } from '@/services/comunica/links';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
const touchable = (tree: ReactTestRenderer, label: string) => {
  const b = tree.root
    .findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === label,
      { deep: false },
    )
    .at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  return b;
};
const press = async (tree: ReactTestRenderer, label: string) => {
  await act(async () => {
    touchable(tree, label).props.onPress();
  });
};
const input = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onChangeText === 'function',
  )[0];
const until = async (fn: () => boolean, ms = 3000) => {
  for (let i = 0; i < ms / 25; i++) {
    if (fn()) return;
    await wait(25);
  }
  throw new Error('No ha pasado a tiempo');
};

function activeFor(fake: FakeServer, persona: PersonaId): ActiveProfile {
  const selfId = fake.data.personas[persona].personId;
  const self = { id: selfId, firstName: 'Yo', lastName: null, gender: null };
  return {
    ready: true,
    pid: selfId,
    profile: self,
    self,
    children: [],
    hasChildren: false,
    viewingSelf: true,
    audience: 'member',
    member: true,
    chosen: true,
    mustChoose: false,
    childFirstName: '',
    choose: () => {},
    profilesQuery: null,
    registerScope: () => () => {},
    currentScope: () => null,
  };
}

async function setup(
  persona: PersonaId,
  params: { pid?: string; completar?: string } = {},
) {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0 });
  const s = fake.issueSession(persona);
  await signIn(s, s.me);
  Object.keys(mockParams).forEach(
    (k) => delete mockParams[k as keyof typeof mockParams],
  );
  Object.assign(mockParams, { pid: 'yo', ...params });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <ComunicaAreaProvider client={qc}>
            <ActiveProfileContext.Provider value={activeFor(fake, persona)}>
              <PersonDetailsScreen />
            </ActiveProfileContext.Provider>
          </ComunicaAreaProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return { fake, qc, tree };
}

afterEach(() => {
  onlineManager.setOnline(true);
  __resetComunicaApiForTests();
  __resetSessionForTests();
  jest.clearAllMocks();
});

describe('Mis datos', () => {
  it('el miembro ve MCM con «Nivel COM» y guardar el móvil escribe un campo', async () => {
    const { fake, tree, qc } = await setup('member');
    await until(() => texts(tree).includes('Datos de contacto'));
    const t = texts(tree);
    expect(t).toContain('título:Mis datos');
    expect(t).toContain('MCM');
    expect(t).toContain('Nivel COM');
    expect(t).toContain('Si tienes, usa el correo');
    expect(t).toContain('5 de mayo de 2008');
    expect(touchable(tree, 'Guardar').props.isDisabled).toBe(true);

    await act(async () =>
      input(tree, 'Móvil').props.onChangeText('699 000 111'),
    );
    expect(touchable(tree, 'Guardar').props.isDisabled).toBe(false);
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'success',
      label: 'Los datos se han guardado correctamente.',
    });
    expect(fake.detailWrites()).toEqual({ 'contact.mobile': 1 });
    expect(input(tree, 'Móvil').props.value).toBe('699 000 111');
    expect(touchable(tree, 'Guardar').props.isDisabled).toBe(true);

    // Nada de esto va a lo que se guarda en el móvil.
    const saved = JSON.stringify(dehydrateArea(qc));
    expect(saved).not.toContain('699 000 111');
    expect(saved).not.toContain('elena.prieto');
    act(() => tree.unmount());
    qc.clear();
  });

  it('viendo a un hijo: sin MCM, con salud y las autorizaciones sin contestar', async () => {
    const { fake, tree, qc } = await setup('guardianTwo', {
      pid: 'f-fam-lucia',
    });
    await until(() =>
      tree.root
        .findAll((n) => n.props.value === 'Polen de olivo')
        .some(() => true),
    );
    const t = texts(tree);
    expect(t).toContain('título:Datos de Lucía');
    expect(t).toContain('Estos son los datos que tenemos de ');
    expect(t).not.toContain('Pertenezco al MCM');
    expect(t).toContain('Información sanitaria');
    expect(t.split('Sin contestar').length - 1).toBe(3);

    // Tocar una autorización y la salud: solo eso viaja.
    const sw = tree.root.findAll(
      (n) =>
        n.props.accessibilityLabel ===
          'Acepto las condiciones sobre la cesión de imágenes' &&
        typeof n.props.onValueChange === 'function',
    )[0];
    await act(async () => sw.props.onValueChange(true));
    await act(async () =>
      input(tree, 'Alergias').props.onChangeText('Ninguna'),
    );
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    expect(fake.detailWrites()).toEqual({
      'consents.photos': 1,
      'health.allergies': 1,
    });
    const lucia = await fake.getProfileDetails('f-fam-lucia');
    expect(lucia.consents).toEqual({
      dataProtection: null,
      healthData: null,
      photos: true,
    });
    // La salud nunca al almacén del móvil.
    const saved = JSON.stringify(dehydrateArea(qc));
    expect(saved).not.toContain('Polen');
    expect(saved).not.toContain('Ninguna');
    act(() => tree.unmount());
    qc.clear();
  });

  it('sin conexión: «Guardar» apagado y los cambios siguen', async () => {
    const { tree, qc } = await setup('member');
    await until(() => texts(tree).includes('Datos de contacto'));
    await act(async () => input(tree, 'Móvil').props.onChangeText('1'));
    await act(async () => onlineManager.setOnline(false));
    expect(touchable(tree, 'Guardar').props.isDisabled).toBe(true);
    expect(texts(tree)).toContain('Sin conexión: tus cambios siguen aquí');
    expect(input(tree, 'Móvil').props.value).toBe('1');
    act(() => tree.unmount());
    qc.clear();
  });

  it('con un pid ajeno: «No tienes acceso a esto»', async () => {
    const { tree, qc } = await setup('guardianOne', { pid: 'f-fam-lucia' });
    await until(() => texts(tree).includes('No tienes acceso a esto'));
    act(() => tree.unmount());
    qc.clear();
  });

  it('completar para pagar: sin DNI se escribe; con DNI, bloqueado', async () => {
    const { fake, tree, qc } = await setup('guardianNone', {
      completar: 'pago',
    });
    await until(() => texts(tree).includes('Te faltan datos para poder pagar'));
    await press(tree, 'Tipo de identificación: Sin indicar');
    await press(tree, 'NIF');
    await act(async () =>
      input(tree, 'Número de identificación').props.onChangeText('12345678A'),
    );
    expect(texts(tree)).toContain('El número de documento no es válido');
    await act(async () =>
      input(tree, 'Número de identificación').props.onChangeText('12345678z'),
    );
    await press(tree, 'Guardar');
    await until(() => texts(tree).includes('Volver al pago'));
    const me = fake.data.personas.guardianNone.personId;
    expect((await fake.getProfileDetails(me)).identity).toMatchObject({
      documentType: 'nif',
      documentNumber: '12345678Z',
    });
    act(() => tree.unmount());
    qc.clear();

    const again = await setup('member', { completar: 'pago' });
    await until(() => texts(again.tree).includes('Datos de contacto'));
    expect(input(again.tree, 'Número de identificación')).toBeUndefined();
    act(() => again.tree.unmount());
    again.qc.clear();
  });
});

describe('a dónde llegan los enlaces', () => {
  it('las páginas de datos del plugin abren «Mis datos»', () => {
    expect(
      nativeHrefFor({ internalpage: 'single_stic_comunica_perfil' }),
    ).toEqual({ pathname: '/comunica/datos/[pid]', params: { pid: 'actual' } });
    expect(nativeHrefFor({ internalpage: 'single_stic_profile' })).toEqual({
      pathname: '/comunica/datos/[pid]',
      params: { pid: 'actual' },
    });
    expect(
      nativeHrefFor({ internalpage: 'single_stic_comunica_laico' }),
    ).toEqual({ pathname: '/comunica/datos/[pid]', params: { pid: 'yo' } });
    expect(
      nativeHrefFor({ internalpage: 'single_stic_tutor_profile' }),
    ).toEqual({ pathname: '/comunica/datos/[pid]', params: { pid: 'yo' } });
  });

  it('`actual` y `yo` se resuelven con el perfil', () => {
    const active = { pid: 'hijo', self: { id: 'yo-id' } };
    expect(resolveDetailsPid('actual', active)).toBe('hijo');
    expect(resolveDetailsPid('yo', active)).toBe('yo-id');
    expect(resolveDetailsPid('otro', active)).toBe('otro');
    expect(resolveDetailsPid(undefined, active)).toBe('hijo');
  });
});
