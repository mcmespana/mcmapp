/**
 * Piezas comunes del área nativa y las pantallas de entrar (revisión B del
 * 24/10/2026): cada caso es un fallo que se vio y que no debe volver.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

// ── Dobles ──────────────────────────────────────────────────────────────────

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  dismissAll: jest.fn(),
  replace: jest.fn(),
  setParams: jest.fn(),
};
let mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 96,
}));
jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('@/components/ui/ComunicaLoader', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// La barra de pestañas: 100 de hueco, más lo que se pida encima.
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
// La hoja: pinta su título y su contenido mientras el Modal esté montado.
jest.mock('@/components/BottomSheet', () => {
  const { Text: T, View: V } = require('react-native');
  return ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <V>
      <T>{title}</T>
      {children}
    </V>
  );
});
jest.mock('@/hooks/comunica/useGrupos', () => ({
  useHealth: () => ({
    data: { items: [{ kind: 'allergies', text: 'Frutos secos' }] },
    error: null,
  }),
}));
const mockSignOut = jest.fn(async () => {});
jest.mock('@/services/comunica/session', () => ({
  signOut: () => mockSignOut(),
  signIn: jest.fn(),
}));
jest.mock('@/hooks/comunica/useMe', () => ({
  useMe: () => ({
    me: {
      name: 'Ana Monitora',
      delegation: { name: 'Valencia' },
      roles: ['monitor'],
    },
  }),
}));
jest.mock('@/hooks/comunica/useOutbox', () => ({
  useOutbox: () => ({ pending: [] }),
}));
const mockOpenLegacy = jest.fn(async () => {});
jest.mock('@/hooks/comunica/useOpenLegacy', () => ({
  useOpenLegacy: () => mockOpenLegacy,
}));
jest.mock('@/components/comunica/comun/ComunicaAreaProvider', () => ({
  useArea: () => ({ session: { status: 'signedIn', me: null } }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: jest.fn() }),
}));
let mockFake: object | null = null;
jest.mock('@/services/comunica', () => ({
  getFakeServer: () => mockFake,
  getComunicaApi: () => ({}),
}));

import AreaScreen from '@/components/comunica/comun/AreaScreen';
import BottomActionBar, {
  BOTTOM_ACTION_BAR_SPACE,
} from '@/components/comunica/comun/BottomActionBar';
import LegacyWebScreen, {
  pluginPageOf,
} from '@/components/comunica/comun/LegacyWebScreen';
import Section from '@/components/comunica/comun/Section';
import HealthSheet from '@/components/comunica/grupos/HealthSheet';
import AccountScreen from '@/components/comunica/acceso/AccountScreen';
import {
  clearAccessHandoffs,
  getChooseHandoff,
  getCodeHandoff,
  putChooseHandoff,
  putCodeHandoff,
} from '@/components/comunica/acceso/handoff';
import ComunicaAccesoCodigo from '@/app/(tabs)/comunica/acceso-codigo';
import ComunicaAccesoElegir from '@/app/(tabs)/comunica/acceso-elegir';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function mount(node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>{node}</HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');

const pressable = (tree: ReactTestRenderer, label: string) => {
  const b = tree.root
    .findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === label,
    )
    .at(0);
  if (!b) throw new Error(`No hay botón «${label}»`);
  return b;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockFake = null;
  clearAccessHandoffs();
});

// ── Section ─────────────────────────────────────────────────────────────────

describe('Section', () => {
  it('al filtrar, las filas que quedan NO se vuelven a montar', () => {
    const mounts: string[] = [];
    function Row({ id }: { id: string }) {
      useEffect(() => {
        mounts.push(id);
      }, [id]);
      return <Text>{id}</Text>;
    }
    const list = (ids: string[]) => (
      <Section title="Participantes">
        {ids.map((id) => (
          <Row key={id} id={id} />
        ))}
      </Section>
    );
    const tree = mount(list(['ana', 'bea', 'carla']));
    expect(mounts).toEqual(['ana', 'bea', 'carla']);
    // El buscador quita a «ana»: bea y carla se quedan donde estaban.
    act(() => {
      tree.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <HeroUINativeProvider>{list(['bea', 'carla'])}</HeroUINativeProvider>
        </SafeAreaProvider>,
      );
    });
    expect(mounts).toEqual(['ana', 'bea', 'carla']);
  });
});

// ── AreaScreen + BottomActionBar ────────────────────────────────────────────

describe('AreaScreen con BottomActionBar', () => {
  const padding = (tree: ReactTestRenderer) =>
    tree.root.findAllByType(ScrollView)[0].props.contentContainerStyle
      .paddingBottom as number;

  const screen = (
    <AreaScreen
      footer={
        <BottomActionBar>
          <Text>Guardar lista</Text>
        </BottomActionBar>
      }
    >
      <Text>Filas</Text>
    </AreaScreen>
  );

  it('antes de medir, reserva el mínimo', () => {
    const tree = mount(screen);
    expect(padding(tree)).toBe(100 + BOTTOM_ACTION_BAR_SPACE + 16);
  });

  it('una barra alta (aviso + recuentos + botón, letra grande) se reserva entera', () => {
    const tree = mount(screen);
    const bar = tree.root.findAll(
      (n) => n.type === View && n.props.testID === 'bottom-action-bar',
    )[0];
    // 290 medidos = 100 de la barra de pestañas + 190 de la de acciones.
    act(() => {
      bar.props.onLayout({ nativeEvent: { layout: { height: 290 } } });
    });
    expect(padding(tree)).toBe(290 + 16);
  });
});

// ── Hojas ───────────────────────────────────────────────────────────────────

describe('HealthSheet', () => {
  it('no se encoge a una hoja vacía mientras se cierra', () => {
    const person = { id: 'p1', firstName: 'Lucía', lastName: 'Arenas' };
    const tree = mount(<HealthSheet person={person} onClose={() => {}} />);
    expect(texts(tree)).toContain('Frutos secos');
    act(() => {
      tree.update(
        <SafeAreaProvider initialMetrics={METRICS}>
          <HeroUINativeProvider>
            <HealthSheet person={null} onClose={() => {}} />
          </HeroUINativeProvider>
        </SafeAreaProvider>,
      );
    });
    expect(texts(tree)).toContain('Lucía Arenas');
    expect(texts(tree)).toContain('Frutos secos');
  });
});

// ── Tu cuenta ───────────────────────────────────────────────────────────────

describe('Tu cuenta', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
    delete (globalThis as { confirm?: unknown }).confirm;
  });

  it('en web, «Salir» pregunta y, si se cancela, no sale', async () => {
    Platform.OS = 'web';
    const confirm = jest.fn(() => false);
    (globalThis as { confirm?: unknown }).confirm = confirm;
    const tree = mount(<AccountScreen />);
    await act(async () => {
      pressable(tree, 'Salir').props.onPress();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('en web, «Salir» confirmado sí sale', async () => {
    Platform.OS = 'web';
    (globalThis as { confirm?: unknown }).confirm = jest.fn(() => true);
    const tree = mount(<AccountScreen />);
    await act(async () => {
      pressable(tree, 'Salir').props.onPress();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('«Abrir la versión web» abre la portada con pase, no la web suelta', async () => {
    const tree = mount(<AccountScreen />);
    await act(async () => {
      pressable(tree, 'Abrir la versión web').props.onPress();
    });
    expect(mockOpenLegacy).toHaveBeenCalledWith(
      { internalpage: 'single_stic_home' },
      'Comunica',
    );
    expect(mockRouter.push).not.toHaveBeenCalledWith('/comunica/web');
  });
});

// ── Entrar: lo sensible, en memoria ─────────────────────────────────────────

describe('entrar sin datos en la URL', () => {
  it('la llave es opaca: no lleva ni el DNI ni el código', () => {
    const k = putCodeHandoff({
      via: 'dni',
      value: '12345678Z',
      sentTo: 'a***@x.org',
    });
    expect(k).not.toMatch(/12345678Z|a\*\*\*/);
    expect(getCodeHandoff(k)).toEqual({
      via: 'dni',
      value: '12345678Z',
      sentTo: 'a***@x.org',
    });
    const k2 = putChooseHandoff({
      body: { email: 'dos@ejemplo.org', code: '123456' },
      choices: [
        { personId: 'p1', name: 'Hugo Campos', delegation: 'Valencia' },
      ],
    });
    expect(k2).not.toMatch(/123456|Hugo/);
    // Una llave no sirve para la otra pantalla.
    expect(getCodeHandoff(k2)).toBeNull();
    expect(getChooseHandoff(k)).toBeNull();
  });

  it('acceso-elegir con un enlace roto o sin llave no tumba la app', () => {
    mockParams = { body: '{roto', choices: '[' };
    const tree = mount(<ComunicaAccesoElegir />);
    expect(texts(tree)).toContain('Vuelve a pedir el código');
  });

  it('acceso-codigo con `value` en la URL lo ignora: solo vale la llave', () => {
    mockParams = { via: 'dni', value: '12345678Z' };
    const tree = mount(<ComunicaAccesoCodigo />);
    expect(texts(tree)).toContain('Vuelve a pedir el código');
    expect(texts(tree)).not.toContain('12345678Z');
  });

  it('las pantallas de entrar no meten datos de la persona en la URL', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const dir = path.join(__dirname, '..', '..', 'components', 'comunica');
    // Cada `params` de un salto entre pantallas de entrar lleva solo la llave.
    for (const f of ['acceso/AccessScreen.tsx', 'acceso/CodeScreen.tsx']) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const params = src.match(/params:\s*\{[^:}]*:/g) ?? [];
      expect(params.length).toBeGreaterThan(0);
      for (const p of params) expect(p).toMatch(/params:\s*\{\s*k:$/);
    }
  });
});

// ── El legado ───────────────────────────────────────────────────────────────

describe('LegacyWebScreen', () => {
  it('reconoce las páginas del área del plugin', () => {
    expect(
      pluginPageOf(
        'https://comunica.movimientoconsolacion.com/ap/?app=1&internalpage=single_stic_pasar_lista_evento',
      ),
    ).toBe('single_stic_pasar_lista_evento');
    expect(
      pluginPageOf('https://comunica.movimientoconsolacion.com/ap/?app=1'),
    ).toBe('portada');
    expect(
      pluginPageOf('https://comunica.movimientoconsolacion.com/actividades'),
    ).toBeNull();
    expect(pluginPageOf('no es una url')).toBeNull();
  });

  it('con el servidor falso enseña la muestra en vez de la web que pide entrar', () => {
    mockFake = {};
    const tree = mount(
      <LegacyWebScreen
        url="https://comunica.movimientoconsolacion.com/ap/?app=1&internalpage=single_stic_pasar_lista_evento"
        title="Pasar lista"
      />,
    );
    expect(texts(tree)).toContain('single_stic_pasar_lista_evento');
  });
});
