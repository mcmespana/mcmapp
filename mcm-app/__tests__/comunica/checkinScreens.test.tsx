/**
 * «Eventos que gestionas» con el CABLEADO REAL (plan 18): el proveedor del
 * área, la cola, los hooks y el servidor falso.
 *
 *   · La portada enseña la entrada a quien gestiona (con papel de equipo o
 *     sin él) y a nadie más; la lista abre el check-in.
 *   · El check-in: la cifra grande, «Llega» que se ve al momento y sube,
 *     deshacer, marcar a varios, el buscador por trozos y los filtros.
 *   · Sin cobertura: se ve al momento, se queda en la cola y sube después con
 *     la hora en que se marcó.
 *   · El sondeo trae lo que marcan otros.
 *   · La ficha: llegada, nota y salud (que no se guarda).
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
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
jest.mock('expo-router/react-navigation', () => ({
  useIsFocused: () => true,
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
  useTabListScroll: () => ({
    listRef: { current: null },
    onScroll: undefined,
    contentPaddingBottom: 100,
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
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: jest.fn() } }),
}));
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.clearDiskCache = jest.fn().mockResolvedValue(true);
  Image.clearMemoryCache = jest.fn().mockResolvedValue(true);
  return { Image };
});
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('@/hooks/comunica/useOpenLegacy', () => ({
  useOpenLegacy: () => jest.fn(),
}));
jest.mock('@/components/NotificationPermissionBanner', () => () => null);

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import CheckinScreen from '@/components/comunica/gestor/CheckinScreen';
import ManagedEventsScreen from '@/components/comunica/gestor/ManagedEventsScreen';
import ManagedPersonScreen from '@/components/comunica/gestor/ManagedPersonScreen';
import ComunicaHome from '@/components/comunica/pasar-lista/ComunicaHome';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import {
  MANAGED_NOW,
  managedStateOf,
} from '@/services/comunica/fake/managedEvents';
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
const texts = (tree: ReactTestRenderer) => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    (n as { children?: unknown[] }).children?.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join(' | ');
};
const labelled = (tree: ReactTestRenderer, re: RegExp) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      re.test(n.props.accessibilityLabel),
  );
const press = async (tree: ReactTestRenderer, re: RegExp) => {
  const b = labelled(tree, re).at(0);
  if (!b) throw new Error(`No hay nada que tocar con ${re}`);
  await act(async () => {
    b.props.onPress();
  });
};
const plain = (n: unknown): string => {
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object' && 'children' in n)
    return (n as { children: unknown[] }).children.map(plain).join('');
  return '';
};
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

async function setup(persona: PersonaId, screen: React.ReactElement) {
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
            <ActiveProfileProvider>{screen}</ActiveProfileProvider>
          </ComunicaAreaProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  clients.push(qc);
  return { fake, qc, tree };
}

afterEach(async () => {
  jest.useRealTimers();
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

/** La cifra grande: «N / M». */
const figure = (tree: ReactTestRenderer) => {
  const m = /(\d+) \/ (\d+)/.exec(texts(tree));
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const serverRows = (fake: FakeServer) =>
  managedStateOf(fake.data)!.events.find((e) => e.id === MANAGED_NOW)!;
/** Escribir en el buscador. */
const search = async (tree: ReactTestRenderer, q: string) => {
  const input = tree.root.find(
    (n) =>
      typeof n.props.onChangeText === 'function' &&
      /^Buscar/.test(String(n.props.accessibilityLabel ?? '')),
  );
  await act(async () => {
    input.props.onChangeText(q);
  });
};

describe('la entrada en la portada', () => {
  it('sale a quien gestiona y es del equipo', async () => {
    const { tree } = await setup('coordination', <ComunicaHome />);
    await until(() => /Eventos que gestionas/.test(texts(tree)));
    expect(texts(tree)).toMatch(/Hacer el check-in/);
  });

  it('sale a quien gestiona sin papel de equipo', async () => {
    const { tree } = await setup('memberNoKids', <ComunicaHome />);
    await until(() => /Encuentro nacional de monitores/.test(texts(tree)));
    expect(texts(tree)).toMatch(/Eventos que gestionas/);
  });

  it('no sale a quien no gestiona nada', async () => {
    const { tree } = await setup('monitor', <ComunicaHome />);
    await until(() => /Pasar lista/.test(texts(tree)));
    await wait(100);
    expect(texts(tree)).not.toMatch(/Eventos que gestionas/);
  });

  it('la lista: hoy, próximos y pasados, y abre el check-in', async () => {
    const { tree } = await setup('coordination', <ManagedEventsScreen />);
    await until(() => /Pascua joven/.test(texts(tree)));
    const t = texts(tree);
    expect(t).toMatch(/Próximos/);
    expect(t).toMatch(/Ya pasados/);
    expect(t).toMatch(/\d+\/\d+ han llegado/);
    await press(tree, /^En marcha: Encuentro/);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/gestion/[eventId]',
      params: { eventId: MANAGED_NOW },
    });
  });
});

describe('el check-in', () => {
  it('«Llega» se ve al momento, sube y se deshace', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const [before, total] = figure(tree)!;
    const button = labelled(tree, /^Llega /)[0];
    const name = button.props.accessibilityLabel.replace(/^Llega /, '');
    await act(async () => {
      button.props.onPress();
    });
    expect(figure(tree)).toEqual([before + 1, total]);
    // Sube sola: el servidor la tiene, con quien la marcó.
    const reg = serverRows(fake).people.find(
      (p) => `${p.reg.firstName} ${p.reg.lastName}` === name,
    )!;
    await until(
      () => !!serverRows(fake).checkins.get(reg.reg.registrationId)?.arrivedAt,
    );
    expect(
      serverRows(fake).checkins.get(reg.reg.registrationId)!.arrivedBy,
    ).toMatch(/\(app\)$/);
    await press(tree, new RegExp(`^Deshacer la llegada de ${name}`));
    expect(figure(tree)).toEqual([before, total]);
    await until(
      () => !serverRows(fake).checkins.get(reg.reg.registrationId)?.arrivedAt,
    );
  });

  it('sin cobertura: se ve, se queda en la cola y sube con su hora', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const [before] = figure(tree)!;
    fake.setControls({ offline: true });
    const button = labelled(tree, /^Llega /)[0];
    const name = button.props.accessibilityLabel.replace(/^Llega /, '');
    const reg = serverRows(fake).people.find(
      (p) => `${p.reg.firstName} ${p.reg.lastName}` === name,
    )!;
    const marked = Date.now();
    await act(async () => {
      button.props.onPress();
    });
    await wait(50);
    expect(figure(tree)![0]).toBe(before + 1);
    expect(texts(tree)).toMatch(/1 cambio sin subir/);
    expect(
      serverRows(fake).checkins.get(reg.reg.registrationId)?.arrivedAt,
    ).toBeUndefined();
    // Vuelve la red: la cola lo reintenta sola y sube con la hora en que
    // se marcó, no la de ahora.
    await wait(1100);
    fake.setControls({ offline: false });
    await until(
      () => !!serverRows(fake).checkins.get(reg.reg.registrationId)?.arrivedAt,
      5000,
    );
    const at = Date.parse(
      serverRows(fake).checkins.get(reg.reg.registrationId)!.arrivedAt!,
    );
    expect(Math.abs(at - marked)).toBeLessThan(1000);
    await until(() => !/cambio sin subir/.test(texts(tree)));
  });

  it('marcar a varios: mantener pulsado, elegir y «Llegan»', async () => {
    const { tree } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const [before, total] = figure(tree)!;
    // Una por persona (el componente y su `Pressable` llevan las mismas props).
    const rows = [
      ...new Map(
        tree.root
          .findAll(
            (n) =>
              typeof n.props.onLongPress === 'function' &&
              /, Falta/.test(String(n.props.accessibilityLabel)),
          )
          .map((n) => [n.props.accessibilityLabel, n]),
      ).values(),
    ];
    expect(rows.length).toBeGreaterThan(2);
    await act(async () => {
      rows[0].props.onLongPress();
    });
    await act(async () => {
      tree.root
        .findAll(
          (n) =>
            n.props.accessibilityLabel === rows[1].props.accessibilityLabel &&
            typeof n.props.onPress === 'function',
        )[0]
        .props.onPress();
    });
    expect(texts(tree)).toMatch(/2 seleccionados/);
    await press(tree, /^Llegan \(2\)$/);
    expect(figure(tree)).toEqual([before + 2, total]);
    expect(texts(tree)).not.toMatch(/seleccionados/);
  });

  it('busca por trozos y filtra por «Faltan» y «Con nota»', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const someone = serverRows(fake).people[5].reg;
    await search(
      tree,
      `${someone.firstName.slice(0, 2)} ${someone.lastName.split(' ')[1].slice(0, 3)}`,
    );
    const t = texts(tree);
    expect(t).toContain(someone.firstName);
    expect(t).toMatch(/Inscritos \| 1\b|Inscritos \| [1-3]\b/);
    await search(tree, '');
    await press(tree, /^Con nota, 3$/);
    expect(texts(tree)).toMatch(/Llega el sábado por la mañana/);
    await press(tree, /^Faltan, \d+$/);
    expect(labelled(tree, /^Deshacer la llegada/)).toHaveLength(0);
  });

  it('el sondeo trae lo que marcan otros', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const [before] = figure(tree)!;
    fake.setControls({ othersCheckIn: true });
    await wait(4700);
    await until(() => figure(tree)![0] === before + 1, 2000);
  }, 15_000);

  it('el evento se guarda en el móvil; la salud, no', async () => {
    const { tree, qc } = await setup(
      'coordination',
      <ManagedPersonScreen eventId={MANAGED_NOW} personId="f-ge-per-enc-01" />,
    );
    await until(() => /Llegada/.test(texts(tree)));
    await press(tree, /^Ver la salud de/);
    await wait(50);
    const keys = dehydrateArea(qc).queries.map((q) => q.queryKey.join('/'));
    expect(keys.some((k) => k.endsWith(`managed-events/${MANAGED_NOW}`))).toBe(
      true,
    );
    expect(keys.some((k) => k.includes('managedHealth'))).toBe(false);
  });
});

describe('la ficha', () => {
  it('llegada, nota y familia', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <ManagedPersonScreen eventId={MANAGED_NOW} personId="f-ge-per-enc-02" />,
    );
    const reg = serverRows(fake).people.find(
      (p) => p.reg.personId === 'f-ge-per-enc-02',
    )!.reg;
    await until(() => /Madre/.test(texts(tree)));
    const t = texts(tree);
    expect(t).toContain(`${reg.firstName} ${reg.lastName}`);
    expect(t).toMatch(/Aún no ha llegado|Ha llegado|No viene/);
    if (/Aún no ha llegado/.test(t)) {
      await press(tree, new RegExp(`^Ha llegado ${reg.firstName}$`));
      expect(texts(tree)).toMatch(/Ha llegado a las \d\d:\d\d/);
      await until(
        () => !!serverRows(fake).checkins.get(reg.registrationId)?.arrivedAt,
      );
    }
    const note = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Nota' &&
        typeof n.props.onChangeText === 'function',
    );
    await act(async () => {
      note.props.onChangeText('Trae   el saco');
    });
    await pressText(tree, 'Guardar nota');
    await until(
      () =>
        serverRows(fake).checkins.get(reg.registrationId)?.note ===
        'Trae el saco',
    );
    expect(texts(tree)).toMatch(/Madre/);
  });

  it('una persona que no es del evento: sin acceso', async () => {
    const { tree } = await setup(
      'coordination',
      <ManagedPersonScreen eventId={MANAGED_NOW} personId="f-per-01" />,
    );
    await until(() => /no está inscrita/.test(texts(tree)));
  });
});
