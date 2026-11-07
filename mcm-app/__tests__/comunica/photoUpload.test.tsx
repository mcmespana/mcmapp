/**
 * Subir la foto de perfil (plan 12), con el selector simulado y el servidor falso de verdad:
 *
 *   · El servidor falso y el cliente: `PUT /v1/profiles/:pid/photo`, multipart, con las mismas reglas que el de verdad.
 *   · La pantalla «Mis datos»: elegir (calidad y recorte cuadrado), subir en el acto, ver la foto nueva al momento, errores y «Reintentar».
 *   · Nada de la foto va a disco: ni la cola, ni lo que se guarda, y la copia del selector se borra.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import { QueryClient } from '@tanstack/react-query';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  usePreventRemove: jest.fn(),
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
jest.mock('@/components/comunica/comun/DateTimeField', () => () => null);
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: jest.fn() } }),
}));
// `Image` es un componente (la vista previa de la foto elegida) y trae sus estáticos.
jest.mock('expo-image', () => ({
  Image: Object.assign(() => null, {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
  }),
}));
const mockDelete = jest.fn();
jest.mock('@/services/comunica/localFiles', () => ({
  deleteLocalCopy: (uri: string) => mockDelete(uri),
  localFileSize: () => null,
}));
const mockLibrary = jest.fn();
const mockCamera = jest.fn();
const mockCameraPerm = jest.fn(async () => ({ granted: true }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (o: unknown) => mockLibrary(o),
  launchCameraAsync: (o: unknown) => mockCamera(o),
  requestCameraPermissionsAsync: () => mockCameraPerm(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
// Aquí el recorte a 800×800 no se prueba (ver photoResize.test.ts): que falle deja pasar lo elegido tal cual.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => {
    throw new Error('sin manipulador en este test');
  }),
  SaveFormat: { JPEG: 'jpeg' },
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import ProfileDataScreen from '@/components/comunica/datos/ProfileDataScreen';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import { detailsKey } from '@/hooks/comunica/usePersonDetails';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import { createHttpClient } from '@/services/comunica/client';
import type { PersonDetails } from '@/services/comunica/contract';
import type { FakeServer } from '@/services/comunica/fake';
import { dehydrateArea } from '@/services/comunica/persist';
import {
  clearPhotoUploads,
  getPhotoUpload,
} from '@/services/comunica/photoUploads';
import {
  __resetSessionForTests,
  signIn,
  signOut,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { MAX_PHOTO_BYTES } from '@/utils/comunica/photo';

const ROOT = path.join(__dirname, '..', '..');
const CLIENT = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const LUCIA = 'f-hijo-lucia';
const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wait = (ms = 20) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
const labelled = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label,
  );
const has = (tree: ReactTestRenderer, label: string) =>
  labelled(tree, label).length > 0;
const press = async (tree: ReactTestRenderer, label: string) => {
  const b = labelled(tree, label).at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  await act(async () => {
    b.props.onPress();
  });
};
const until = async (fn: () => boolean, ms = 3000) => {
  for (let i = 0; i < ms / 25; i++) {
    if (fn()) return;
    await wait(25);
  }
  throw new Error('No ha pasado a tiempo');
};

const asset = (size: number, mimeType: string | null, name = 'foto.jpg') => ({
  canceled: false,
  assets: [
    {
      uri: `file:///cache/ImagePicker/${name}`,
      fileName: name,
      fileSize: size,
      mimeType,
      width: 1000,
      height: 1000,
    },
  ],
});
const jpg = (size = 200_000) => asset(size, 'image/jpeg');
const file = (size = 1000, mimeType = 'image/jpeg', name = 'foto.jpg') => ({
  uri: `file:///cache/ImagePicker/${name}`,
  name,
  mimeType,
  size,
});

async function api(persona: 'family' | 'memberNoKids' = 'family') {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0 });
  const s = fake.issueSession(persona);
  await signIn(s, s.me);
  return { fake, me: s.me, client: getComunicaApi() };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPhotoUploads();
});
afterEach(() => {
  __resetComunicaApiForTests();
  __resetSessionForTests();
});

describe('servidor falso: PUT /v1/profiles/:pid/photo', () => {
  it('guarda la foto: una URL versionada nueva, que se ve en los datos', async () => {
    const { fake, client } = await api();
    const before = await client.getProfileDetails(LUCIA);
    expect(before.photoUrl).toBeNull();
    const r = await client.uploadProfilePhoto(
      LUCIA,
      { clientId: CLIENT(1) },
      file(),
    );
    expect(r).toMatchObject({ clientId: CLIENT(1), status: 'applied' });
    expect(r.photoUrl).toMatch(/^https:\/\/.+\/photo\?v=1$/);
    expect((await client.getProfileDetails(LUCIA)).photoUrl).toBe(r.photoUrl);
    expect(fake.photoUploads()).toEqual([
      { pid: LUCIA, clientId: CLIENT(1), mimeType: 'image/jpeg', size: 1000 },
    ]);
    // Otra foto, otra versión (otra imagen en el móvil: `cacheKey` es la URL).
    const r2 = await client.uploadProfilePhoto(
      LUCIA,
      { clientId: CLIENT(2) },
      file(500, 'image/png', 'foto.png'),
    );
    expect(r2.photoUrl).toMatch(/\?v=2$/);
    expect(client.photoSource(r2.photoUrl).cacheKey).toBe(r2.photoUrl);
    expect(client.photoSource(r2.photoUrl).uri).not.toBe(
      client.photoSource(r.photoUrl).uri,
    );
  });

  it('el mismo clientId no vuelve a escribir (el reintento de un timeout)', async () => {
    const { fake, client } = await api();
    const a = await client.uploadProfilePhoto(
      LUCIA,
      { clientId: CLIENT(3) },
      file(),
    );
    const b = await client.uploadProfilePhoto(
      LUCIA,
      { clientId: CLIENT(3) },
      file(),
    );
    expect(b).toEqual(a);
    expect(fake.photoUploads()).toHaveLength(1);
  });

  it('4 MB justos sí; 4 MB + 1, vacía y lo que no es JPG ni PNG, 422 con su motivo y sin escribir', async () => {
    const { fake, client } = await api();
    let n = 100;
    const reason = async (f: ReturnType<typeof file>) =>
      client
        .uploadProfilePhoto(LUCIA, { clientId: CLIENT(n++) }, f)
        .then(() => 'ok')
        .catch((e) => `${e.code}:${e.reason}`);
    expect(await reason(file(MAX_PHOTO_BYTES))).toBe('ok');
    expect(await reason(file(MAX_PHOTO_BYTES + 1))).toBe(
      'validation:file_too_big',
    );
    expect(await reason(file(0))).toBe('validation:empty_file');
    for (const [mime, name] of [
      ['image/heic', 'a.heic'],
      ['image/gif', 'a.gif'],
      ['image/svg+xml', 'a.svg'],
      ['image/webp', 'a.webp'],
    ] as const)
      expect(await reason(file(1000, mime, name))).toBe(
        'validation:bad_file_type',
      );
    expect(fake.photoUploads()).toHaveLength(1);
  });

  it('un pid ajeno, 403; sin clientId, 422 `bad_body`; con el CRM caído, 503; sin red, `network`', async () => {
    const { fake, client } = await api();
    await expect(
      client.uploadProfilePhoto(
        'f-per-ajena',
        { clientId: CLIENT(11) },
        file(),
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      client.uploadProfilePhoto(LUCIA, { clientId: 'no-es-un-uuid' }, file()),
    ).rejects.toMatchObject({ code: 'validation', reason: 'bad_body' });
    fake.setControls({ crmDown: true });
    await expect(
      client.uploadProfilePhoto(LUCIA, { clientId: CLIENT(12) }, file()),
    ).rejects.toMatchObject({ code: 'crm_unavailable' });
    fake.setControls({ crmDown: false, offline: true });
    await expect(
      client.uploadProfilePhoto(LUCIA, { clientId: CLIENT(13) }, file()),
    ).rejects.toMatchObject({ code: 'network' });
    expect(fake.photoUploads()).toHaveLength(0);
  });
});

describe('cliente HTTP: la foto va en multipart', () => {
  it('PUT con clientId y file, sin Content-Type a mano y con la sesión', async () => {
    const f = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        clientId: CLIENT(20),
        status: 'applied',
        photoUrl: 'https://api.test/v1/profiles/p1/photo?v=abc',
      }),
    } as Response);
    const c = createHttpClient({
      baseUrl: 'https://api.test/',
      getToken: () => 'tok',
      fetchImpl: f,
    });
    const appended: unknown[][] = [];
    const append = FormData.prototype.append;
    jest.spyOn(FormData.prototype, 'append').mockImplementation(function (
      this: FormData,
      ...a: unknown[]
    ) {
      appended.push(a);
      return (append as (...x: unknown[]) => void).apply(this, a);
    });
    const r = await c.uploadProfilePhoto(
      'p 1',
      { clientId: CLIENT(20) },
      file(),
    );
    expect(r.photoUrl).toContain('?v=abc');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.test/v1/profiles/p%201/photo');
    expect(init.method).toBe('PUT');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(appended.map((a) => a[0])).toEqual(['clientId', 'file']);
    expect(appended[0][1]).toBe(CLIENT(20));
  });

  it('una respuesta sin `photoUrl` https es un error del contrato', async () => {
    const f = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        clientId: CLIENT(21),
        status: 'applied',
        photoUrl: 'http://api.test/foto',
      }),
    } as Response);
    const c = createHttpClient({
      baseUrl: 'https://api.test/',
      getToken: () => 'tok',
      fetchImpl: f,
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      c.uploadProfilePhoto('p1', { clientId: CLIENT(21) }, file()),
    ).rejects.toMatchObject({ code: 'bad_response' });
  });
});

// ── La pantalla ─────────────────────────────────────────────────────────────

const trees: ReactTestRenderer[] = [];
const clients: QueryClient[] = [];

async function screen(persona: 'family' | 'memberNoKids', pid: string) {
  const { fake, me } = await api(persona);
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
              <ProfileDataScreen pid={pid === 'self' ? me.personId : pid} />
            </ActiveProfileProvider>
          </ComunicaAreaProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  clients.push(qc);
  await until(() => texts(tree).includes('Autorizaciones legales'));
  return { fake, tree, qc, me };
}
const photoOf = (qc: QueryClient, pid: string) =>
  qc.getQueryData<PersonDetails>(areaKey([...detailsKey(pid)]))?.photoUrl;

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
});

describe('«Mis datos»: la foto', () => {
  it('sin foto: «Elegir foto» y la sección del plugin; elegir de la galería sube al momento y la foto nueva sustituye a la de la caché', async () => {
    const { fake, tree, qc } = await screen('family', LUCIA);
    expect(texts(tree)).toContain('Sube una foto para conocernos mejor');
    expect(texts(tree)).toContain('Formatos: jpg o png · Tamaño máximo: 4 MB');
    expect(photoOf(qc, LUCIA)).toBeNull();
    await press(tree, 'Subir una foto de perfil');
    expect(texts(tree)).toContain('Hacer una foto');
    expect(texts(tree)).toContain('Elegir de la galería');
    mockLibrary.mockResolvedValueOnce(jpg());
    await press(tree, 'Elegir de la galería');
    await until(() => photoOf(qc, LUCIA) != null);
    // El selector recorta en cuadrado y comprime.
    expect(mockLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      }),
    );
    expect(photoOf(qc, LUCIA)).toMatch(/\/photo\?v=1$/);
    expect(fake.photoUploads()).toEqual([
      expect.objectContaining({
        pid: LUCIA,
        mimeType: 'image/jpeg',
        size: 200_000,
      }),
    ]);
    // La pantalla ya dice «Subida», y el botón, «Cambiar foto de perfil».
    await until(() => texts(tree).includes('Subida'));
    expect(has(tree, 'Cambiar foto de perfil')).toBe(true);
    // La copia que dejó el selector se borra.
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/ImagePicker/foto.jpg',
    );
  });

  it('con la cámara pide permiso; sin él, lo explica y no sube', async () => {
    const { fake, tree } = await screen('family', LUCIA);
    mockCameraPerm.mockResolvedValueOnce({ granted: false });
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Hacer una foto');
    await wait();
    expect(texts(tree)).toMatch(/permiso a la cámara/);
    expect(mockCamera).not.toHaveBeenCalled();
    // Con permiso, hace la foto con el mismo recorte.
    mockCamera.mockResolvedValueOnce(jpg(150_000));
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Hacer una foto');
    await until(() => fake.photoUploads().length === 1);
    expect(mockCamera).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }),
    );
  });

  it('cancelar el selector no hace nada', async () => {
    const { fake, tree } = await screen('family', LUCIA);
    mockLibrary.mockResolvedValueOnce({ canceled: true, assets: null });
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await wait();
    expect(fake.photoUploads()).toHaveLength(0);
    expect(getPhotoUpload(LUCIA)).toBeUndefined();
  });

  it('una foto de más de 4 MB no sube, se borra su copia y la siguiente vez se pide menos calidad', async () => {
    const { fake, tree } = await screen('family', LUCIA);
    mockLibrary.mockResolvedValueOnce(jpg(MAX_PHOTO_BYTES + 1));
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await until(() => texts(tree).includes('pesa más de 4 MB'));
    expect(texts(tree)).toContain('ahora la comprimiremos más');
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/ImagePicker/foto.jpg',
    );
    expect(fake.photoUploads()).toHaveLength(0);
    // Segundo intento: menos calidad, y esta vez cabe.
    mockLibrary.mockResolvedValueOnce(jpg(1_000_000));
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await until(() => fake.photoUploads().length === 1);
    expect(mockLibrary.mock.calls[0][0].quality).toBe(0.6);
    expect(mockLibrary.mock.calls[1][0].quality).toBe(0.4);
    // Subida bien, se vuelve a la calidad de partida.
    mockLibrary.mockResolvedValueOnce(jpg(1_000));
    await press(tree, 'Cambiar foto de perfil');
    await press(tree, 'Elegir de la galería');
    await wait();
    expect(mockLibrary.mock.calls[2][0].quality).toBe(0.6);
  });

  it('un HEIC no vale: lo dice y no sube', async () => {
    const { fake, tree } = await screen('family', LUCIA);
    mockLibrary.mockResolvedValueOnce(asset(1000, 'image/heic', 'IMG_1.HEIC'));
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await until(() => texts(tree).includes('La foto tiene que ser JPG o PNG.'));
    expect(fake.photoUploads()).toHaveLength(0);
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/ImagePicker/IMG_1.HEIC',
    );
  });

  it('mientras sube se ve la foto elegida, y el botón no deja elegir otra', async () => {
    const { fake, tree } = await screen('family', LUCIA);
    fake.setControls({ latencyMs: 300 });
    mockLibrary.mockResolvedValueOnce(jpg());
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    expect(texts(tree)).toContain('Subiendo…');
    const preview = tree.root.findAll(
      (n) => n.props.source?.uri === 'file:///cache/ImagePicker/foto.jpg',
    );
    expect(preview.length).toBeGreaterThan(0);
    const button = tree.root.findAll(
      (n) =>
        n.props.accessibilityLabel === 'Cambiar foto de perfil' &&
        n.props.accessibilityState,
    );
    expect(button.at(0)?.props.accessibilityState.disabled).toBe(true);
    await until(() => texts(tree).includes('Subida'), 2000);
  });

  it('si el CRM falla: motivo, «Reintentar» con el mismo clientId, y sale bien al volver', async () => {
    const { fake, tree, qc } = await screen('family', LUCIA);
    fake.setControls({ failRoute: 'uploadProfilePhoto' });
    mockLibrary.mockResolvedValueOnce(jpg());
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await until(() => texts(tree).includes('No se ha podido subir'));
    expect(texts(tree)).toContain('El CRM no responde ahora mismo');
    expect(photoOf(qc, LUCIA)).toBeNull();
    // La foto elegida sigue a la vista y su copia, sin borrar, hasta poder reintentar.
    expect(mockDelete).not.toHaveBeenCalled();
    const clientId = getPhotoUpload(LUCIA)!.clientId;
    fake.setControls({ failRoute: null });
    await press(tree, 'Reintentar');
    await until(() => photoOf(qc, LUCIA) != null);
    expect(getPhotoUpload(LUCIA)).toMatchObject({ clientId, phase: 'applied' });
    // Y ya no queda el motivo del fallo de antes.
    expect(texts(tree)).not.toContain('El CRM no responde ahora mismo');
    expect(fake.photoUploads()).toHaveLength(1);
  });

  it('si el servidor rechaza la foto por lo que es, no hay «Reintentar»: se elige otra', async () => {
    const { fake, tree } = await screen('family', LUCIA);
    // Un JPEG que el selector da como tal pero que el servidor rechaza (p. ej. sus primeros bytes dicen otra cosa).
    jest.spyOn(fake, 'uploadProfilePhoto').mockImplementationOnce(async () => {
      const { ComunicaApiError } = jest.requireActual(
        '@/services/comunica/client',
      );
      throw new ComunicaApiError('validation', 'x', 422, 'bad_file_type');
    });
    mockLibrary.mockResolvedValueOnce(jpg());
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await until(() => texts(tree).includes('La foto tiene que ser JPG o PNG.'));
    expect(has(tree, 'Reintentar')).toBe(false);
  });

  it('el miembro también la cambia (es la misma pantalla)', async () => {
    const { fake, tree } = await screen('memberNoKids', 'self');
    mockLibrary.mockResolvedValueOnce(jpg());
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await until(() => fake.photoUploads().length === 1);
  });

  it('salir de la pantalla borra lo que no está subiendo; cerrar sesión borra todo y lo que vuelva no escribe', async () => {
    const { fake, tree } = await screen('family', LUCIA);
    fake.setControls({ latencyMs: 200 });
    mockLibrary.mockResolvedValueOnce(jpg());
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    expect(getPhotoUpload(LUCIA)?.phase).toBe('sending');
    await act(async () => {
      await signOut();
    });
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/ImagePicker/foto.jpg',
    );
    expect(getPhotoUpload(LUCIA)).toBeUndefined();
    await wait(300);
    expect(getPhotoUpload(LUCIA)).toBeUndefined();
  });
});

describe('nada de la foto va a disco', () => {
  it('ni la caché que se guarda ni el almacén del móvil la tienen', async () => {
    const { tree, qc } = await screen('family', LUCIA);
    mockLibrary.mockResolvedValueOnce(jpg());
    await press(tree, 'Subir una foto de perfil');
    await press(tree, 'Elegir de la galería');
    await until(() => photoOf(qc, LUCIA) != null);
    const url = photoOf(qc, LUCIA)!;
    expect(JSON.stringify(dehydrateArea(qc))).not.toContain(url);
    expect(
      dehydrateArea(qc).queries.some((q) => /datos/.test(q.queryKey.join('/'))),
    ).toBe(false);
  });

  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('la foto no pasa por la cola de escrituras ni por el almacén', () => {
    for (const f of [
      'services/comunica/photoUploads.ts',
      'hooks/comunica/usePhotoUpload.ts',
      'components/comunica/datos/PhotoBlock.tsx',
    ]) {
      expect(read(f)).not.toMatch(
        /from '(\.\/|@\/services\/comunica\/)outbox'|useOutbox|enqueue|AsyncStorage|writeDrawer|expo-sqlite/,
      );
    }
  });

  it('solo el hook y el adaptador tocan el selector y el archivo; la pantalla no sube nada por su cuenta', () => {
    expect(read('components/comunica/datos/PhotoBlock.tsx')).not.toMatch(
      /\bfetch\s*\(|getComunicaApi|uploadProfilePhoto|FormData|expo-image-picker|expo-file-system/,
    );
    expect(read('hooks/comunica/usePhotoUpload.ts')).not.toMatch(
      /expo-image-picker|expo-file-system|\bfetch\s*\(/,
    );
  });
});
