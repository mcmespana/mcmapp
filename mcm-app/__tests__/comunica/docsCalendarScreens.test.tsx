/**
 * Documentos y calendario con el CABLEADO REAL (plan 16): el proveedor del área, «a quién se ve», los hooks y el servidor falso.
 *
 *   · «Documentos»: orden, tipo, caducado, sin el nombre del archivo, abrir (visor, o la hoja del sistema), nada al disco, vacío y sin conexión.
 *   · La ficha: editar solo lo cambiado, sustituir el archivo, eliminar solo tras confirmar y con el CRM caído; subir (4 MB, extensiones) y reintentar sin duplicar.
 *   · «Calendario»: el mes, los puntitos, la lista del día, la agenda, la leyenda, los destinos; la sesión; el visor borra la copia al cerrar.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToast } }),
}));
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.clearDiskCache = jest.fn().mockResolvedValue(true);
  Image.clearMemoryCache = jest.fn().mockResolvedValue(true);
  return { Image };
});
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const mockConfirm = jest.fn();
jest.mock('@/components/comunica/comun/confirm', () => ({
  confirmAction: (...a: unknown[]) => mockConfirm(...a),
}));
const mockOpenLegacy = jest.fn();
jest.mock('@/hooks/comunica/useOpenLegacy', () => ({
  useOpenLegacy: () => mockOpenLegacy,
}));
const mockDownload = jest.fn();
const mockClearCopies = jest.fn();
const mockShare = jest.fn();
jest.mock('@/services/comunica/eventFiles', () => ({
  downloadToCache: (...a: unknown[]) => mockDownload(...a),
  clearOpenCopies: (...a: unknown[]) => mockClearCopies(...a),
  shareLocalFile: (...a: unknown[]) => mockShare(...a),
  openEventFile: jest.fn(),
}));
const mockPick = jest.fn();
jest.mock('@/hooks/comunica/pickFile', () => {
  const actual = jest.requireActual('@/hooks/comunica/pickFile');
  return { ...actual, pickFile: (...a: unknown[]) => mockPick(...a) };
});
const mockDeleteCopy = jest.fn();
jest.mock('@/services/comunica/localFiles', () => ({
  deleteLocalCopy: (...a: unknown[]) => mockDeleteCopy(...a),
  localFileSize: () => null,
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import DocumentDetailScreen from '@/components/comunica/documentos/DocumentDetailScreen';
import DocumentsScreen from '@/components/comunica/documentos/DocumentsScreen';
import DocumentUploadScreen from '@/components/comunica/documentos/DocumentUploadScreen';
import FileViewerScreen from '@/components/comunica/documentos/FileViewerScreen';
import SwipeableMonthCalendar from '@/components/calendar/SwipeableMonthCalendar';
import CalendarScreen from '@/components/comunica/calendario/CalendarScreen';
import MemberHome from '@/components/comunica/inicio/MemberHome';
import SessionScreen from '@/components/comunica/calendario/SessionScreen';
import {
  clearViewingFile,
  getViewingFile,
  setViewingFile,
} from '@/services/comunica/fileViewer';
import { dehydrateArea } from '@/services/comunica/persist';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
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
const plain = (n: unknown): string => {
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object' && 'children' in n)
    return (n as { children: unknown[] }).children.map(plain).join('');
  return '';
};
/** Todo el texto pintado (también el de componentes anidados dentro de un `Text`). */
const texts = (tree: ReactTestRenderer) => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as { children?: unknown[] };
    node.children?.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join(' | ');
};
/** Pulsar lo que se lee como `text` (un botón sin etiqueta de accesibilidad propia). */
const pressText = async (tree: ReactTestRenderer, text: string) => {
  const b = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && plain(n) === text,
  )[0];
  if (!b) throw new Error(`No hay nada que tocar con el texto «${text}»`);
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

const trees: ReactTestRenderer[] = [];
const clients: QueryClient[] = [];

async function setup(
  persona: PersonaId,
  screen: React.ReactElement,
  opts: {
    activeId?: string;
    controls?: Partial<FakeServer['controls']>;
    /** Antes de montar: preparar el falso o el almacén (p. ej. un intento que quedó a medias). */
    before?: (c: {
      fake: FakeServer;
      be: ReturnType<typeof memoryBackend>;
      personId: string;
    }) => Promise<void>;
  } = {},
) {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  const be = memoryBackend();
  setStorageBackend(be);
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0, ...opts.controls });
  const s = fake.issueSession(persona);
  await signIn(s, s.me);
  // A quién se ve: lo recordado por la persona (el hijo elegido).
  if (opts.activeId)
    await be.setItem(
      `@comunica/${s.me.personId}/profile`,
      JSON.stringify({ activeId: opts.activeId, chosen: true }),
    );
  await opts.before?.({ fake, be, personId: s.me.personId });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <ComunicaAreaProvider client={qc}>
            <ActiveProfileProvider>{screen}</ActiveProfileProvider>
          </ComunicaAreaProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  clients.push(qc);
  return { fake, be, qc, tree, me: s.me };
}

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

const LUCIA = 'f-hijo-lucia';
const NICO = 'f-hijo-sin-nombre';
const CLOCK = { clock: '2026-11-10T10:00:00Z' };
const docs = () => <DocumentsScreen />;
const detail = (id: string) => <DocumentDetailScreen id={id} />;
const hasLike = (tree: ReactTestRenderer, re: RegExp) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      re.test(n.props.accessibilityLabel),
  ).length > 0;
const pressLike = async (tree: ReactTestRenderer, re: RegExp) => {
  const b = tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      re.test(n.props.accessibilityLabel),
  )[0];
  if (!b) throw new Error(`No hay nada que tocar con ${re}`);
  await act(async () => {
    b.props.onPress();
  });
};
const type = async (tree: ReactTestRenderer, label: string, value: string) => {
  const f = tree.root.findAll(
    (n) =>
      typeof n.props.onChangeText === 'function' &&
      n.props.accessibilityLabel === label,
  )[0];
  if (!f) throw new Error(`No hay campo «${label}»`);
  await act(async () => {
    f.props.onChangeText(value);
  });
};
const downloaded = (fileName: string) => ({
  ok: true,
  uri: `file:///cache/comunica/open/${fileName}`,
  fileName,
});
const picked = (name: string, size = 1000) => ({
  uri: `file:///cache/${name}`,
  name,
  mimeType: 'application/pdf',
  size,
});

beforeEach(() => {
  mockDownload.mockReset();
  mockClearCopies.mockReset();
  mockShare.mockReset().mockResolvedValue(true);
  mockPick.mockReset();
  mockDeleteCopy.mockReset();
  mockConfirm.mockReset();
  clearViewingFile();
});

describe('«Documentos»', () => {
  it('el tipo en la cápsula, sin el nombre del archivo, «Caducado» al final y sin botón de descarga si no hay archivo', async () => {
    const { tree } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Autorización de salida'));
    const t = texts(tree);
    expect(t).toContain('PDF');
    expect(t).toContain('PNG');
    expect(t).toContain('JPG'); // certificado.jpeg
    expect(t).toContain('DOC'); // ficha.docx
    expect(t).toContain('Del ');
    for (const fileName of ['autorizacion.pdf', 'dni.png', 'certificado.jpeg'])
      expect(t).not.toContain(fileName);
    expect(t).toContain('Caducado');
    expect(t.indexOf('Certificado antiguo')).toBeGreaterThan(
      t.indexOf('Foto del DNI'),
    );
    expect(hasLike(tree, /^Descargar Autorización de salida$/)).toBe(true);
    expect(hasLike(tree, /^Descargar Pendiente de escanear$/)).toBe(false);
  });
  it('lo más reciente arriba', async () => {
    const { tree } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Autorización de salida'));
    const t = texts(tree);
    const order = [
      'Pendiente de escanear',
      'Ficha médica',
      'Autorización de salida',
      'Foto del DNI',
      'Certificado antiguo',
    ].map((n) => t.indexOf(n));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it('tocar la tarjeta abre la ficha (nunca descarga)', async () => {
    const { tree } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Autorización de salida'));
    const card = tree.root.findAll(
      (n) =>
        n.props.accessibilityHint === 'Abre el documento' &&
        String(n.props.accessibilityLabel).includes('Autorización de salida'),
    )[0];
    await act(async () => {
      card.props.onPress();
    });
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/documentos/[id]',
      params: { id: 'doc-aut' },
    });
    expect(mockDownload).not.toHaveBeenCalled();
  });
  it('el botón redondo descarga: un PDF va al visor (iOS), una imagen también, y un .docx a la hoja del sistema (con la copia borrada)', async () => {
    const { tree } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Descargar Autorización de salida$/));
    mockDownload.mockResolvedValueOnce(downloaded('autorizacion.pdf'));
    await pressLike(tree, /^Descargar Autorización de salida$/);
    await until(() =>
      mockRouter.push.mock.calls.some((c) => c[0] === '/comunica/archivo'),
    );
    expect(getViewingFile()).toMatchObject({
      kind: 'pdf',
      fileName: 'autorizacion.pdf',
      title: 'Autorización de salida',
    });
    mockDownload.mockResolvedValueOnce(downloaded('dni.png'));
    await pressLike(tree, /^Descargar Foto del DNI$/);
    await until(() => getViewingFile()?.kind === 'image');
    mockDownload.mockResolvedValueOnce(downloaded('ficha.docx'));
    await pressLike(tree, /^Descargar Ficha médica$/);
    await until(() => mockShare.mock.calls.length === 1);
    expect(mockShare).toHaveBeenCalledWith(
      'file:///cache/comunica/open/ficha.docx',
      'ficha.docx',
    );
    await until(() => mockClearCopies.mock.calls.length >= 2);
    // La descarga pide la ruta de documentos del perfil (nunca una URL armada por la pantalla).
    expect(mockDownload.mock.calls[0][0].uri).toContain(
      '/documents/doc-aut/file',
    );
    expect(mockDownload.mock.calls[0][1]).toBe('autorizacion.pdf');
  });
  it('un PDF en Android va a la hoja del sistema (hasta que entre «Abrir con…»)', async () => {
    const spy = jest.replaceProperty(
      require('react-native').Platform,
      'OS',
      'android',
    );
    const { tree } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Descargar Autorización de salida$/));
    mockDownload.mockResolvedValueOnce(downloaded('autorizacion.pdf'));
    await pressLike(tree, /^Descargar Autorización de salida$/);
    await until(() => mockShare.mock.calls.length === 1);
    expect(getViewingFile()).toBeNull();
    spy.restore();
  });
  it('sin conexión no se abre: «Necesitas conexión para abrir el documento»; si falla: «No se ha podido descargar…»', async () => {
    const { tree } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Descargar Autorización de salida$/));
    mockDownload.mockResolvedValueOnce({ ok: false, reason: 'offline' });
    await pressLike(tree, /^Descargar Autorización de salida$/);
    await until(() => mockToast.mock.calls.length === 1);
    expect(mockToast.mock.calls[0][0]).toMatchObject({
      label: 'Necesitas conexión para abrir el documento',
    });
    mockDownload.mockResolvedValueOnce({ ok: false, reason: 'failed' });
    await pressLike(tree, /^Descargar Autorización de salida$/);
    await until(() => mockToast.mock.calls.length === 2);
    expect(mockToast.mock.calls[1][0]).toMatchObject({
      label: 'No se ha podido descargar. Inténtalo otra vez.',
    });
  });
  it('al abrir Documentos se borra lo que se bajó para abrir', async () => {
    await setup('family', docs(), { activeId: LUCIA, controls: CLOCK });
    await until(() => mockClearCopies.mock.calls.length > 0);
  });
  it('NADA de Documentos llega al disco; el nombre de un documento tampoco', async () => {
    const { tree, qc, be } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Autorización de salida'));
    expect(
      qc
        .getQueryCache()
        .getAll()
        .some((q) => q.queryKey.join('/').includes('documents')),
    ).toBe(true);
    expect(
      dehydrateArea(qc).queries.some((q) =>
        q.queryKey.join('/').includes('documents'),
      ),
    ).toBe(false);
    const saved = JSON.stringify([dehydrateArea(qc), be.dump()]);
    for (const secret of [
      'Autorización de salida',
      'autorizacion.pdf',
      'Foto del DNI',
      'doc-aut',
    ])
      expect(saved).not.toContain(secret);
  });
  it('sin conexión y sin lo de esta sesión: «Los documentos se ven con conexión»', async () => {
    const { tree } = await setup('family', docs(), {
      activeId: LUCIA,
      controls: { ...CLOCK, failRoute: 'profileDocuments' },
    });
    await until(() =>
      texts(tree).includes('Los documentos se ven con conexión'),
    );
  });
  it('sin documentos: el texto de siempre y «Subir un documento»', async () => {
    const { tree } = await setup('family', docs(), {
      activeId: NICO,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Subir un documento'));
    expect(texts(tree)).toContain('Todavía no hay documentos del participante');
    expect(texts(tree)).toContain('Aquí se guarda y se descarga lo suyo');
    await pressLike(tree, /^Subir un documento$/);
    expect(mockRouter.push).toHaveBeenCalledWith('/comunica/documentos/subir');
  });
  it('viéndose a sí mismo: «Todavía no tienes…» con lo suyo', async () => {
    const { tree, fake, qc } = await setup('family', docs(), {
      activeId: 'f-per-familia',
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Mi DNI'));
    (fake as { getProfileDocuments: unknown }).getProfileDocuments =
      async () => ({ generatedAt: '2026-11-01T10:00:00Z', documents: [] });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'documents'] });
    });
    await until(() => texts(tree).includes('Todavía no tienes documentos'));
    expect(texts(tree)).toContain('Aquí guardas y descargas lo tuyo');
  });
});

describe('la ficha de un documento', () => {
  it('el archivo, la fecha, la caducidad, el estado, la categoría y la descripción', async () => {
    const { tree } = await setup('family', detail('doc-aut'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('autorizacion.pdf'));
    const t = texts(tree);
    expect(t).toContain('Archivo · PDF');
    expect(t).toContain('Caduca');
    expect(t).toContain('Activo');
    expect(t).toContain('Autorización');
    expect(
      tree.root.findAll(
        (n) =>
          n.props.accessibilityLabel === 'Descripción' &&
          n.props.value === 'Firmada por los padres.',
      ).length,
    ).toBeGreaterThan(0);
  });
  it('uno ajeno o borrado: «Este documento ya no está disponible» y «Volver», nunca «no es tuyo»', async () => {
    const { tree } = await setup('family', detail('doc-jaime'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() =>
      texts(tree).includes('Este documento ya no está disponible'),
    );
    expect(texts(tree)).toContain(
      'Vuelve al listado y entra de nuevo desde ahí.',
    );
    expect(texts(tree).toLowerCase()).not.toContain('no es tuyo');
    await pressText(tree, 'Volver');
    expect(mockRouter.replace).toHaveBeenCalledWith('/comunica/documentos');
  });
  it('editar manda solo lo que cambia; sin cambios, «Guardar» no escribe', async () => {
    const { tree, fake } = await setup('family', detail('doc-aut'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('autorizacion.pdf'));
    await pressLike(tree, /^Guardar$/);
    expect(fake.writeCount).toBe(0);
    await type(tree, 'Nombre', 'Autorización firmada');
    await pressLike(tree, /^Guardar$/);
    await until(() => mockToast.mock.calls.length > 0);
    expect(mockToast.mock.calls[0][0]).toMatchObject({
      label: 'Cambios guardados.',
    });
    const d = (await fake.getProfileDocument(LUCIA, 'doc-aut')).document;
    expect(d).toMatchObject({
      name: 'Autorización firmada',
      description: 'Firmada por los padres.',
      fileName: 'autorizacion.pdf',
    });
    expect(fake.writeCount).toBe(1);
  });
  it('sustituir el archivo: un archivo nuevo es una revisión nueva; uno malo no se envía', async () => {
    const { tree, fake } = await setup('family', detail('doc-aut'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('autorizacion.pdf'));
    mockPick.mockResolvedValueOnce(picked('virus.exe'));
    await pressLike(tree, /^Elegir un archivo$/);
    await until(() =>
      texts(tree).includes('Ese tipo de archivo no se puede subir'),
    );
    expect(fake.writeCount).toBe(0);
    mockPick.mockResolvedValueOnce(picked('nuevo.pdf'));
    await pressLike(tree, /^Elegir un archivo$/);
    await until(() => mockToast.mock.calls.length > 0);
    expect(
      (await fake.getProfileDocument(LUCIA, 'doc-aut')).document.fileName,
    ).toBe('nuevo.pdf');
  });
  it('eliminar: pide confirmar con sus textos; «Cancelar» no borra; confirmar sí, con su aviso y a la lista', async () => {
    const { tree, fake } = await setup('family', detail('doc-dni'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Eliminar documento$/));
    mockConfirm.mockResolvedValueOnce(false);
    await pressLike(tree, /^Eliminar documento$/);
    expect(mockConfirm).toHaveBeenCalledWith(
      'Eliminar documento',
      '¿Seguro que quieres borrar este documento? No se puede deshacer.',
      'Eliminar documento',
      true,
    );
    expect(fake.writeCount).toBe(0);
    mockConfirm.mockResolvedValueOnce(true);
    await pressLike(tree, /^Eliminar documento$/);
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(mockRouter.replace).toHaveBeenCalledWith('/comunica/documentos');
    expect(
      mockToast.mock.calls.some((c) => c[0].label === 'Documento eliminado'),
    ).toBe(true);
    expect(
      (await fake.getProfileDocuments(LUCIA)).documents.map((d) => d.id),
    ).not.toContain('doc-dni');
  });
  it('con el CRM caído: el aviso, el documento sigue y al volver borra sin duplicar', async () => {
    const { tree, fake } = await setup('family', detail('doc-dni'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Eliminar documento$/));
    fake.setControls({ crmDown: true });
    mockConfirm.mockResolvedValue(true);
    await pressLike(tree, /^Eliminar documento$/);
    await until(() =>
      texts(tree).includes(
        'No hemos podido guardar el cambio. Inténtalo otra vez en un rato.',
      ),
    );
    expect(
      (await fake.getProfileDocuments(LUCIA)).documents.map((d) => d.id),
    ).toContain('doc-dni');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    fake.setControls({ crmDown: false });
    await pressLike(tree, /^Eliminar documento$/);
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(fake.writeCount).toBe(1);
  });
  it('sin conexión (con la ficha en pantalla): «Guardar», «Abrir» y «Eliminar» no hacen nada y lo dice', async () => {
    const { tree, fake, qc } = await setup('family', detail('doc-aut'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('autorizacion.pdf'));
    await type(tree, 'Nombre', 'Otro');
    fake.setControls({ offline: true });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'documents'] });
    });
    await until(() => texts(tree).includes('Necesitas conexión'));
    await pressLike(tree, /^Guardar$/);
    await pressLike(tree, /^Eliminar documento$/);
    await pressLike(tree, /^Abrir$/);
    await wait(50);
    expect(fake.writeCount).toBe(0);
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
  });
  it('abrir y compartir desde la ficha', async () => {
    const { tree } = await setup('family', detail('doc-aut'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Compartir$/));
    mockDownload.mockResolvedValueOnce(downloaded('autorizacion.pdf'));
    await pressLike(tree, /^Compartir$/);
    await until(() => mockShare.mock.calls.length === 1);
    mockDownload.mockResolvedValueOnce(downloaded('autorizacion.pdf'));
    await pressLike(tree, /^Abrir$/);
    await until(() =>
      mockRouter.push.mock.calls.some((c) => c[0] === '/comunica/archivo'),
    );
  });
});

describe('subir un documento', () => {
  const upload = (offline = false) => (
    <DocumentUploadScreen offline={offline} />
  );
  it('sin archivo no se activa; al elegirlo, el nombre sale sin extensión y se sube directo; la copia se borra', async () => {
    const { tree, fake } = await setup('family', upload(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Subir documento$/));
    await pressLike(tree, /^Subir documento$/);
    expect(fake.writeCount).toBe(0);
    mockPick.mockResolvedValueOnce(picked('Informe final.pdf'));
    await pressLike(tree, /^Elegir un archivo$/);
    await until(
      () =>
        tree.root.findAll(
          (n) =>
            n.props.accessibilityLabel === 'Nombre' &&
            n.props.value === 'Informe final',
        ).length > 0,
    );
    await pressLike(tree, /^Subir documento$/);
    await until(() =>
      mockToast.mock.calls.some((c) => c[0].label === 'Documento subido'),
    );
    expect(mockRouter.back).toHaveBeenCalled();
    expect(
      (await fake.getProfileDocuments(LUCIA)).documents.map((d) => d.name),
    ).toContain('Informe final');
    expect(mockDeleteCopy).toHaveBeenCalledWith(
      'file:///cache/Informe final.pdf',
    );
    // El selector se abrió con todos los tipos (se comprueba después).
    expect(mockPick.mock.calls[0][1]).toEqual(['*/*']);
  });
  it('7 MB y un .exe se rechazan antes de enviar', async () => {
    const { tree, fake } = await setup('family', upload(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Elegir un archivo$/));
    mockPick.mockResolvedValueOnce(picked('grande.pdf', 7 * 1024 * 1024));
    await pressLike(tree, /^Elegir un archivo$/);
    await until(() => texts(tree).includes('Ese archivo pesa más de 4 MB'));
    mockPick.mockResolvedValueOnce(picked('virus.exe'));
    await pressLike(tree, /^Elegir un archivo$/);
    await until(() =>
      texts(tree).includes('Ese tipo de archivo no se puede subir'),
    );
    await pressLike(tree, /^Subir documento$/);
    expect(fake.writeCount).toBe(0);
  });
  it('con el CRM caído: el error y el mismo botón reintenta SIN duplicar', async () => {
    const { tree, fake } = await setup('family', upload(), {
      activeId: LUCIA,
      controls: { ...CLOCK, crmDown: true },
    });
    await until(() => hasLike(tree, /^Elegir un archivo$/));
    mockPick.mockResolvedValueOnce(picked('Justificante.pdf'));
    await pressLike(tree, /^Elegir un archivo$/);
    await until(
      () =>
        tree.root.findAll(
          (n) =>
            n.props.accessibilityLabel === 'Nombre' &&
            n.props.value === 'Justificante',
        ).length > 0,
    );
    await pressLike(tree, /^Subir documento$/);
    await until(() =>
      texts(tree).includes(
        'No hemos podido subir el documento. Inténtalo otra vez en un rato.',
      ),
    );
    expect(fake.writeCount).toBe(0);
    fake.setControls({ crmDown: false });
    await pressLike(tree, /^Subir documento$/);
    await until(() => mockRouter.back.mock.calls.length > 0);
    expect(
      (await fake.getProfileDocuments(LUCIA)).documents.filter(
        (d) => d.name === 'Justificante',
      ),
    ).toHaveLength(1);
  });
  it('sin conexión: «Subir documento» apagado y por qué', async () => {
    const { tree, fake } = await setup('family', upload(true), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Necesitas conexión para subir'));
    mockPick.mockResolvedValueOnce(picked('a.pdf'));
    await pressLike(tree, /^Elegir un archivo$/);
    await pressLike(tree, /^Subir documento$/);
    await wait(50);
    expect(fake.writeCount).toBe(0);
  });
  it('sin permiso para la cámara: el texto de siempre', async () => {
    const { PickerPermissionError } = jest.requireActual(
      '@/hooks/comunica/pickFile',
    );
    const { tree } = await setup('family', upload(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => hasLike(tree, /^Hacer una foto$/));
    mockPick.mockRejectedValueOnce(new PickerPermissionError());
    await pressLike(tree, /^Hacer una foto$/);
    await until(() =>
      texts(tree).includes(
        'Para hacer una foto, da permiso a la cámara en los Ajustes del móvil.',
      ),
    );
  });
});

describe('«Calendario»', () => {
  // La rejilla se desliza o se cambia con sus flechas; las dos acaban llamando a `onChangeMonth`.
  // Cada día de la rejilla son varios nodos con la misma frase; el que se toca de verdad es el más hondo.
  const pressDay = async (tree: ReactTestRenderer, re: RegExp) => {
    const nodes = tree.root.findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string' &&
        re.test(n.props.accessibilityLabel),
    );
    if (nodes.length === 0) throw new Error(`No hay ningún día con ${re}`);
    await act(async () => {
      nodes[nodes.length - 1].props.onPress();
    });
  };
  const changeMonth = async (tree: ReactTestRenderer, delta: number) => {
    await act(async () => {
      tree.root.findByType(SwipeableMonthCalendar).props.onChangeMonth(delta);
    });
  };
  const calendar = (view?: 'month' | 'agenda') => (
    <GestureHandlerRootView>
      <CalendarScreen initialView={view} />
    </GestureHandlerRootView>
  );
  it('el mes, el día de hoy elegido, la leyenda y los puntitos de cada día', async () => {
    const { tree } = await setup('family', calendar(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Noviembre 2026'));
    expect(texts(tree)).toContain('Martes, 10 de noviembre');
    for (const l of [
      'Próxima',
      'Asististe',
      'No asististe',
      'Sin registrar',
      'Abierto a inscripción',
      'Con plaza',
    ])
      expect(texts(tree)).toContain(l);
    // Hoy hay una sesión del curso.
    expect(hasLike(tree, /(?:^| )10 de noviembre, 1 actividad$/)).toBe(true);
    expect(texts(tree)).toContain('Sesión 11');
    expect(hasLike(tree, /(?:^| )5 de noviembre, sin actividades$/)).toBe(true);
  });
  it('tocar un día pinta debajo su lista con «hora · evento · estado»; uno sin nada, «No hay actividades este día»', async () => {
    const { tree } = await setup('family', calendar(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Noviembre 2026'));
    await pressDay(tree, /(?:^| )3 de noviembre, 1 actividad$/);
    expect(texts(tree)).toContain('Martes, 3 de noviembre');
    expect(texts(tree)).toContain(
      '17:30 – 19:00 · Curso de Catequesis MIC · No asististe',
    );
    await pressDay(tree, /(?:^| )5 de noviembre, sin actividades$/);
    expect(texts(tree)).toContain('No hay actividades este día');
  });
  it('cambiar de mes elige hoy si cae dentro; si no, el día 1', async () => {
    const { tree } = await setup('family', calendar(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Noviembre 2026'));
    await changeMonth(tree, 1);
    expect(texts(tree)).toContain('Diciembre 2026');
    expect(texts(tree)).toContain('Martes, 1 de diciembre');
    await changeMonth(tree, -1);
    expect(texts(tree)).toContain('Martes, 10 de noviembre');
  });
  it('la agenda: el mes por días; un mes vacío, «No hay actividades en estas fechas»', async () => {
    const { tree } = await setup('family', calendar('agenda'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Noviembre 2026'));
    expect(texts(tree)).toContain('Martes, 3 de noviembre');
    expect(texts(tree)).toContain('Martes, 24 de noviembre');
    expect(texts(tree)).not.toContain('Martes, 1 de diciembre');
    for (let i = 0; i < 7; i++) await pressLike(tree, /^Mes siguiente$/);
    expect(texts(tree)).toContain('Junio 2027');
    expect(texts(tree)).toContain('No hay actividades en estas fechas');
  });
  it('los destinos: una sesión a su hoja; un abierto, a la ficha del evento; uno con plaza, a Inscripciones', async () => {
    const { tree } = await setup('family', calendar('agenda'), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Noviembre 2026'));
    await pressLike(tree, /^Sesión 10\./);
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/comunica/calendario/sesion/[id]',
      params: { id: 'ses-f-hijo-lucia-10' },
    });
    // Las bandas: el evento abierto «Merienda de bienvenida» (dentro de 10 días) y «Sesiones semanales» con plaza (dentro de 3).
    await pressLike(tree, /^Merienda de bienvenida\./);
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: 'pev-sinc' },
    });
    await pressLike(tree, /^Sesiones semanales MIC 4\.º-6\.º EP\./);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/comunica/inscripciones');
  });
  it('el calendario de un hijo no es el del otro', async () => {
    const { tree } = await setup('family', calendar(), {
      activeId: NICO,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Noviembre 2026'));
    expect(hasLike(tree, /(?:^| )10 de noviembre, 1 actividad$/)).toBe(false);
    expect(texts(tree)).not.toContain('Sesión 11');
  });
  it('se guarda en el móvil (fechas y marcas) pero sin documentos; sin conexión y sin nada, «Necesitas conexión la primera vez»', async () => {
    const { tree, qc } = await setup('family', calendar(), {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Noviembre 2026'));
    const saved = dehydrateArea(qc).queries.map((q) => q.queryKey.join('/'));
    expect(saved.some((k) => k.includes('calendar'))).toBe(true);
    expect(saved.some((k) => k.includes('documents'))).toBe(false);
    const off = await setup('family', calendar(), {
      activeId: LUCIA,
      controls: { ...CLOCK, failRoute: 'profileCalendar' },
    });
    await until(() =>
      texts(off.tree).includes('Necesitas conexión la primera vez'),
    );
  });
});

describe('la sesión y el visor', () => {
  it('con inscripción: el nombre, el día, «17:30 – 19:00», el estado, el evento (a su ficha) y la descripción', async () => {
    const { tree } = await setup(
      'family',
      <SessionScreen id="ses-f-hijo-lucia-1" />,
      { activeId: LUCIA, controls: CLOCK },
    );
    await until(() => texts(tree).includes('Sesión 1'));
    const t = texts(tree);
    expect(t).toContain('Asististe');
    expect(t).toContain('17:30 – 19:00');
    expect(t).toContain('Curso de Catequesis MIC');
    expect(t).toContain('Sesión semanal: lectura, oración y un rato de juego.');
    await pressLike(tree, /^Ver el evento: Curso de Catequesis MIC$/);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: 'pev-curso' },
    });
  });
  it('sin inscripción activa a su evento: «Esta sesión ya no está disponible»', async () => {
    const { tree } = await setup(
      'family',
      <SessionScreen id="ses-f-hijo-lucia-1" />,
      { activeId: NICO, controls: CLOCK },
    );
    await until(() =>
      texts(tree).includes('Esta sesión ya no está disponible'),
    );
  });
  it('el visor: enseña lo que se abrió y al cerrarlo se borra la copia', async () => {
    setViewingFile({
      kind: 'image',
      uri: 'file:///cache/comunica/open/dni.png',
      fileName: 'dni.png',
      title: 'Foto del DNI',
    });
    const { tree } = await setup('family', <FileViewerScreen />, {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await wait(50);
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === 'Foto del DNI')
        .length,
    ).toBeGreaterThan(0);
    mockClearCopies.mockClear();
    await act(async () => {
      tree.unmount();
    });
    expect(mockClearCopies).toHaveBeenCalled();
    expect(getViewingFile()).toBeNull();
  });
  it('sin nada abierto: «Este archivo ya no está abierto»', async () => {
    const { tree } = await setup('family', <FileViewerScreen />, {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Este archivo ya no está abierto'));
  });
});

describe('guardarraíles', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..', '..');
  const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
  const walk = (d: string): string[] =>
    fs
      .readdirSync(path.join(root, d), { withFileTypes: true })
      .flatMap((e: { name: string; isDirectory(): boolean }) =>
        e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`],
      );
  const own = [
    ...walk('components/comunica/documentos'),
    ...walk('components/comunica/calendario'),
    'hooks/comunica/useDocuments.ts',
    'hooks/comunica/useCalendar.ts',
  ];
  it('ninguna pantalla de documentos ni de calendario hace `fetch`, arma URLs del servidor, usa la cola ni registra nada', () => {
    for (const f of own) {
      const s = read(f);
      expect(s).not.toMatch(/\bfetch\s*\(/);
      expect(s).not.toMatch(/['"`]\/v1\//);
      expect(s).not.toMatch(/enqueue|outbox/i);
      expect(s).not.toMatch(/\blogger\./);
    }
  });
  it('los archivos de un evento no pasan por la ruta de documentos y al revés', () => {
    for (const f of walk('components/comunica/actividades'))
      expect(read(f)).not.toMatch(/documentFileSource/);
    for (const f of own) expect(read(f)).not.toMatch(/eventFileSource/);
  });
  it('lo que se baja para abrir se borra al salir', () => {
    expect(read('services/comunica/index.ts')).toMatch(
      /addSignOutCleanup\(clearOpenCopies\)/,
    );
  });
  it('borrar solo sale del botón destructivo tras la confirmación', () => {
    const s = read('components/comunica/documentos/DocumentDetailScreen.tsx');
    expect(s.match(/writes\.remove\(/g)).toHaveLength(1);
    expect(s.indexOf('confirmAction(TXT.deleteTitle')).toBeLessThan(
      s.indexOf('writes.remove('),
    );
  });
});

describe('«Próximas actividades» de la portada', () => {
  it('viendo a un hijo: sus próximas actividades y «Ver calendario»; tocar una abre su destino', async () => {
    const { tree } = await setup('family', <MemberHome />, {
      activeId: LUCIA,
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Próximas actividades'));
    expect(texts(tree)).toContain('Ver calendario');
    await pressLike(tree, /^Merienda de bienvenida,/);
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: 'pev-sinc' },
    });
    await pressLike(tree, /^Ver calendario$/);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/comunica/calendario');
  });
  it('el familiar a secas no tiene Calendario, y la portada no enseña la agenda', async () => {
    const { tree } = await setup('family', <MemberHome />, {
      controls: CLOCK,
    });
    await until(() => texts(tree).includes('Tus pagos'));
    await wait(100);
    expect(texts(tree)).not.toContain('Próximas actividades');
  });
});
