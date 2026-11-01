/**
 * Las pantallas de eventos de familias (plan 13) con el CABLEADO REAL: el
 * proveedor del área, los hooks y el servidor falso. El perfil activo se da
 * por contexto (lo que monta `ActiveProfileProvider`).
 *
 *   · «Eventos»: los dos bloques con sus títulos, sin lo pasado ni lo oculto.
 *   · Ficha de otra delegación: el motivo y sin «Inscribirme».
 *   · Ficha con plaza: lleva a SU inscripción (directa, no a la lista).
 *   · Un evento oculto no sale en la lista, pero su ficha por enlace deja
 *     apuntarse.
 *   · Cambiar de hijo en la ficha: la misma ficha con el otro perfil.
 *   · El cuerpo: todos los bloques; un `javascript:` no es enlace.
 *   · La ficha pública: sin sesión, «Entra para apuntarte»; con sesión,
 *     `replace` a la ficha.
 *   · Guardarraíles: nada de HTML ni WebView en `actividades/`, ni ids de
 *     documentos en los registros.
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

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: () => true,
};
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
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
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: jest.fn() } }),
}));
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.clearDiskCache = jest.fn().mockResolvedValue(true);
  Image.clearMemoryCache = jest.fn().mockResolvedValue(true);
  return { Image };
});
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({}),
}));
const mockOpenFile = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/comunica/localFiles', () => ({
  deleteLocalCopy: jest.fn(),
  localFileSize: () => null,
  openRemoteFile: (...a: unknown[]) => mockOpenFile(...a),
  clearOpenedFiles: jest.fn(),
}));
jest.mock('@/components/comunica/eventos/ShareEventButton', () => () => null);
jest.mock('@/components/comunica/perfiles/ActiveProfileBar', () => () => null);
const mockOpenDestination = jest.fn();
jest.mock('@/hooks/comunica/useOpenDestination', () => ({
  useOpenDestination: () => mockOpenDestination,
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import ActivitiesScreen from '@/components/comunica/actividades/ActivitiesScreen';
import EventBody from '@/components/comunica/actividades/EventBody';
import EventDetailScreen from '@/components/comunica/actividades/EventDetailScreen';
import PublicEventScreen from '@/components/comunica/actividades/PublicEventScreen';
import {
  ActiveProfileContext,
  type ActiveProfile,
} from '@/hooks/comunica/useActiveProfile';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import { createFakeServer, type FakeServer } from '@/services/comunica/fake';
import { FAMILY_EVENT_IDS as ID } from '@/services/comunica/fake/familyEvents';
import {
  __resetSessionForTests,
  initSession,
  signOut,
  signIn,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const CLOCK = '2026-11-02T10:00:00Z';
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
/** Todo el texto pintado (también el de los `Text` anidados). */
const texts = (tree: ReactTestRenderer) => {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string') out.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object' && 'children' in n) {
      walk((n as { children: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out.join(' | ');
};
const until = async (fn: () => boolean, ms = 3000) => {
  for (let i = 0; i < ms / 25; i++) {
    if (fn()) return;
    await wait(25);
  }
  throw new Error('No ha pasado a tiempo');
};

const ROSA = {
  id: 'f-fam-rosa',
  firstName: 'Rosa',
  lastName: 'Martín',
  gender: 'female' as const,
};
const LUCIA = {
  id: 'f-fam-lucia',
  firstName: 'Lucía',
  lastName: 'Messeguer',
  gender: 'female' as const,
};
const OTRO = {
  id: 'f-fam-sin-nombre',
  firstName: null,
  lastName: null,
  gender: null,
};

/** El perfil activo: Rosa viendo a uno de sus hijos. */
const profile = (child: typeof LUCIA | typeof OTRO): ActiveProfile => ({
  ready: true,
  pid: child.id,
  profile: child,
  self: ROSA,
  children: [LUCIA, OTRO],
  hasChildren: true,
  viewingSelf: false,
  audience: 'child',
  member: false,
  chosen: true,
  mustChoose: false,
  childFirstName: child.firstName ?? 'Participante',
  choose: () => {},
  profilesQuery: null,
  registerScope: () => () => {},
  currentScope: () => null,
});

let qc: QueryClient;
const wrap = (screen: React.ReactElement, active: ActiveProfile) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <HeroUINativeProvider>
      <ComunicaAreaProvider client={qc}>
        <ActiveProfileContext.Provider value={active}>
          {screen}
        </ActiveProfileContext.Provider>
      </ComunicaAreaProvider>
    </HeroUINativeProvider>
  </SafeAreaProvider>
);

async function setup(
  screen: React.ReactElement,
  active = profile(LUCIA),
  signedIn = true,
) {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0, persona: 'guardianTwo', clock: CLOCK });
  if (signedIn) {
    const s = fake.issueSession('guardianTwo');
    await signIn(s, s.me);
  } else {
    await initSession();
    await signOut();
  }
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(wrap(screen, active));
  });
  return tree;
}

afterEach(() => {
  __resetComunicaApiForTests();
  __resetSessionForTests();
  qc?.clear();
  mockParams = {};
  jest.clearAllMocks();
});

const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root
    .findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        (n.props.accessibilityLabel === label || n.props.label === label),
      { deep: false },
    )
    .at(0);

describe('«Eventos» de familias', () => {
  it('los dos bloques con sus títulos, sin lo pasado ni lo oculto sin plaza', async () => {
    const tree = await setup(<ActivitiesScreen />);
    await until(() => texts(tree).includes('Para apuntarte'));
    const all = texts(tree);
    expect(all).toContain('Te has apuntado');
    expect(all).toContain('Convivencia de otoño COM');
    expect(all).toContain('Salida de los delegados'); // oculta, con plaza
    expect(all).not.toContain('Reunión de preparación (oculta)');
    expect(all).not.toContain('Fiesta de inicio de curso'); // pasada
    expect(all).not.toContain('Encuentro de Puerto Alto'); // otra delegación
    expect(all.indexOf('Para apuntarte')).toBeLessThan(
      all.indexOf('Te has apuntado'),
    );
    act(() => tree.unmount());
  });
});

describe('la ficha', () => {
  it('de otra delegación: explica el motivo y no tiene «Inscribirme»', async () => {
    mockParams = { eventId: ID.otraDelegacion };
    const tree = await setup(<EventDetailScreen />);
    await until(() => texts(tree).includes('Encuentro de Puerto Alto'));
    const all = texts(tree);
    expect(all).toContain('Esta actividad no es para ti');
    expect(all).toContain('la organiza otra delegación');
    expect(all).toContain('Ver otras actividades');
    expect(byLabel(tree, 'Inscribirme en esta actividad')).toBeUndefined();
    act(() => tree.unmount());
  });

  it('con plaza: «Ver su inscripción» va directa a la inscripción', async () => {
    mockParams = { eventId: ID.ocultaConPlaza };
    const tree = await setup(<EventDetailScreen />);
    await until(() => texts(tree).includes('Ver su inscripción'));
    expect(texts(tree)).toContain(
      'Lucía ya tiene una inscripción para esta actividad.',
    );
    const link = tree.root.findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n
          .findAllByType(Text)
          .some((t) => t.props.children === 'Ver su inscripción'),
      { deep: false },
    )[0];
    await act(async () => link.props.onPress());
    expect(mockOpenDestination).toHaveBeenCalledWith(
      {
        internalpage: 'single_stic_registrations',
        action: 'detail',
        id: expect.stringMatching(/^5e9e/),
      },
      'Inscripción',
    );
    act(() => tree.unmount());
  });

  it('un evento oculto no sale en la lista, pero su ficha por enlace deja apuntarse', async () => {
    mockParams = { eventId: ID.ocultaSinPlaza };
    const tree = await setup(<EventDetailScreen />);
    await until(() => texts(tree).includes('Reunión de preparación (oculta)'));
    const button = byLabel(tree, 'Inscribirme en esta actividad');
    expect(button).toBeDefined();
    await act(async () => button!.props.onPress());
    expect(mockOpenDestination).toHaveBeenCalledWith(
      {
        internalpage: 'single_stic_registrations',
        action: 'create',
        from: 'stic_events',
        id: ID.ocultaSinPlaza,
      },
      'Inscribirme',
    );
    act(() => tree.unmount());
  });

  it('cambiar de hijo deja la misma ficha con el otro perfil', async () => {
    mockParams = { eventId: ID.sesionesMic };
    const tree = await setup(<EventDetailScreen />);
    await until(() =>
      texts(tree).includes('Esta actividad es para otros cursos'),
    );
    await act(async () => {
      tree.update(wrap(<EventDetailScreen />, profile(OTRO)));
    });
    await until(() => texts(tree).includes('Ver su inscripción'));
    expect(texts(tree)).toContain('Sesiones semanales MIC');
    expect(texts(tree)).not.toContain('Esta actividad es para otros cursos');
    act(() => tree.unmount());
  });

  it('un adjunto se abre con la sesión por su evento (el abridor)', async () => {
    mockParams = { eventId: ID.convivencia };
    const tree = await setup(<EventDetailScreen />);
    await until(() => texts(tree).includes('Toda la información'));
    const pdf = byLabel(tree, 'Autorización de salida, PDF');
    await act(async () => pdf!.props.onPress());
    expect(mockOpenFile).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: expect.stringMatching(/^data:application\/pdf/),
      }),
      'Autorización de salida.pdf',
      'application/pdf',
    );
    act(() => tree.unmount());
  });

  it('lo inexistente: «Esta actividad ya no está disponible»', async () => {
    mockParams = { eventId: 'ac7e0000-0000-4000-8000-999999999999' };
    const tree = await setup(<EventDetailScreen />);
    await until(() =>
      texts(tree).includes('Esta actividad ya no está disponible'),
    );
    act(() => tree.unmount());
  });
});

describe('el cuerpo', () => {
  it('pinta todos los bloques; un `javascript:` no es enlace', async () => {
    const fake = createFakeServer({
      latencyMs: 0,
      persona: 'guardianTwo',
      clock: CLOCK,
    });
    const e = await fake.getActivity('f-fam-lucia', ID.convivencia);
    const onLink = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <HeroUINativeProvider>
          <EventBody
            blocks={e.body}
            resolve={() => null}
            onLink={onLink}
            onImage={jest.fn()}
            onVideo={jest.fn()}
          />
        </HeroUINativeProvider>,
      );
    });
    const all = texts(tree);
    for (const s of [
      'Qué vamos a hacer',
      'El programa',
      'Trae saco de dormir',
      '1.',
      '•',
      'Formulario de autorización',
      'El albergue, desde el camino',
      'Ver el vídeo',
    ]) {
      expect(all).toContain(s);
    }
    const links = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'link' &&
        typeof n.props.onPress === 'function',
      { deep: false },
    );
    type Node = { children: (Node | string)[] };
    const textOf = (n: Node): string =>
      n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
    const linkTexts = links.map((l) => textOf(l as unknown as Node));
    expect(linkTexts.some((t) => t.includes('600 111 222'))).toBe(true);
    expect(linkTexts.some((t) => t === 'este')).toBe(false);
    act(() => tree.unmount());
  });
});

describe('la ficha pública', () => {
  it('sin sesión: «Entra para apuntarte»', async () => {
    mockParams = { slug: ID.slug };
    const tree = await setup(<PublicEventScreen />, profile(LUCIA), false);
    await until(() => texts(tree).includes('Entra para apuntarte'));
    act(() => tree.unmount());
  });

  it('con sesión: busca por el slug y hace `replace` a la ficha', async () => {
    mockParams = { slug: ID.slug };
    const tree = await setup(<PublicEventScreen />);
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: ID.convivencia },
    });
    act(() => tree.unmount());
  });
});

describe('guardarraíles de eventos de familias', () => {
  const ROOT = path.join(__dirname, '..', '..');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory()
        ? walk(full)
        : /\.tsx?$/.test(e.name)
          ? [full]
          : [];
    });
  const files = [
    ...walk(path.join(ROOT, 'components/comunica/actividades')),
    ...walk(path.join(ROOT, 'app/(tabs)/comunica/actividades')),
  ];

  it('nada de render-html ni WebView en actividades/', () => {
    expect(files.length).toBeGreaterThan(5);
    const offenders = files.filter((f) =>
      /from '(react-native-render-html|react-native-webview)'/.test(
        fs.readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('ni los documentos ni sus rutas pasan por el logger', () => {
    const more = [
      path.join(ROOT, 'hooks/comunica/useOpenFile.ts'),
      path.join(ROOT, 'hooks/comunica/useActivities.ts'),
      path.join(ROOT, 'services/comunica/localFiles.ts'),
    ];
    const offenders = [...files, ...more].filter((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .some((l) => /logger\.\w+\(.*(documentId|uri|fileName|source)/.test(l)),
    );
    expect(offenders).toEqual([]);
  });
});
