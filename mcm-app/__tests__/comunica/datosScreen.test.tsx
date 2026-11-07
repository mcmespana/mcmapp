/**
 * «Mis datos» y «Datos de Lucía» con el CABLEADO REAL (plan 12): el proveedor del área, los hooks y el servidor falso.
 *
 *   · Las tres audiencias: el miembro ve MCM y el hijo no; el familiar ve salud; las autorizaciones sin contestar se ven «Sin contestar».
 *   · Guardar solo el móvil escribe un campo; sin cambios no hay nada que guardar; las autorizaciones sin tocar no viajan.
 *   · `pid` ajeno → 403; sin conexión y sin datos → «Necesitas conexión»; con datos y sin red, «Guardar» apagado.
 *   · `completar=pago`: quien no tiene documento lo escribe; quien lo tiene, no.
 *   · NADA de esto llega al disco: ni los datos ni la salud.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import { QueryClient } from '@tanstack/react-query';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  usePreventRemove: jest.fn(),
  useLocalSearchParams: () => mockParams,
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
jest.mock('@/components/comunica/comun/DateTimeField', () => () => null);
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToast } }),
}));
jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
  },
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import ProfileDataScreen from '@/components/comunica/datos/ProfileDataScreen';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
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
const labelled = (tree: ReactTestRenderer, label: string, prop: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props[prop] === 'function' &&
      n.props.accessibilityLabel === label,
  );
const has = (tree: ReactTestRenderer, label: string, prop = 'onPress') =>
  labelled(tree, label, prop).length > 0;
const press = async (tree: ReactTestRenderer, label: string) => {
  const b = labelled(tree, label, 'onPress').at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  await act(async () => {
    b.props.onPress();
  });
};
const type = async (tree: ReactTestRenderer, label: string, value: string) => {
  const f = labelled(tree, label, 'onChangeText').at(0);
  if (!f) throw new Error(`No hay campo «${label}»`);
  await act(async () => {
    f.props.onChangeText(value);
  });
};
const toggle = async (
  tree: ReactTestRenderer,
  label: string,
  value: boolean,
) => {
  const s = labelled(tree, label, 'onValueChange').at(0);
  if (!s) throw new Error(`No hay interruptor «${label}»`);
  await act(async () => {
    s.props.onValueChange(value);
  });
};
const until = async (fn: () => boolean, ms = 3000) => {
  for (let i = 0; i < ms / 25; i++) {
    if (fn()) return;
    await wait(25);
  }
  throw new Error('No ha pasado a tiempo');
};

const trees: ReactTestRenderer[] = [];
const clients: QueryClient[] = [];

async function setup(
  persona: PersonaId,
  pid: string | ((me: string) => string),
  props: { completar?: boolean } = {},
  controls: Partial<FakeServer['controls']> = {},
) {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  const be = memoryBackend();
  setStorageBackend(be);
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0, ...controls });
  const s = fake.issueSession(persona);
  await signIn(s, s.me);
  const id = typeof pid === 'function' ? pid(s.me.personId) : pid;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <ComunicaAreaProvider client={qc}>
            <ActiveProfileProvider>
              <ProfileDataScreen pid={id} {...props} />
            </ActiveProfileProvider>
          </ComunicaAreaProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  clients.push(qc);
  return { fake, be, qc, tree, me: s.me };
}
const self = (me: string) => me;

afterEach(async () => {
  await act(async () => {
    for (const tree of trees.splice(0)) {
      try {
        tree.unmount();
      } catch {
        /* ya desmontado */
      }
    }
  });
  for (const qc of clients.splice(0)) qc.clear();
  __resetComunicaApiForTests();
  __resetSessionForTests();
  jest.clearAllMocks();
});

describe('las tres audiencias', () => {
  it('el miembro ve las siete secciones, lo bloqueado como dato y «Año incorporación LC» (LC Incorporado) sin «Nivel COM»', async () => {
    const { tree } = await setup('memberNoKids', self);
    await until(() => texts(tree).includes('Autorizaciones legales'));
    const t = texts(tree);
    for (const s of [
      'Datos personales',
      'Datos de contacto',
      'Dirección',
      'Foto',
      'MCM',
      'Información sanitaria',
      'Autorizaciones legales',
    ])
      expect(t).toContain(s);
    expect(t).toContain('Hola Jaime 👋, estos son los datos que tenemos.');
    expect(t).toContain('X1234567L');
    expect(t).toContain('Si tienes, usa el correo');
    expect(t).toContain('Año incorporación LC');
    expect(t).not.toContain('Nivel COM');
    // Lo bloqueado no es un campo.
    expect(has(tree, 'Número de identificación', 'onChangeText')).toBe(false);
    expect(has(tree, 'Nombre', 'onChangeText')).toBe(false);
  });

  it('la monitora ve «Nivel COM» (etapa COM) y el aviso del correo', async () => {
    const { tree } = await setup('monitorMom', self);
    await until(() => texts(tree).includes('MCM'));
    expect(texts(tree)).toContain('Nivel COM');
    expect(texts(tree)).toContain('Mejor utiliza tu correo');
  });

  it('el hijo: sin MCM, «Estos son los datos que tenemos de Lucía», fecha en lenguaje humano y las tres autorizaciones «Sin contestar»', async () => {
    const { tree } = await setup('family', 'f-hijo-lucia');
    await until(() => texts(tree).includes('Autorizaciones legales'));
    const t = texts(tree);
    expect(t).toContain('Estos son los datos que tenemos de Lucía.');
    expect(t).toContain('5 de mayo de 2014');
    expect(t).not.toContain('MCM |');
    expect(has(tree, 'Etapa')).toBe(false);
    expect(t.match(/Sin contestar/g)).toHaveLength(3);
    // El soporte y la expedición del DNI solo salen si ya los tienen.
    expect(t).not.toContain('Número de soporte del DNI');
  });

  it('el otro hijo, con soporte y expedición, los enseña con su «Ya lo tenemos»', async () => {
    const { tree } = await setup('family', 'f-hijo-sin-nombre');
    await until(() => texts(tree).includes('Número de soporte del DNI'));
    expect(texts(tree)).toContain(
      'Ya lo tenemos. Puedes corregirlo si cambia.',
    );
    expect(texts(tree)).toContain('Estos son los datos que tenemos.');
  });

  it('el familiar ve la salud (de un hijo, con lo que ya hay)', async () => {
    const { tree } = await setup('family', 'f-hijo-lucia');
    await until(() => texts(tree).includes('Información sanitaria'));
    await until(() => has(tree, 'Alergias', 'onChangeText'));
    const f = labelled(tree, 'Intolerancias alimentarias', 'onChangeText').at(
      0,
    )!;
    expect(f.props.value).toBe('Sin gluten');
  });
});

describe('guardar', () => {
  it('sin cambios no hay nada que guardar', async () => {
    const { tree, fake } = await setup('family', self);
    await until(() => texts(tree).includes('Datos de contacto'));
    await press(tree, 'Guardar');
    expect(fake.writeCount).toBe(0);
  });

  it('cambiar solo el móvil escribe UN campo; el servidor lo tiene y se avisa', async () => {
    const { tree, fake } = await setup('family', self);
    await until(() => has(tree, 'Móvil', 'onChangeText'));
    await type(tree, 'Móvil', '699000111');
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    expect(mockToast.mock.calls[0][0]).toMatchObject({
      variant: 'success',
      label: 'Los datos se han guardado correctamente.',
    });
    expect(fake.detailWrites()).toEqual({ mobile: 1 });
    // Tras guardar ya no hay nada sin guardar: otro «Guardar» no escribe.
    await press(tree, 'Guardar');
    await wait(100);
    expect(fake.detailWrites()).toEqual({ mobile: 1 });
  });

  it('un correo mal escrito no deja guardar y lo dice en su campo', async () => {
    const { tree, fake } = await setup('family', self);
    await until(() => has(tree, 'Correo electrónico', 'onChangeText'));
    await type(tree, 'Correo electrónico', 'esto no es un correo');
    expect(texts(tree)).toContain('El correo electrónico no es válido.');
    await press(tree, 'Guardar');
    expect(fake.writeCount).toBe(0);
  });

  it('encender solo «cesión de imágenes» manda solo esa; las otras siguen sin contestar', async () => {
    const { tree, fake } = await setup('family', 'f-hijo-lucia');
    await until(() =>
      has(
        tree,
        'Acepto las condiciones sobre la cesión de imágenes',
        'onValueChange',
      ),
    );
    await toggle(
      tree,
      'Acepto las condiciones sobre la cesión de imágenes',
      true,
    );
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    expect(fake.detailWrites()).toEqual({ 'consents.photos': 1 });
    const d = await fake.getProfileDetails('f-hijo-lucia');
    expect(d.consents).toEqual({
      dataProtection: null,
      healthData: null,
      photos: true,
    });
    await until(() => texts(tree).match(/Sin contestar/g)?.length === 2);
  });

  it('la salud se escribe aparte y solo lo que cambia; no toca los datos', async () => {
    const { tree, fake } = await setup('family', 'f-hijo-lucia');
    await until(() => has(tree, 'Alergias', 'onChangeText'));
    await type(tree, 'Alergias', 'Polen');
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    expect(fake.detailWrites()).toEqual({ 'health.allergies': 1 });
    expect((await fake.getProfileHealth('f-hijo-lucia')).health.allergies).toBe(
      'Polen',
    );
  });

  it('un cambio en datos y otro en salud se guardan los dos', async () => {
    const { tree, fake } = await setup('family', 'f-hijo-lucia');
    await until(() => has(tree, 'Alergias', 'onChangeText'));
    await type(tree, 'Población', 'Castelló');
    await type(tree, 'Otros datos de salud', 'Asma leve');
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    expect(fake.detailWrites()).toEqual({ city: 1, 'health.other': 1 });
  });

  it('si el servidor rechaza un valor, el error sale y no se avisa de «guardado»', async () => {
    const { tree, fake } = await setup('memberNoKids', self);
    await until(() => has(tree, 'Pertenezco al MCM desde…', 'onChangeText'));
    // 1899 pasa el formato de cuatro cifras de la app (1900-2100 lo comprueba también) → lo para la app.
    await type(tree, 'Pertenezco al MCM desde…', '1899');
    expect(texts(tree)).toContain('Escribe el año con cuatro cifras');
    await press(tree, 'Guardar');
    expect(fake.writeCount).toBe(0);
  });

  it('con el CRM caído, «Error al guardar los datos.» y lo escrito sigue ahí', async () => {
    const { tree, fake } = await setup('family', self);
    await until(() => has(tree, 'Móvil', 'onChangeText'));
    fake.setControls({ crmDown: true });
    await type(tree, 'Móvil', '699000111');
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    expect(mockToast.mock.calls[0][0]).toMatchObject({
      variant: 'danger',
      label: 'Error al guardar los datos.',
    });
    expect(labelled(tree, 'Móvil', 'onChangeText').at(0)!.props.value).toBe(
      '699000111',
    );
    // Vuelve el CRM: el reintento guarda (mismo guardado).
    fake.setControls({ crmDown: false });
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 1);
    expect(mockToast.mock.calls[1][0]).toMatchObject({ variant: 'success' });
    expect(fake.detailWrites()).toEqual({ mobile: 1 });
  });
});

describe('estados', () => {
  it('un pid ajeno: «No tienes acceso a esto»', async () => {
    const { tree } = await setup('family', 'f-per-miembro');
    await until(() => texts(tree).includes('No tienes acceso a esto'));
  });

  it('sin conexión y sin datos (lo normal: no se guardan): «Necesitas conexión para ver tus datos»', async () => {
    const { tree } = await setup('family', self, {}, { offline: true });
    await until(() =>
      texts(tree).includes('Necesitas conexión para ver tus datos'),
    );
    expect(texts(tree)).toContain('Reintentar');
  });

  it('con datos y sin red, «Guardar» no escribe y se explica', async () => {
    const { tree, fake, qc } = await setup('family', self);
    await until(() => has(tree, 'Móvil', 'onChangeText'));
    fake.setControls({ offline: true });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'datos'] });
    });
    await type(tree, 'Móvil', '699000111');
    await until(() =>
      texts(tree).includes('Sin conexión: tus cambios siguen aquí'),
    );
    await press(tree, 'Guardar');
    await wait(100);
    expect(fake.writeCount).toBe(0);
    expect(labelled(tree, 'Móvil', 'onChangeText').at(0)!.props.value).toBe(
      '699000111',
    );
  });
});

describe('completar=pago (regla 9)', () => {
  it('quien no tiene documento lo escribe; con la letra mal no deja; guardado, «Volver al pago»', async () => {
    const { tree, fake } = await setup('familyNone', self, { completar: true });
    await until(() => texts(tree).includes('Te faltan datos para poder pagar'));
    expect(texts(tree)).toContain(
      'Necesitamos tu nombre, apellidos, correo y documento de identidad.',
    );
    // Nombre y apellidos ya están: bloqueados. El documento, vacío: se escribe.
    expect(has(tree, 'Nombre', 'onChangeText')).toBe(false);
    await press(tree, 'Tipo de identificación: Sin indicar');
    await press(tree, 'NIF');
    await type(tree, 'Número de identificación', '12345678A');
    expect(texts(tree)).toContain('El número de documento no es válido.');
    await press(tree, 'Guardar');
    expect(fake.writeCount).toBe(0);
    await type(tree, 'Número de identificación', '12345678Z');
    await type(tree, 'Correo electrónico', 'carmen@ejemplo.org');
    await press(tree, 'Guardar');
    await until(() => has(tree, 'Volver al pago'));
    expect(fake.detailWrites()).toMatchObject({
      'identity.documentNumber': 1,
      'identity.documentType': 1,
      email: 1,
    });
    await press(tree, 'Volver al pago');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('quien ya tiene documento no puede cambiarlo aunque venga a pagar', async () => {
    const { tree } = await setup('family', self, { completar: true });
    await until(() => texts(tree).includes('Datos de contacto'));
    expect(has(tree, 'Número de identificación', 'onChangeText')).toBe(false);
    expect(texts(tree)).toContain('12345678Z');
  });

  it('sin `completar`, la identidad nunca se escribe', async () => {
    const { tree } = await setup('familyNone', self);
    await until(() => texts(tree).includes('Datos de contacto'));
    expect(has(tree, 'Número de identificación', 'onChangeText')).toBe(false);
    expect(texts(tree)).not.toContain('Te faltan datos para poder pagar');
  });
});

describe('nada al disco', () => {
  it('ni los datos ni la salud entran en lo que se guarda', async () => {
    const { tree, qc, be } = await setup('family', 'f-hijo-lucia');
    await until(() => has(tree, 'Alergias', 'onChangeText'));
    await type(tree, 'Alergias', 'Polen');
    await press(tree, 'Guardar');
    await until(() => mockToast.mock.calls.length > 0);
    const keys = qc
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey.join('/'));
    expect(keys.some((k) => k.includes('datos'))).toBe(true);
    expect(keys.some((k) => k.includes('salud'))).toBe(true);
    const saved = JSON.stringify(dehydrateArea(qc));
    // Lo que sí se guarda es «quién soy» y los nombres de mis hijos (plan 11); nada de `datos` ni `salud`.
    const savedKeys = dehydrateArea(qc).queries.map((q) =>
      q.queryKey.join('/'),
    );
    expect(savedKeys.some((k) => /datos|salud/.test(k))).toBe(false);
    for (const secret of [
      'Polen',
      'Sin gluten',
      '5 de mayo',
      '2014-05-05',
      'Calle Mayor',
    ])
      expect(saved).not.toContain(secret);
    expect(JSON.stringify(be.dump())).not.toContain('Polen');
    expect(JSON.stringify(be.dump())).not.toContain('Sin gluten');
  });
});
