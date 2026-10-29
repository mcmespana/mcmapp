/**
 * «Mis datos de monitor» con el CABLEADO REAL (plan 09, tareas 4-7): el
 * proveedor del área, la cola, los hooks y el servidor falso.
 *
 *   · Editar y guardar sin conexión: se queda en la cola («Guardada en el
 *     móvil»), al volver la red sube y el servidor lo tiene.
 *   · Sin papel de monitor: «Esta sección es para monitores».
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import { QueryClient } from '@tanstack/react-query';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockNavigation = {
  addListener: jest.fn(() => () => {}),
  dispatch: jest.fn(),
};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
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
jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
  },
}));

const mockGetDocument = jest.fn();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (o: unknown) => mockGetDocument(o),
}));
jest.mock('expo-image-picker', () => ({
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('@/services/comunica/localFiles', () => ({
  deleteLocalCopy: jest.fn(),
  localFileSize: () => null,
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import MonitorDataScreen from '@/components/comunica/yo/MonitorDataScreen';
import HomeCertificateAlert from '@/components/comunica/yo/HomeCertificateAlert';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import { __resetSessionForTests, signIn } from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { clearUploads, startUpload } from '@/services/comunica/uploads';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import type { Me } from '@/services/comunica/contract';

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
const until = async (fn: () => boolean, ms = 3000) => {
  for (let i = 0; i < ms / 25; i++) {
    if (fn()) return;
    await wait(25);
  }
  throw new Error('No ha pasado a tiempo');
};

async function setup(
  persona: PersonaId = 'monitor',
  screen?: (me: Me) => React.ReactElement,
) {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0 });
  const s = fake.issueSession(persona);
  await signIn(s, s.me);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <ComunicaAreaProvider client={qc}>
            {screen ? screen(s.me) : <MonitorDataScreen />}
          </ComunicaAreaProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return { fake, qc, tree };
}

afterEach(() => {
  clearUploads();
  __resetComunicaApiForTests();
  __resetSessionForTests();
  jest.clearAllMocks();
});

describe('Mis datos de monitor', () => {
  it('editar, guardar sin conexión, reconectar y queda aplicado', async () => {
    const { fake, tree, qc } = await setup();
    await until(() => texts(tree).includes('Trayectoria'));
    // Lo que vino del servidor: el año, sin el 1 de enero.
    const year = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Monitor/a desde…' &&
        n.props.onChangeText,
    );
    expect(year.props.value).toBe('2021');
    // «Guardar» apagado sin cambios.
    expect(touchable(tree, 'Guardar').props.isDisabled).toBe(true);

    // Un año mal escrito no deja guardar.
    await act(async () => year.props.onChangeText('19'));
    expect(texts(tree)).toContain('Escribe el año con cuatro cifras');
    await act(async () => year.props.onChangeText('2019'));

    // Sin conexión: a la cola.
    fake.setControls({ offline: true });
    await press(tree, 'Guardar');
    await until(() => texts(tree).includes('Guardada en el móvil'));
    expect(await fake.getMyMonitorProfile().catch(() => null)).toBeNull();

    // Vuelve la red: sube sola (`wake`) y el servidor lo tiene.
    fake.setControls({ offline: false });
    await act(async () => {
      const { onlineManager } = require('@tanstack/react-query');
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    await until(() => mockToast.mock.calls.length > 0, 8000);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'success',
      label: 'Los datos se han guardado correctamente.',
    });
    expect((await fake.getMyMonitorProfile()).monitorSince).toBe(2019);
    expect(texts(tree)).not.toContain('Guardada en el móvil');

    act(() => tree.unmount());
    qc.clear();
  }, 20_000);

  it('sin papel de monitor: «Esta sección es para monitores» y volver', async () => {
    const { tree, qc } = await setup('accompaniment');
    await until(() => texts(tree).includes('Esta sección es para monitores'));
    act(() => tree.unmount());
    qc.clear();
  });
});

describe('el certificado de delitos sexuales', () => {
  const ALERT = 'Te falta subir tu Certificado de Delitos Sexuales';

  it('elegir «Manual» enseña el archivo y el aviso', async () => {
    // Coordinación eligió «Automático»: ni aviso ni archivo.
    const { tree, qc } = await setup('coordination');
    await until(() => texts(tree).includes('Trayectoria'));
    expect(texts(tree)).not.toContain(ALERT);
    expect(texts(tree)).toContain(
      "Ver tutorial para autorizarnos en 'Mi Carpeta Ciudadana'",
    );
    expect(texts(tree)).not.toContain('Subir Certificado de Delitos Sexuales');
    await press(
      tree,
      'Manual. Envío aquí el certificado y lo renovaré cada septiembre.',
    );
    expect(texts(tree)).toContain(ALERT);
    expect(texts(tree)).toContain('Subir Certificado de Delitos Sexuales');
    expect(texts(tree)).toContain('Ir al trámite del Ministerio de Justicia');
    expect(touchable(tree, 'Guardar').props.isDisabled).toBe(false);
    act(() => tree.unmount());
    qc.clear();
  });

  it('el monitor en «Manual» ve el aviso, sube y el aviso se va', async () => {
    const { fake, tree, qc } = await setup('monitor');
    await until(() => texts(tree).includes(ALERT));
    mockGetDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/cert.pdf',
          name: 'cert.pdf',
          size: 1000,
          mimeType: 'application/pdf',
        },
      ],
    });
    await press(tree, 'Elegir: Subir Certificado de Delitos Sexuales');
    await press(tree, 'Elegir un archivo');
    await until(() => !texts(tree).includes(ALERT));
    expect(fake.uploads()).toHaveLength(1);
    expect((await fake.getMyMonitorProfile()).files.sexOffenceCertificate).toBe(
      true,
    );
    act(() => tree.unmount());
    qc.clear();
  });

  it('si la subida falla, el aviso vuelve', async () => {
    const { fake, tree, qc } = await setup('monitor');
    await until(() => texts(tree).includes(ALERT));
    fake.setControls({ crmDown: true });
    mockGetDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/DocumentPicker/cert.pdf',
          name: 'cert.pdf',
          size: 1000,
          mimeType: 'application/pdf',
        },
      ],
    });
    await press(tree, 'Elegir: Subir Certificado de Delitos Sexuales');
    await press(tree, 'Elegir un archivo');
    await until(() => texts(tree).includes('El CRM no responde ahora mismo'));
    expect(texts(tree)).toContain(ALERT);
    act(() => tree.unmount());
    qc.clear();
  });
});

describe('el aviso en la portada «Hoy»', () => {
  const ALERT = 'Te falta subir tu Certificado de Delitos Sexuales';
  const cert = {
    uri: 'file:///cache/cert.pdf',
    name: 'cert.pdf',
    mimeType: 'application/pdf',
    size: 1000,
  };

  it('sale, se esconde con el certificado en camino y vuelve si falla', async () => {
    const { fake, tree, qc } = await setup('monitor', (me) => (
      <HomeCertificateAlert me={me} />
    ));
    await until(() => texts(tree).includes(ALERT));
    // Lleva a «Mis datos de monitor».
    await press(tree, `${ALERT}. Subir certificado`);
    expect(mockRouter.push).toHaveBeenCalledWith('/comunica/yo/monitor');
    // En camino (el CRM tarda y luego falla): se esconde…
    fake.setControls({ latencyMs: 300, crmDown: true });
    await act(async () => {
      void startUpload('sex_offence_certificate', cert);
    });
    expect(texts(tree)).not.toContain(ALERT);
    // …y vuelve al fallar.
    await until(() => texts(tree).includes(ALERT));
    act(() => tree.unmount());
    qc.clear();
  });

  it('a quien no es monitor no le cuesta ni una lectura', async () => {
    const { fake, tree, qc } = await setup('accompaniment', (me) => (
      <HomeCertificateAlert me={me} />
    ));
    const spy = jest.spyOn(fake, 'getMyMonitorProfile');
    await wait(100);
    expect(texts(tree)).toBe('');
    expect(spy).not.toHaveBeenCalled();
    act(() => tree.unmount());
    qc.clear();
  });
});
