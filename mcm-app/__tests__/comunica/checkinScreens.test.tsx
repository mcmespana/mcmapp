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
 *   · Habitaciones: cambiar desde la fila (con Deshacer), «Habitación al
 *     llegar», a varios a la vez, la vista por plantas con lo puesto a mano, y
 *     en la ficha; los pasados, plegados; Monitor/a y los datos personales
 *     (que no se guardan).
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
const mockToast = jest.fn();
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToast } }),
}));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => void store.set(k, v),
      removeItem: async (k: string) => void store.delete(k),
    },
  };
});
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
import RoomsScreen from '@/components/comunica/gestor/RoomsScreen';
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
    expect(t).toMatch(/\d+\/\d+ han llegado/);
    // Los pasados, abajo y plegados.
    expect(labelled(tree, /^Pasados, 1$/)).not.toHaveLength(0);
    expect(t).not.toMatch(/Convivencia de otoño/);
    expect(t.indexOf('Pascua joven')).toBeLessThan(t.indexOf('Pasados'));
    await press(tree, /^Pasados, 1$/);
    expect(texts(tree)).toMatch(/Convivencia de otoño/);
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
    // «Con nota» está en la hoja «Filtros», que lleva el número de lo puesto.
    await press(tree, /^Filtros y agrupar$/);
    await press(tree, /^Con nota, 3$/);
    expect(texts(tree)).toMatch(/Llega el sábado por la mañana/);
    expect(labelled(tree, /^Filtros, 1 puestos/)).not.toHaveLength(0);
    await press(tree, /^Faltan, \d+$/);
    expect(labelled(tree, /^Deshacer la llegada/)).toHaveLength(0);
    await press(tree, /^Quitar los filtros$/);
    expect(texts(tree)).not.toMatch(/Llega el sábado por la mañana/);
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
    await until(() => /En el evento/.test(texts(tree)));
    await press(tree, /^Ver la salud de/);
    await until(() =>
      qc
        .getQueryCache()
        .getAll()
        .some((q) => q.queryKey.includes('managedPersonal') && q.state.data),
    );
    await wait(50);
    const keys = dehydrateArea(qc).queries.map((q) => q.queryKey.join('/'));
    expect(keys.some((k) => k.endsWith(`managed-events/${MANAGED_NOW}`))).toBe(
      true,
    );
    expect(keys.some((k) => k.includes('managedHealth'))).toBe(false);
    expect(keys.some((k) => k.includes('managedPersonal'))).toBe(false);
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
    await press(tree, /^(Añadir una nota|Editar la nota)$/);
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
    // La nota se lee sin el campo abierto.
    expect(texts(tree)).toMatch(/Trae el saco/);
    // El orden: lo del evento arriba; contacto y pliegues después.
    const t2 = texts(tree);
    expect(t2.indexOf('En el evento')).toBeLessThan(t2.indexOf('Contacto'));
    expect(t2.indexOf('A tener en cuenta')).toBeLessThan(
      t2.indexOf('Contacto'),
    );
    expect(t2.indexOf('Contacto')).toBeLessThan(t2.indexOf('Autorizaciones'));
  });

  it('una persona que no es del evento: sin acceso', async () => {
    const { tree } = await setup(
      'coordination',
      <ManagedPersonScreen eventId={MANAGED_NOW} personId="f-per-01" />,
    );
    await until(() => /no está inscrita/.test(texts(tree)));
  });
});

/** El nombre de una inscripción del encuentro, como lo pinta la fila. */
const nameOf = (fake: FakeServer, registrationId: string) => {
  const r = serverRows(fake).people.find(
    (p) => p.reg.registrationId === registrationId,
  )!.reg;
  return `${r.firstName} ${r.lastName}`;
};
/** Una ficha del selector por su código. */
const tile = (tree: ReactTestRenderer, code: string) =>
  labelled(tree, new RegExp(`^Habitación ${code} · `))[0];

describe('habitaciones', () => {
  it('desde la fila: tocar la etiqueta, elegir, sube, y «Deshacer» la devuelve', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const ev = serverRows(fake);
    const placed = [...ev.checkins.values()].find((c) => c.roomId)!;
    const id = placed.registrationId;
    const name = nameOf(fake, id);
    await search(tree, name);
    await press(tree, /^Habitación \w+\. Cambiar$/);
    // La hoja: las vacías se ven, las llenas esperan detrás de un botón.
    expect(texts(tree)).toMatch(new RegExp(name));
    expect(texts(tree)).toMatch(/Con hueco/);
    expect(texts(tree)).toMatch(/Ver \d+ llenas? o pasadas?/);
    await act(async () => {
      tile(tree, 'C').props.onPress();
    });
    expect(texts(tree)).toMatch(/\bC\b/);
    await until(() => ev.checkins.get(id)?.roomId === 'f-ge-hab-casa-C');
    // El aviso, con su «Deshacer».
    const toast = mockToast.mock.calls.at(-1)![0];
    expect(toast.label).toBe(`${name} → Hab. C`);
    expect(toast.actionLabel).toBe('Deshacer');
    await act(async () => {
      toast.onActionPress({ hide: () => {} });
    });
    await until(() => ev.checkins.get(id)?.roomId === placed.roomId);
  });

  it('«Habitación al llegar»: al marcar a alguien sin habitación sale el selector', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const ev = serverRows(fake);
    // Alguien que falta y no tiene habitación.
    const loose = ev.people.find((p) => {
      const c = ev.checkins.get(p.reg.registrationId);
      return (
        !p.reg.registrationStatus && !c?.roomId && !c?.arrivedAt && !c?.absent
      );
    })!.reg;
    const name = `${loose.firstName} ${loose.lastName}`;
    const sw = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Habitación al llegar' &&
        typeof n.props.onValueChange === 'function',
    );
    await act(async () => {
      sw.props.onValueChange(true);
    });
    await search(tree, name);
    await press(tree, new RegExp(`^Llega ${name}$`));
    expect(texts(tree)).toMatch(/Ha llegado · \d\d:\d\d/);
    await act(async () => {
      tile(tree, 'C').props.onPress();
    });
    await until(
      () =>
        ev.checkins.get(loose.registrationId)?.roomId === 'f-ge-hab-casa-C' &&
        !!ev.checkins.get(loose.registrationId)?.arrivedAt,
    );
  });

  it('a varios a la vez: elegir y «Habitación»', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
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
    await pressText(tree, 'Habitación');
    expect(texts(tree)).toMatch(/2 personas/);
    await act(async () => {
      tile(tree, 'C').props.onPress();
    });
    const ev = serverRows(fake);
    await until(
      () =>
        [...ev.checkins.values()].filter((c) => c.roomId === 'f-ge-hab-casa-C')
          .length === 2,
    );
    expect(texts(tree)).not.toMatch(/seleccionados/);
  });

  it('sin cobertura: el cambio se ve al momento y sube después', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <CheckinScreen eventId={MANAGED_NOW} />,
    );
    await until(() => figure(tree) !== null);
    const ev = serverRows(fake);
    const placed = [...ev.checkins.values()].find((c) => c.roomId)!;
    await search(tree, nameOf(fake, placed.registrationId));
    fake.setControls({ offline: true });
    await press(tree, /^Habitación \w+\. Cambiar$/);
    await act(async () => {
      tile(tree, 'C').props.onPress();
    });
    await wait(50);
    expect(labelled(tree, /^Habitación C\. Cambiar$/)).not.toHaveLength(0);
    expect(texts(tree)).toMatch(/1 cambio sin subir/);
    expect(ev.checkins.get(placed.registrationId)?.roomId).toBe(placed.roomId);
    await wait(1100);
    fake.setControls({ offline: false });
    await until(
      () =>
        ev.checkins.get(placed.registrationId)?.roomId === 'f-ge-hab-casa-C',
      5000,
    );
  });

  it('la vista «Habitaciones»: sin habitación primero, por plantas, con lo puesto a mano', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <RoomsScreen eventId={MANAGED_NOW} />,
    );
    await until(() => /con habitación/.test(texts(tree)));
    const t = texts(tree);
    expect(t).toMatch(/Sin habitación/);
    expect(t.indexOf('Sin habitación')).toBeLessThan(t.indexOf('Planta 1'));
    // Cada alojamiento una vez y, debajo, sus plantas.
    expect(t).toMatch(/Albergue Los Pinos \| Planta 1/);
    expect(t).toMatch(/Casa del Huerto \| Sin planta/);
    // Lo puesto a mano ocupa y se ve.
    expect(t).toMatch(/Formador: Juan/);
    expect(t).toMatch(/Reservada para cocina/);
    expect(t).toMatch(/más gente que plazas/);
    expect(t).toMatch(/Vacía/);
    // Mover a alguien: tocarle abre el selector, con «Ver ficha».
    const ev = serverRows(fake);
    const placed = [...ev.checkins.values()].find((c) => c.roomId)!;
    const name = nameOf(fake, placed.registrationId);
    await press(tree, new RegExp(`^${name}, `));
    expect(texts(tree)).toMatch(/Ver ficha/);
    await act(async () => {
      tile(tree, 'C').props.onPress();
    });
    await until(
      () =>
        ev.checkins.get(placed.registrationId)?.roomId === 'f-ge-hab-casa-C',
    );
    await press(tree, new RegExp(`^${name}, `));
    await pressText(tree, 'Ver ficha');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/gestion/[eventId]/persona/[personId]',
      params: expect.objectContaining({ eventId: MANAGED_NOW }),
    });
  });
});

describe('la ficha, como la de Grupos', () => {
  it('la de un monitor despliega «Monitor/a»; la habitación se cambia desde aquí', async () => {
    const { tree, fake } = await setup('coordination', <></>);
    await fake.getManagedEvent(MANAGED_NOW);
    const mon = serverRows(fake).people.find(
      (p) => p.reg.role === 'monitor' && p.monitor,
    )!.reg;
    await act(async () => {
      tree.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <HeroUINativeProvider>
            <ComunicaAreaProvider client={clients.at(-1)!}>
              <ActiveProfileProvider>
                <ManagedPersonScreen
                  eventId={MANAGED_NOW}
                  personId={mon.personId}
                />
              </ActiveProfileProvider>
            </ComunicaAreaProvider>
          </HeroUINativeProvider>
        </SafeAreaProvider>,
      );
    });
    await until(() => /Monitor\/a desde/.test(texts(tree)));
    const t = texts(tree);
    expect(t).toMatch(/Trayectoria/);
    expect(t).toMatch(/Formación/);
    expect(t.indexOf('Monitor/a desde')).toBeLessThan(
      t.indexOf('Autorizaciones'),
    );
    await press(tree, /^(Cambiar de habitación|Poner habitación)/);
    await act(async () => {
      tile(tree, 'C').props.onPress();
    });
    await until(
      () =>
        serverRows(fake).checkins.get(mon.registrationId)?.roomId ===
        'f-ge-hab-casa-C',
    );
    expect(texts(tree)).toMatch(/Habitación C/);
  });

  it('los datos personales, completos y con documento, en su pliegue', async () => {
    const { tree, fake } = await setup(
      'coordination',
      <ManagedPersonScreen eventId={MANAGED_NOW} personId="f-ge-per-enc-02" />,
    );
    const p = serverRows(fake).people.find(
      (x) => x.reg.personId === 'f-ge-per-enc-02',
    )!;
    await until(() => /Datos personales/.test(texts(tree)));
    expect(texts(tree)).not.toMatch(/Monitor\/a desde/);
    await press(tree, /^Datos personales/);
    await until(() => texts(tree).includes(p.personal.document!.number));
  });
});
