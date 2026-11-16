/* eslint-disable max-lines -- una sola suite para la pantalla: los dobles (visor, hook, hojas) son lo caro y se comparten; partirla obligaría a copiarlos. */
/**
 * La pantalla del pañuelo virtual (`app/panuelo.tsx`): que pinta la colección,
 * que todo lo que se hace tocando el 3D se puede hacer también desde la UI
 * nativa (el 3D es opaco para VoiceOver y TalkBack), que cerrado el
 * interruptor devuelve a Inicio, que `?codigo=` abre el canje y las etiquetas
 * de accesibilidad.
 *
 * El visor 3D (un WebView) y el hook de estado se sustituyen por dobles: aquí
 * se prueba la pantalla, no el visor ni Firebase. La lógica de colección,
 * resumen y colocación es la de verdad (`utils/panuelo.ts`).
 */
import React from 'react';
import { AccessibilityInfo, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import PanueloRoute from '@/app/panuelo';
import CelebrationBurst from '@/components/ui/CelebrationBurst';
import { PanueloColors } from '@/constants/colors';
import {
  PANUELO_TUTORIAL,
  PANUELO_TUTORIAL_VERSION,
} from '@/constants/panueloTutorial';
import { PANUELO_TUTORIAL_KEY } from '@/hooks/usePanueloTutorial';
import type {
  PanueloCatalog,
  PanueloEvent,
  PanueloMemory,
  PanueloUserState,
  PanueloViewerState,
} from '@/types/panuelo';
import { h } from '@/utils/haptics';

// ── Dobles ──────────────────────────────────────────────────────────────────

const mockRouter: { params: Record<string, string> } = { params: {} };
const mockToastShow = jest.fn();
const mockSetOptions = jest.fn();
// Estos tests usan las piezas de ejemplo (una de cada clase), no el catálogo
// de verdad, que cambia cada vez que se añade una chapa.
jest.mock('@/firebase-seed/panuelo.json', () =>
  jest.requireActual('@/constants/panueloEjemplo.json'),
);
jest.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 0,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

jest.mock('expo-router', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    Redirect: (props: { href: string }) =>
      Local.createElement('Redirect', { href: props.href }),
    useLocalSearchParams: () => mockRouter.params,
    // La cabecera nativa: en iOS el «?» es un botón de `Stack.Toolbar`.
    Stack: {
      Toolbar: Object.assign(
        (props: { children?: React.ReactNode }) =>
          Local.createElement('Toolbar', null, props.children),
        {
          Button: (props: Record<string, unknown>) =>
            Local.createElement('ToolbarButton', props),
        },
      ),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('heroui-native', () => {
  const Local = jest.requireActual<typeof React>('react');
  const { Pressable } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const PressableFeedback = Object.assign(
    (props: React.ComponentProps<typeof Pressable>) =>
      Local.createElement(Pressable, props),
    { Highlight: () => null, Scale: () => null },
  );
  return {
    PressableFeedback,
    useToast: () => ({ toast: { show: mockToastShow } }),
  };
});

jest.mock('@/components/ui/icons', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    MaterialIcons: (props: Record<string, unknown>) =>
      Local.createElement('MaterialIcons', props),
  };
});

jest.mock('@/components/ui/IconSymbol', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    IconSymbol: (props: Record<string, unknown>) =>
      Local.createElement('IconSymbol', props),
  };
});

// Lo que dice Comunica (`mcm.scarf`): lo decide cada prueba.
const mockScarf: { value: string | null } = { value: null };
jest.mock('@/hooks/usePanueloScarf', () => ({
  usePanueloScarf: () => mockScarf.value,
}));

jest.mock('@/components/medallas/Medalla3DModal', () => ({
  Medalla3DModal: () => null,
}));

jest.mock('@/components/BottomSheet', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    __esModule: true,
    default: (props: {
      visible: boolean;
      title?: string;
      children: React.ReactNode;
    }) =>
      props.visible
        ? Local.createElement(
            'BottomSheet',
            { title: props.title },
            props.children,
          )
        : null,
  };
});

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
// La hoja de intercambios (sin sesión enseña el login): solo se mira que abre.
jest.mock('@/components/SocialLoginSection', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/playlist/QrScannerModal', () => ({
  __esModule: true,
  default: () => null,
  isQrScanSupported: () => false,
}));
jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isWide: false }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock('@/contexts/PreviewChannelContext', () => ({
  usePreviewChannel: () => ({ enabled: false }),
}));
jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));
const mockConfirm = jest.fn();
jest.mock('@/utils/confirmDialog', () => ({
  confirmAsync: (...args: unknown[]) => mockConfirm(...args),
}));

// «Reducir movimiento» del sistema: lo decide cada prueba.
const mockMotion = { reduced: false };
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return new Proxy(actual, {
    get: (target, key) =>
      key === 'useReducedMotion' ? () => mockMotion.reduced : target[key],
  });
});
// El confeti se prueba por lo que se le pide (color, visible), no por cómo se
// anima: Reanimated no corre bajo Jest.
jest.mock('@/components/ui/CelebrationBurst', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/utils/panueloShare', () => ({
  sharePanueloSnapshot: jest.fn(() => Promise.resolve()),
}));

const mockAvailable = { available: true, settled: true };
jest.mock('@/hooks/usePanueloAvailable', () => ({
  usePanueloAvailable: () => mockAvailable,
}));

// El visor: guarda sus props y expone `send` como un mock.
const mockSend = jest.fn();
const mockViewer: {
  props: {
    accessibilityLabel?: string;
    accessibilityHint?: string;
    state?: PanueloViewerState;
    mode?: 'view' | 'edit';
    onEvent?: (event: PanueloEvent) => void;
  };
} = { props: {} };
jest.mock('@/components/panuelo/Panuelo3D', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    Panuelo3D: Local.forwardRef(function Panuelo3D(
      props: Record<string, unknown>,
      ref: React.Ref<unknown>,
    ) {
      mockViewer.props = props as typeof mockViewer.props;
      Local.useImperativeHandle(ref, () => ({ send: mockSend }));
      return null;
    }),
  };
});

// El estado: una colección pequeña, con las acciones espiadas.
const CATALOG: PanueloCatalog = {
  chapa1: {
    id: 'chapa1',
    kind: 'chapa',
    name: 'Chapa uno',
    origin: 'Pascua Joven',
    look: { kind: 'chapa', bg: '#ffffff', glyph: 'star' },
    order: 1,
  },
  pin1: {
    id: 'pin1',
    kind: 'pin',
    name: 'Pin uno',
    look: { kind: 'pin', shape: 'heart', enamel: '#ffffff' },
    order: 2,
  },
  medalla1: {
    id: 'medalla1',
    kind: 'medalla',
    name: 'Medalla lejana',
    look: { kind: 'medalla', ribbon: ['#ffffff'] },
    grant: { type: 'code', hash: 'x' },
    order: 3,
  },
  secreta: {
    id: 'secreta',
    kind: 'chapa',
    name: 'Chapa secreta',
    look: { kind: 'chapa', bg: '#ffffff' },
    secret: true,
    order: 4,
  },
};

const STATE: PanueloUserState = {
  color: 'blue',
  items: {
    chapa1: { at: 2000, via: 'all' },
    pin1: { at: 1000, via: 'all' },
  },
  layout: { chapa1: { u: 0, v: 0.5, rot: 0 } },
  layoutAt: 1,
};

const mockPanuelo = {
  ready: true,
  catalog: CATALOG,
  state: STATE,
  unseen: [] as string[],
  markSeen: jest.fn(),
  revokedNotice: null as string | null,
  dismissRevokedNotice: jest.fn(),
  setColor: jest.fn(),
  changeStage: jest.fn(),
  arrange: jest.fn(),
  history: [] as PanueloMemory[],
  place: jest.fn(),
  unplace: jest.fn(),
  move: jest.fn(),
  rotate: jest.fn(),
  redeem: jest.fn(),
  applyTradeHalf: jest.fn(),
  grantDemo: jest.fn(),
  reset: jest.fn(),
};
jest.mock('@/hooks/usePanuelo', () => ({
  usePanuelo: () => mockPanuelo,
}));

// ── Ayudas ──────────────────────────────────────────────────────────────────

let tree: ReactTestRenderer | undefined;
let announce: jest.SpyInstance;

const originalWindow = Dimensions.get('window');
function setFontScale(fontScale: number) {
  Dimensions.set({ window: { ...originalWindow, fontScale } });
}

async function mount() {
  await act(async () => {
    tree = create(<PanueloRoute />);
  });
  return tree as ReactTestRenderer;
}

const textOf = (node: ReactTestInstance): string =>
  node
    .findAll((n) => String(n.type) === 'Text')
    .map((n) => n.children.filter((c) => typeof c === 'string').join(''))
    .join('');

/** El componente que se pulsa (el que tiene `onPress`) con esa etiqueta. */
function pressable(root: ReactTestInstance, label: string) {
  const found = root.findAll(
    (n) =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  );
  if (found.length === 0) throw new Error(`No hay nada pulsable «${label}»`);
  return found[0];
}

async function press(root: ReactTestInstance, label: string) {
  const node = pressable(root, label);
  await act(async () => {
    node.props.onPress();
  });
}

const labelsOf = (root: ReactTestInstance) =>
  new Set(
    root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string')
      .map((n) => n.props.accessibilityLabel as string),
  );

beforeEach(async () => {
  jest.clearAllMocks();
  mockScarf.value = null;
  // Por defecto el tutorial ya está visto: sale solo en las pruebas que lo piden.
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    PANUELO_TUTORIAL_KEY,
    String(PANUELO_TUTORIAL_VERSION),
  );
  mockRouter.params = {};
  mockAvailable.available = true;
  mockAvailable.settled = true;
  mockPanuelo.state = STATE;
  mockPanuelo.unseen = [];
  mockPanuelo.history = [];
  mockMotion.reduced = false;
  mockViewer.props = {};
  announce = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
  setFontScale(1);
});

afterEach(async () => {
  await act(async () => {
    tree?.unmount();
  });
  tree = undefined;
  announce.mockRestore();
  Dimensions.set({ window: originalWindow });
});

// ── Pruebas ─────────────────────────────────────────────────────────────────

describe('la pantalla del pañuelo', () => {
  it('con el interruptor cerrado devuelve a Inicio', async () => {
    mockAvailable.available = false;
    const { root } = await mount();
    expect(root.findByType('Redirect' as never).props.href).toBe('/');
  });

  it('mientras no se sabe si está abierto no pinta nada ni redirige', async () => {
    mockAvailable.settled = false;
    const { root } = await mount();
    expect(root.findAllByType('Redirect' as never)).toHaveLength(0);
    expect(
      root.findAllByProps({ accessibilityRole: 'radiogroup' }),
    ).toHaveLength(0);
  });

  it('pinta la colección: lo que se tiene, en silueta lo que falta y nada de lo secreto', async () => {
    const { root } = await mount();
    const text = textOf(root);
    expect(text).toContain('Tu colección');
    expect(text).toContain('2 de 3 · 1 en el pañuelo');
    expect(text).toContain('Chapa uno');
    expect(text).toContain('Pin uno');
    expect(text).not.toContain('Medalla lejana');
    expect(text).not.toContain('Chapa secreta');
    const labels = labelsOf(root);
    expect(labels).toContain('Chapa uno, chapa, puesta en el pañuelo');
    expect(labels).toContain('Pin uno, pin, sin poner');
    expect(labels).toContain('Pieza sin conseguir, medalla');
    expect([...labels].some((l) => l.includes('secreta'))).toBe(false);
  });

  it('abre la ficha de una pieza desde la colección, sin tocar el 3D', async () => {
    const { root } = await mount();
    await press(root, 'Chapa uno, chapa, puesta en el pañuelo');
    // La pieza se enfoca en el visor...
    expect(mockSend).toHaveBeenCalledWith({ type: 'focus', id: 'chapa1' });
    // ...y su ficha ocupa el sitio de la colección.
    const header = root.findAll(
      (n) =>
        n.props.accessibilityRole === 'header' &&
        typeof n.type === 'string' &&
        textOf(n) === 'Chapa uno',
    );
    expect(header.length).toBeGreaterThan(0);
    expect(textOf(root)).toContain('Pascua Joven');
    expect(textOf(root)).not.toContain('Tu colección');

    await press(root, 'Cerrar la ficha');
    expect(textOf(root)).toContain('Tu colección');
    expect(mockSend).toHaveBeenCalledWith({ type: 'blur' });
  });

  it('una pieza en la caja se abre solo como ficha y se puede poner', async () => {
    const { root } = await mount();
    await press(root, 'Pin uno, pin, sin poner');
    expect(mockSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'focus' }),
    );
    await press(root, 'Ponérmela');
    expect(mockPanuelo.place).toHaveBeenCalledWith('pin1');
  });

  it('una pieza que falta enseña una ficha sin desvelar qué es', async () => {
    const { root } = await mount();
    await press(root, 'Pieza sin conseguir, medalla');
    const text = textOf(root);
    expect(text).toContain('Todavía no la tienes');
    expect(text).not.toContain('Medalla lejana');
  });

  it('con `?codigo=` abre el canje con el código ya escrito', async () => {
    mockRouter.params = { codigo: 'CAMINO' };
    const { root } = await mount();
    const sheet = root.findByType('BottomSheet' as never);
    expect(sheet.props.title).toBe('Canjear un código');
    const field = root.findAll(
      (n) => n.props.accessibilityLabel === 'Código de la pieza',
    )[0];
    expect(field.props.value).toBe('CAMINO');
  });

  it('una pieza intercambiable ofrece «Intercambiar» en su ficha; las demás no', async () => {
    const { root } = await mount();
    await press(root, 'Pin uno, pin, sin poner');
    expect(labelsOf(root)).not.toContain('Intercambiar');
    await press(root, 'Cerrar la ficha');
    await press(root, 'Chapa uno, chapa, puesta en el pañuelo');
    await press(root, 'Intercambiar');
    const sheet = root.findByType('BottomSheet' as never);
    expect(sheet.props.title).toBe('Intercambiar');
  });

  it('el botón de la colección abre la hoja de intercambiar', async () => {
    const { root } = await mount();
    await press(root, 'Intercambiar una pieza');
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(1);
  });

  it('con `?intercambio=` abre la hoja de contestar', async () => {
    mockRouter.params = { intercambio: 'K7WQ4M' };
    const { root } = await mount();
    await act(async () => {});
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(1);
  });

  it('sin `?codigo=` el canje está cerrado y se abre con el botón', async () => {
    const { root } = await mount();
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    await press(root, 'Canjear un código');
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(1);
  });
});

describe('accesibilidad de la pantalla del pañuelo', () => {
  it('el visor se describe: color, etapa, piezas y dónde está la alternativa', async () => {
    await mount();
    expect(mockViewer.props.accessibilityLabel).toBe(
      'Pañuelo azul, Incorporación y crecimiento. Lleva 1 pieza.',
    );
    expect(mockViewer.props.accessibilityHint).toContain('colección');
  });

  it('sin piezas puestas lo dice, y con varias usa el plural', async () => {
    mockPanuelo.state = { ...STATE, layout: {} };
    await mount();
    expect(mockViewer.props.accessibilityLabel).toContain(
      'No lleva ninguna pieza.',
    );
    await act(async () => {
      tree?.unmount();
    });
    mockPanuelo.state = {
      ...STATE,
      layout: {
        chapa1: { u: 0, v: 0.5, rot: 0 },
        pin1: { u: 0.2, v: 0.4, rot: 0 },
      },
    };
    await mount();
    expect(mockViewer.props.accessibilityLabel).toContain('Lleva 2 piezas.');
  });

  it('los colores son un grupo de radio con el elegido marcado', async () => {
    const { root } = await mount();
    const group = root.findAll(
      (n) => n.props.accessibilityRole === 'radiogroup',
    )[0];
    expect(group.props.accessibilityLabel).toBe('Color del pañuelo');
    // Cada pulsable aparece dos veces en el árbol (el doble y su `Pressable`).
    const radios = [
      ...new Map(
        group
          .findAll(
            (n) =>
              n.props.accessibilityRole === 'radio' &&
              typeof n.props.onPress === 'function',
          )
          .map((n) => [n.props.accessibilityLabel, n] as const),
      ).values(),
    ];
    expect(radios).toHaveLength(4);
    const selected = radios.filter(
      (r) => r.props.accessibilityState?.selected === true,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].props.accessibilityLabel).toBe(
      'Pañuelo azul: Incorporación y crecimiento',
    );
    // Áreas de 44 pt: 36 de ancho más 4 de hitSlop a cada lado.
    expect(selected[0].props.hitSlop).toEqual({ left: 4, right: 4 });
  });

  it('tocar otro color ya no cambia nada: abre la hoja de cambio de pañuelo', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    expect(mockPanuelo.setColor).not.toHaveBeenCalled();
    expect(mockPanuelo.changeStage).not.toHaveBeenCalled();
    expect(root.findByType('BottomSheet' as never).props.title).toBe(
      '¿Cambias de pañuelo?',
    );
  });

  it('lo interactivo tiene etiqueta y rol', async () => {
    const { root } = await mount();
    for (const label of [
      'Decorar el pañuelo',
      'Canjear un código',
      'Chapa uno, chapa, puesta en el pañuelo',
    ]) {
      expect(pressable(root, label).props.accessibilityRole).toBe('button');
    }
  });

  it('el rótulo y la ayuda del 3D no se leen por duplicado', async () => {
    const { root } = await mount();
    const hidden = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.importantForAccessibility === 'no' &&
        n.props.accessibilityElementsHidden === true,
    );
    expect(hidden.length).toBeGreaterThanOrEqual(1);
  });

  it('el botón de decorar cambia de etiqueta, anuncia el modo y la letra del botón visible está en ella', async () => {
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining('Modo decorar'),
    );
    // «Listo» es lo que se ve: el control por voz dice «toca Listo».
    expect(pressable(root, 'Listo, terminar de decorar')).toBeTruthy();
  });

  it('en modo decorar, la ficha ofrece mover la pieza por pasos (no hay que arrastrar)', async () => {
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    await press(root, 'Chapa uno, chapa, puesta en el pañuelo');
    const title = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityRole === 'header' &&
        Array.isArray(n.props.accessibilityActions),
    )[0];
    expect(
      title.props.accessibilityActions.map((a: { label: string }) => a.label),
    ).toEqual([
      'Mover a la izquierda',
      'Mover a la derecha',
      'Mover hacia el cuello',
      'Mover hacia el pico',
    ]);
    await act(async () => {
      title.props.onAccessibilityAction({
        nativeEvent: { actionName: 'moveTip' },
      });
    });
    expect(mockPanuelo.move).toHaveBeenCalledTimes(1);
    const [id, u, v] = mockPanuelo.move.mock.calls[0];
    expect(id).toBe('chapa1');
    expect(u).toBeCloseTo(0);
    expect(v).toBeCloseTo(0.6);
    expect(announce).toHaveBeenCalledWith('Pieza movida.');
  });

  it('fuera del modo decorar la ficha no ofrece mover', async () => {
    const { root } = await mount();
    await press(root, 'Chapa uno, chapa, puesta en el pañuelo');
    const withActions = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityRole === 'header' &&
        Array.isArray(n.props.accessibilityActions),
    );
    expect(withActions).toHaveLength(0);
  });

  it('anuncia la pieza recién conseguida cuando se presenta', async () => {
    jest.useFakeTimers();
    try {
      mockPanuelo.unseen = ['chapa1'];
      await mount();
      await act(async () => {
        mockViewer.props.onEvent?.({ type: 'ready' } as PanueloEvent);
      });
      // Primero la vuelta de entrada del pañuelo, luego la pausa antes de la pieza.
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSend).toHaveBeenCalledWith({ type: 'reveal', id: 'chapa1' });
      expect(announce).toHaveBeenCalledWith('Pieza nueva: Chapa uno. Chapa.');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('letra grande', () => {
  const tileNames = (root: ReactTestInstance) =>
    root.findAll((n) => String(n.type) === 'Text' && textOf(n) === 'Chapa uno');

  it('con la letra normal la colección queda como siempre', async () => {
    setFontScale(1);
    const { root } = await mount();
    expect(tileNames(root)[0].props.numberOfLines).toBe(2);
    expect(
      pressable(root, 'Chapa uno, chapa, puesta en el pañuelo').props.style,
    ).toBeDefined();
  });

  it('con la letra grande los nombres salen enteros y el panel hace scroll', async () => {
    setFontScale(2);
    const { root } = await mount();
    expect(tileNames(root)[0].props.numberOfLines).toBeUndefined();
    // El panel de abajo pasa a ser desplazable y con tope de altura.
    const scrolls = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.style &&
        typeof (Array.isArray(n.props.style)
          ? n.props.style[0]?.maxHeight
          : n.props.style.maxHeight) === 'number',
    );
    expect(scrolls.length).toBeGreaterThan(0);
  });

  it('con la letra grande la ficha también se puede recorrer entera', async () => {
    setFontScale(2);
    const { root } = await mount();
    await press(root, 'Chapa uno, chapa, puesta en el pañuelo');
    const scrolls = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.style &&
        !Array.isArray(n.props.style) &&
        typeof n.props.style.maxHeight === 'number',
    );
    expect(scrolls.length).toBeGreaterThan(0);
    expect(textOf(root)).toContain('Pascua Joven');
  });
});

describe('cambio de pañuelo (de etapa)', () => {
  const sheetText = (root: ReactTestInstance) =>
    textOf(root.findByType('BottomSheet' as never));
  let success: jest.SpyInstance;
  beforeEach(() => {
    success = jest.spyOn(h, 'formSuccess').mockImplementation(() => undefined);
  });
  afterEach(() => success.mockRestore());

  it('la hoja explica que el de ahora se guarda como recuerdo y ofrece las dos salidas y cancelar', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    const text = sheetText(root);
    expect(text).toContain(
      'En cualquier caso, tu pañuelo de ahora se guarda en Mis pañuelos.',
    );
    expect(text).toContain('Siguen cosidas donde están.');
    expect(text).toContain('Las conservas, pero quedan sin poner.');
    expect(text).toContain('Pasas al pañuelo rojo (Etapa infantil).');
    for (const label of [
      'Mantener mis chapas y pines. Siguen cosidas donde están.',
      'Empezar de cero la nueva etapa. Las conservas, pero quedan sin poner.',
      'Cancelar',
    ]) {
      expect(pressable(root, label).props.accessibilityRole).toBe('button');
    }
  });

  it('«Llevarme las piezas» cambia de etapa dejando las piezas cosidas', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    await press(
      root,
      'Mantener mis chapas y pines. Siguen cosidas donde están.',
    );
    expect(mockPanuelo.changeStage).toHaveBeenCalledTimes(1);
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('red', true);
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
  });

  it('«Empezar con el pañuelo limpio» las descose todas', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo verde: Conocimiento');
    await press(
      root,
      'Empezar de cero la nueva etapa. Las conservas, pero quedan sin poner.',
    );
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('green', false);
  });

  it('la explicación de cada salida va dentro de su botón y de su etiqueta', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    const keep = pressable(
      root,
      'Mantener mis chapas y pines. Siguen cosidas donde están.',
    );
    expect(textOf(keep)).toContain('Mantener mis chapas y pines');
    expect(textOf(keep)).toContain('Siguen cosidas donde están.');
    const fresh = pressable(
      root,
      'Empezar de cero la nueva etapa. Las conservas, pero quedan sin poner.',
    );
    expect(textOf(fresh)).toContain('Empezar de cero la nueva etapa');
    expect(textOf(fresh)).toContain('Las conservas, pero quedan sin poner.');
  });

  it('la variante detectada usa el mismo texto', async () => {
    mockScarf.value = 'red';
    const { root } = await mount();
    const text = textOf(root.findByType('BottomSheet' as never));
    expect(text).toContain('Siguen cosidas donde están.');
    expect(text).toContain('Las conservas, pero quedan sin poner.');
    expect(text).toContain(
      'En cualquier caso, tu pañuelo de ahora se guarda en Mis pañuelos.',
    );
  });

  it('cancelar no cambia nada y cierra la hoja', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    await press(root, 'Cancelar');
    expect(mockPanuelo.changeStage).not.toHaveBeenCalled();
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
  });

  it('tocar el color que ya se lleva no abre nada', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo azul: Incorporación y crecimiento');
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
  });

  it('sin ninguna pieza puesta no hay recuerdo que guardar ni dos salidas', async () => {
    mockPanuelo.state = { ...STATE, layout: {} };
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    expect(sheetText(root)).not.toContain('recuerdo');
    expect(labelsOf(root)).not.toContain(
      'Empezar de cero la nueva etapa. Las conservas, pero quedan sin poner.',
    );
    await press(root, 'Cambiar de pañuelo');
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('red', true);
  });

  it('al cambiar: confeti del color del pañuelo nuevo, háptico y anuncio', async () => {
    jest.useFakeTimers();
    try {
      const { root } = await mount();
      await press(root, 'Pañuelo rojo: Etapa infantil');
      await press(
        root,
        'Mantener mis chapas y pines. Siguen cosidas donde están.',
      );
      const burst = root.findByType(CelebrationBurst);
      expect(burst.props.visible).toBe(true);
      expect(burst.props.emoji).toBe('');
      const colors = new Set(
        (burst.props.particles as { c: string }[]).map((p) => p.c),
      );
      expect([...colors]).toEqual([PanueloColors.cloth.red]);
      expect(success).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        expect.stringContaining('Ahora llevas el pañuelo rojo'),
      );
      expect(announce).toHaveBeenCalledWith(
        expect.stringContaining('tus piezas siguen cosidas'),
      );
      // El confeti se apaga solo.
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(root.findByType(CelebrationBurst).props.visible).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('el anuncio de empezar limpio dice que las piezas vuelven a la colección', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    await press(
      root,
      'Empezar de cero la nueva etapa. Las conservas, pero quedan sin poner.',
    );
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining('se quedan sin poner'),
    );
  });

  it('con «reducir movimiento» no hay confeti, pero sí háptico y anuncio', async () => {
    mockMotion.reduced = true;
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    await press(
      root,
      'Mantener mis chapas y pines. Siguen cosidas donde están.',
    );
    expect(root.findByType(CelebrationBurst).props.visible).toBe(false);
    expect(success).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining('Ahora llevas el pañuelo rojo'),
    );
  });
});

describe('el filtro de la colección', () => {
  const tileLabels = (root: ReactTestInstance) =>
    [...labelsOf(root)].filter((l) =>
      /, (chapa|pin|medalla)|sin conseguir/.test(l),
    );

  it('es un segmentado Todas · Puestas · Sin poner y empieza en Todas', async () => {
    const { root } = await mount();
    const tabs = root.findAll(
      (n) => n.props.accessibilityRole === 'tablist',
    )[0];
    expect(tabs.props.accessibilityLabel).toBe('Filtrar la colección');
    const selected = root
      .findAll(
        (n) =>
          n.props.accessibilityRole === 'tab' &&
          n.props.accessibilityState?.selected === true &&
          typeof n.props.onPress === 'function',
      )
      .map((n) => n.props.accessibilityLabel);
    expect(new Set(selected)).toEqual(new Set(['Todas']));
    for (const label of ['Todas', 'Puestas', 'Sin poner']) {
      expect(pressable(root, label)).toBeTruthy();
    }
    expect(tileLabels(root)).toHaveLength(3);
  });

  it('«Puestas» solo enseña las cosidas', async () => {
    const { root } = await mount();
    await press(root, 'Puestas');
    expect(tileLabels(root)).toEqual([
      'Chapa uno, chapa, puesta en el pañuelo',
    ]);
  });

  it('«Sin poner» enseña las que tienes y no están cosidas, no las siluetas', async () => {
    const { root } = await mount();
    await press(root, 'Sin poner');
    expect(tileLabels(root)).toEqual(['Pin uno, pin, sin poner']);
  });

  it('con el filtro vacío sale un vacío breve', async () => {
    mockPanuelo.state = { ...STATE, layout: {} };
    const { root } = await mount();
    await press(root, 'Puestas');
    expect(textOf(root)).toContain('Ninguna pieza puesta');
    expect(tileLabels(root)).toHaveLength(0);
  });

  it('«Sin poner» vacío: todo lo que tienes está puesto', async () => {
    mockPanuelo.state = {
      ...STATE,
      layout: {
        chapa1: { u: 0, v: 0.5, rot: 0 },
        pin1: { u: 0.2, v: 0.4, rot: 0 },
      },
    };
    const { root } = await mount();
    await press(root, 'Sin poner');
    expect(textOf(root)).toContain('Todo lo que tienes está puesto');
  });

  it('se recuerda al abrir una ficha y al decorar: no cambia por su cuenta', async () => {
    const { root } = await mount();
    await press(root, 'Sin poner');
    await press(root, 'Decorar el pañuelo');
    expect(tileLabels(root)).toEqual(['Pin uno, pin, sin poner']);
    await press(root, 'Pin uno, pin, sin poner');
    await press(root, 'Cerrar la ficha');
    expect(tileLabels(root)).toEqual(['Pin uno, pin, sin poner']);
    const selected = root.findAll(
      (n) =>
        n.props.accessibilityRole === 'tab' &&
        n.props.accessibilityState?.selected === true &&
        typeof n.props.onPress === 'function',
    );
    expect(selected[0].props.accessibilityLabel).toBe('Sin poner');
  });

  it('los segmentos son lo bastante altos para el dedo (44 pt)', async () => {
    const { root } = await mount();
    const tabs = root.findAll(
      (n) => n.props.accessibilityRole === 'tablist',
    )[0];
    const style = Array.isArray(tabs.props.style)
      ? Object.assign({}, ...tabs.props.style.flat(Infinity).filter(Boolean))
      : tabs.props.style;
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });
});

describe('Mis pañuelos (historial)', () => {
  const MEMORY: PanueloMemory = {
    color: 'red',
    at: new Date(2026, 10, 15).getTime(),
    layout: {
      chapa1: { u: 0, v: 0.5, rot: 0 },
      pin1: { u: 0.2, v: 0.4, rot: 0 },
    },
  };
  const OLDER: PanueloMemory = {
    color: 'yellow',
    at: new Date(2024, 5, 1).getTime(),
    layout: { chapa1: { u: 0, v: 0.5, rot: 0 } },
  };

  it('sin recuerdos la entrada no sale', async () => {
    const { root } = await mount();
    expect(labelsOf(root)).not.toContain('Mis pañuelos');
  });

  it('con recuerdos hay una entrada discreta que abre la lista', async () => {
    mockPanuelo.history = [MEMORY, OLDER];
    const { root } = await mount();
    expect(pressable(root, 'Mis pañuelos').props.accessibilityRole).toBe(
      'button',
    );
    await press(root, 'Mis pañuelos');
    const sheet = root.findByType('BottomSheet' as never);
    expect(sheet.props.title).toBe('Mis pañuelos');
    const text = textOf(sheet);
    expect(text).toContain('Pañuelo rojo · Etapa infantil');
    expect(text).toContain('Hasta noviembre de 2026 · 2 piezas');
    expect(text).toContain('Pañuelo amarillo · Opción responsable');
    expect(text).toContain('Hasta junio de 2024 · 1 pieza');
    expect(
      labelsOf(root).has(
        'Pañuelo rojo, Etapa infantil. Hasta noviembre de 2026. 2 piezas.',
      ),
    ).toBe(true);
  });

  async function openMemory(root: ReactTestInstance) {
    await press(root, 'Mis pañuelos');
    await press(
      root,
      'Pañuelo rojo, Etapa infantil. Hasta noviembre de 2026. 2 piezas.',
    );
  }

  it('al tocar uno, el visor lo pinta en solo lectura con un banner y la salida', async () => {
    mockPanuelo.history = [MEMORY];
    const { root } = await mount();
    await openMemory(root);
    expect(mockViewer.props.state?.color).toBe('red');
    expect(mockViewer.props.state?.items.map((i) => i.id).sort()).toEqual([
      'chapa1',
      'pin1',
    ]);
    expect(mockViewer.props.mode).toBe('view');
    expect(textOf(root)).toContain('Estás viendo tu pañuelo rojo de 2026');
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining('Viendo tu pañuelo rojo de 2026'),
    );
    expect(mockViewer.props.accessibilityLabel).toContain('Recuerdo');
    expect(mockViewer.props.accessibilityLabel).toContain('Llevaba 2 piezas.');
    // Ni decorar, ni colores, ni compartir mientras se mira un recuerdo.
    const labels = labelsOf(root);
    expect(labels).not.toContain('Decorar el pañuelo');
    expect(labels).not.toContain('Color del pañuelo');
    expect(labels).not.toContain('Compartir una foto de mi pañuelo');
    expect(labels).not.toContain('Canjear un código');
    // Sin tocar el estado real.
    expect(mockPanuelo.changeStage).not.toHaveBeenCalled();
    expect(mockPanuelo.unplace).not.toHaveBeenCalled();
  });

  it('desde el panel se puede ver la ficha de una pieza, pero no quitarla ni ponerla', async () => {
    mockPanuelo.history = [MEMORY];
    const { root } = await mount();
    await openMemory(root);
    expect(textOf(root)).toContain('Hasta noviembre de 2026 · 2 piezas');
    await press(root, 'Chapa uno, chapa, puesta en el pañuelo');
    expect(mockSend).toHaveBeenCalledWith({ type: 'focus', id: 'chapa1' });
    expect(textOf(root)).toContain('Lo llevabas en tu pañuelo rojo.');
    expect(textOf(root)).not.toContain('Conseguida el');
    const labels = labelsOf(root);
    expect(labels).not.toContain('Quitar del pañuelo');
    expect(labels).not.toContain('Ponérmela');
  });

  it('«Volver» devuelve el pañuelo actual', async () => {
    mockPanuelo.history = [MEMORY];
    const { root } = await mount();
    await openMemory(root);
    await press(root, 'Volver a mi pañuelo');
    expect(mockViewer.props.state?.color).toBe('blue');
    expect(textOf(root)).not.toContain('Estás viendo');
    expect(textOf(root)).toContain('Tu colección');
    expect(pressable(root, 'Decorar el pañuelo')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Has vuelto a tu pañuelo.');
  });

  it('un recuerdo con piezas que ya no existen en el catálogo solo pinta las que quedan', async () => {
    mockPanuelo.history = [
      {
        ...MEMORY,
        layout: { ...MEMORY.layout, quitada: { u: 0, v: 0.3, rot: 0 } },
      },
    ];
    const { root } = await mount();
    await press(root, 'Mis pañuelos');
    await press(
      root,
      'Pañuelo rojo, Etapa infantil. Hasta noviembre de 2026. 2 piezas.',
    );
    expect(mockViewer.props.state?.items).toHaveLength(2);
  });

  it('si se estaba decorando, al ver un recuerdo se sale del modo decorar', async () => {
    mockPanuelo.history = [MEMORY];
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    expect(mockViewer.props.mode).toBe('edit');
    await openMemory(root);
    expect(mockViewer.props.mode).toBe('view');
    await press(root, 'Volver a mi pañuelo');
    expect(mockViewer.props.mode).toBe('view');
    expect(pressable(root, 'Decorar el pañuelo')).toBeTruthy();
  });
});

describe('sin textos de explicación sueltos', () => {
  it('ni pista sobre el 3D ni aviso de sesión ni ayuda en las hojas', async () => {
    const { root } = await mount();
    const text = textOf(root);
    for (const gone of [
      'Arrastra para girarlo',
      'Arrastra una pieza',
      'Sin sesión iniciada',
    ]) {
      expect(text).not.toContain(gone);
    }
    await press(root, 'Canjear un código');
    expect(textOf(root.findByType('BottomSheet' as never))).not.toContain(
      'En algunas actividades',
    );
  });

  it('en modo decorar tampoco sale ninguna pista', async () => {
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    expect(textOf(root)).not.toContain('Arrastra');
  });

  it('la lista de Mis pañuelos y la hoja de cambio van sin frases de relleno', async () => {
    mockPanuelo.history = [
      { color: 'red', at: 5, layout: { chapa1: { u: 0, v: 0.5, rot: 0 } } },
    ];
    const { root } = await mount();
    await press(root, 'Mis pañuelos');
    expect(textOf(root)).not.toContain('Toca uno para verlo');
    await act(async () => {
      tree?.unmount();
    });
    const again = await mount();
    await press(again.root, 'Pañuelo rojo: Etapa infantil');
    expect(textOf(again.root)).not.toContain('no se pierden');
  });
});

describe('el tutorial', () => {
  const first = PANUELO_TUTORIAL[0];
  const count = PANUELO_TUTORIAL.length;
  const pageWidth = originalWindow.width;

  /** El pager: el ScrollView horizontal con paginado. */
  const pager = (root: ReactTestInstance) =>
    root.findAll(
      (n) =>
        n.props.pagingEnabled === true &&
        typeof n.props.onMomentumScrollEnd === 'function',
    )[0];
  /** El dedo suelta y la página se asienta en `page`. */
  async function settleOn(root: ReactTestInstance, page: number) {
    await act(async () => {
      pager(root).props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: page * pageWidth, y: 0 } },
      });
    });
  }
  /** La página que se ve (las demás están ocultas al lector). */
  const currentPage = (root: ReactTestInstance) =>
    root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityElementsHidden === false &&
        n.props.importantForAccessibility === 'auto',
    )[0];
  const isHeader = (n: ReactTestInstance) =>
    typeof n.type === 'string' && n.props.accessibilityRole === 'header';
  /** El título del paso que se ve; `null` si no hay tutorial. */
  const stepTitle = (root: ReactTestInstance) => {
    const page = currentPage(root);
    return page ? textOf(page.findAll(isHeader)[0]) : null;
  };
  const dots = (root: ReactTestInstance) =>
    root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityRole === 'adjustable',
    )[0];
  let select: jest.SpyInstance;
  let success: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    select = jest.spyOn(h, 'select').mockImplementation(() => undefined);
    success = jest.spyOn(h, 'success').mockImplementation(() => undefined);
  });
  afterEach(() => {
    select.mockRestore();
    success.mockRestore();
  });

  it('tiene entre 6 y 7 pasos: una introducción, no un manual', () => {
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(7);
  });

  it('sale solo la primera vez, con el pañuelo de ejemplo en el visor', async () => {
    const { root } = await mount();
    expect(stepTitle(root)).toBe(first.title);
    expect(textOf(currentPage(root))).toContain(first.body);
    expect(labelsOf(root)).not.toContain('Filtrar la colección');
    expect(labelsOf(root)).not.toContain('Canjear un código');
    // Un único visor, con el estado de ejemplo (verde, con sus piezas).
    expect(mockViewer.props.state?.color).toBe('green');
    expect(mockViewer.props.state?.items.length).toBe(
      first.example?.pieces?.length,
    );
    expect(mockViewer.props.mode).toBe('view');
    expect(mockViewer.props.accessibilityLabel).toContain('ejemplo');
    // Ni colores ni decorar mientras dura.
    const labels = labelsOf(root);
    expect(labels).not.toContain('Color del pañuelo');
    expect(labels).not.toContain('Decorar el pañuelo');
  });

  it('una sola acción principal, «Continuar»: nada de Saltar, Atrás o Siguiente', async () => {
    const { root } = await mount();
    const labels = labelsOf(root);
    expect(pressable(root, 'Continuar').props.accessibilityRole).toBe('button');
    for (const gone of ['Saltar', 'Saltar el tutorial', 'Atrás', 'Siguiente']) {
      expect(labels).not.toContain(gone);
    }
    // El botón es alto (≥ 50 pt).
    const style = Object.assign(
      {},
      ...[pressable(root, 'Continuar').props.style]
        .flat(Infinity)
        .filter(Boolean),
    );
    expect(style.minHeight).toBeGreaterThanOrEqual(50);
  });

  it('el indicador de páginas dice cuántas hay y es ajustable', async () => {
    const { root } = await mount();
    const control = dots(root);
    expect(control.props.accessibilityLabel).toBe(`Paso 1 de ${count}`);
    expect(control.props.accessibilityValue).toEqual({
      min: 1,
      max: count,
      now: 1,
    });
    // Un punto por paso, y el de ahora más ancho.
    const dotViews = control.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityRole === undefined &&
        n !== control &&
        Array.isArray(n.props.style),
    );
    expect(dotViews.length).toBeGreaterThanOrEqual(count);
    await act(async () => {
      control.props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });
    expect(dots(root).props.accessibilityLabel).toBe(`Paso 2 de ${count}`);
    await act(async () => {
      dots(root).props.onAccessibilityAction({
        nativeEvent: { actionName: 'decrement' },
      });
    });
    expect(dots(root).props.accessibilityLabel).toBe(`Paso 1 de ${count}`);
    // Fuera de la fila no hace nada.
    await act(async () => {
      dots(root).props.onAccessibilityAction({
        nativeEvent: { actionName: 'decrement' },
      });
    });
    expect(dots(root).props.accessibilityLabel).toBe(`Paso 1 de ${count}`);
  });

  it('«Continuar» avanza un paso y el visor cambia de ejemplo', async () => {
    const { root } = await mount();
    await press(root, 'Continuar');
    expect(stepTitle(root)).toBe(PANUELO_TUTORIAL[1].title);
    expect(dots(root).props.accessibilityLabel).toBe(`Paso 2 de ${count}`);
    expect(mockViewer.props.state?.items.length).toBe(6);
    expect([...labelsOf(root)].some((l) => l.startsWith('Ejemplos: '))).toBe(
      true,
    );
  });

  it('el chevron de arriba, «Paso anterior», solo desde el segundo paso', async () => {
    const { root } = await mount();
    expect(labelsOf(root)).not.toContain('Paso anterior');
    await press(root, 'Continuar');
    await press(root, 'Paso anterior');
    expect(stepTitle(root)).toBe(first.title);
    expect(labelsOf(root)).not.toContain('Paso anterior');
  });

  it('deslizar cambia de paso, también hacia atrás (a la derecha)', async () => {
    const { root } = await mount();
    await settleOn(root, 1);
    expect(stepTitle(root)).toBe(PANUELO_TUTORIAL[1].title);
    await settleOn(root, 2);
    expect(stepTitle(root)).toBe(PANUELO_TUTORIAL[2].title);
    await settleOn(root, 1);
    expect(stepTitle(root)).toBe(PANUELO_TUTORIAL[1].title);
    // Un desplazamiento fuera de rango se queda en el último paso.
    await settleOn(root, count + 3);
    expect(stepTitle(root)).toBe(PANUELO_TUTORIAL[count - 1].title);
  });

  it('para el lector, volver atrás es una acción del título y las páginas ocultas no se leen', async () => {
    const { root } = await mount();
    await press(root, 'Continuar');
    const title = currentPage(root).findAll(isHeader)[0];
    expect(title.props.accessibilityActions).toEqual([
      { name: 'previous', label: 'Paso anterior' },
    ]);
    await act(async () => {
      title.props.onAccessibilityAction({
        nativeEvent: { actionName: 'previous' },
      });
    });
    expect(stepTitle(root)).toBe(first.title);
    const hidden = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.importantForAccessibility === 'no-hide-descendants' &&
        n.props.accessibilityElementsHidden === true,
    );
    expect(hidden).toHaveLength(count - 1);
  });

  it('«Continuar» desliza a la página siguiente, y con «reducir movimiento» cambia directo', async () => {
    for (const reduced of [false, true]) {
      mockMotion.reduced = reduced;
      const { root } = await mount();
      const instance = pager(root).instance;
      const scrollTo = jest.fn();
      instance.scrollTo = scrollTo;
      await press(root, 'Continuar');
      expect(scrollTo).toHaveBeenCalledWith({
        x: pageWidth,
        animated: !reduced,
      });
      await act(async () => {
        tree?.unmount();
      });
    }
  });

  it('háptico suave al cambiar de página, no al abrirse', async () => {
    const { root } = await mount();
    expect(select).not.toHaveBeenCalled();
    await press(root, 'Continuar');
    expect(select).toHaveBeenCalledTimes(1);
    await settleOn(root, 2);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('en el último paso el botón dice «Empezar», lo da por visto y vuelve la colección', async () => {
    const { root } = await mount();
    for (let i = 0; i < count - 1; i++) await press(root, 'Continuar');
    expect(dots(root).props.accessibilityLabel).toBe(
      `Paso ${count} de ${count}`,
    );
    expect(labelsOf(root)).not.toContain('Continuar');
    await press(root, 'Empezar');
    expect(success).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(PANUELO_TUTORIAL_KEY)).toBe(
      String(PANUELO_TUTORIAL_VERSION),
    );
    expect(textOf(root)).toContain('Tu colección');
    expect(mockViewer.props.state?.color).toBe('blue');
  });

  it('la X sale del tutorial en cualquier paso y lo da por visto', async () => {
    const { root } = await mount();
    await press(root, 'Continuar');
    await press(root, 'Cerrar el tutorial');
    expect(await AsyncStorage.getItem(PANUELO_TUTORIAL_KEY)).toBe(
      String(PANUELO_TUTORIAL_VERSION),
    );
    expect(textOf(root)).toContain('Tu colección');
  });

  it('reparte la pantalla: ~55 % para el contenido', async () => {
    const { root } = await mount();
    const panel = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        [n.props.style]
          .flat(Infinity)
          .some(
            (st: { height?: number } | false | null | undefined) =>
              !!st && st.height === originalWindow.height * 0.55,
          ),
    );
    expect(panel.length).toBeGreaterThan(0);
  });

  it('cada paso es una página con título grande, frase de entrada y filas', async () => {
    const { root } = await mount();
    const page = currentPage(root);
    const text = textOf(page);
    expect(text).toContain('Gíralo y acércalo');
    expect(text).toContain('Su color es tu etapa');
    // Los «cómo se hace» van numerados.
    const canjear = PANUELO_TUTORIAL.findIndex((s) => s.id === 'canjear');
    await settleOn(root, canjear);
    expect(textOf(currentPage(root))).toContain(
      'Pulsa «Canjear» en tu colección.',
    );
  });

  it('visto, no vuelve a salir solo; el «?» de la cabecera lo enseña siempre', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    );
    const { root } = await mount();
    expect(stepTitle(root)).toBeNull();
    expect(pressable(root, 'Cómo funciona tu pañuelo')).toBeTruthy();
    await press(root, 'Cómo funciona tu pañuelo');
    expect(stepTitle(root)).toBe(first.title);
  });

  it('al abrirlo a mano sale de decorar y vuelve al primer paso', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    );
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    await press(root, 'Cómo funciona tu pañuelo');
    expect(mockViewer.props.mode).toBe('view');
    await press(root, 'Continuar');
    await press(root, 'Cerrar el tutorial');
    await press(root, 'Cómo funciona tu pañuelo');
    expect(stepTitle(root)).toBe(first.title);
  });

  it('una versión guardada anterior lo vuelve a enseñar', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION - 1),
    );
    const { root } = await mount();
    expect(stepTitle(root)).toBe(first.title);
  });

  it('el canje de `?codigo=` espera a que acabe el tutorial', async () => {
    mockRouter.params = { codigo: 'CAMINO' };
    const { root } = await mount();
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    await press(root, 'Cerrar el tutorial');
    expect(root.findByType('BottomSheet' as never).props.title).toBe(
      'Canjear un código',
    );
  });

  it('la presentación de una pieza nueva espera a que acabe el tutorial', async () => {
    jest.useFakeTimers();
    try {
      mockPanuelo.unseen = ['chapa1'];
      const { root } = await mount();
      await act(async () => {
        mockViewer.props.onEvent?.({ type: 'ready' } as PanueloEvent);
      });
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      expect(mockSend).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'reveal', id: 'chapa1' }),
      );
      await press(root, 'Cerrar el tutorial');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSend).toHaveBeenCalledWith({ type: 'reveal', id: 'chapa1' });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Recolocar', () => {
  it('solo en modo decorar y con piezas cosidas', async () => {
    const { root } = await mount();
    expect(labelsOf(root)).not.toContain('Recolocar las piezas');
    await press(root, 'Decorar el pañuelo');
    expect(pressable(root, 'Recolocar las piezas')).toBeTruthy();
    expect(textOf(root)).toContain('Recolocar');
  });

  it('sin ninguna pieza cosida no hay nada que recolocar', async () => {
    mockPanuelo.state = { ...STATE, layout: {} };
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    expect(labelsOf(root)).not.toContain('Recolocar las piezas');
  });

  it('pregunta antes y, si se acepta, recoloca y lo anuncia', async () => {
    mockConfirm.mockResolvedValue(true);
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    await press(root, 'Recolocar las piezas');
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '¿Recolocar las piezas?',
        confirmLabel: 'Recolocar',
      }),
    );
    expect(mockPanuelo.arrange).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Piezas recolocadas.');
  });

  it('si se cancela no toca nada', async () => {
    mockConfirm.mockResolvedValue(false);
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    await press(root, 'Recolocar las piezas');
    expect(mockPanuelo.arrange).not.toHaveBeenCalled();
  });
});

describe('el color viene de Comunica', () => {
  let success: jest.SpyInstance;
  beforeEach(() => {
    success = jest.spyOn(h, 'formSuccess').mockImplementation(() => undefined);
  });
  afterEach(() => success.mockRestore());

  it('sin pañuelo de Comunica (nada, none, cross, unknown) se elige a mano como siempre', async () => {
    for (const value of [null, 'none', 'cross', 'unknown']) {
      mockScarf.value = value;
      const { root } = await mount();
      expect(labelsOf(root)).toContain('Color del pañuelo');
      expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
      await act(async () => {
        tree?.unmount();
      });
    }
  });

  it('con el mismo color que el guardado: sin círculos, la etapa en texto y nada que preguntar', async () => {
    mockScarf.value = 'blue';
    const { root } = await mount();
    expect(labelsOf(root)).not.toContain('Color del pañuelo');
    expect(textOf(root)).toContain('Azul · Incorporación y crecimiento');
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    expect(mockPanuelo.changeStage).not.toHaveBeenCalled();
  });

  it('un color distinto es un cambio de etapa: abre sola la hoja «Tienes pañuelo nuevo»', async () => {
    mockScarf.value = 'red';
    const { root } = await mount();
    const sheet = root.findByType('BottomSheet' as never);
    expect(sheet.props.title).toBe('Tienes pañuelo nuevo');
    expect(textOf(sheet)).toContain('pañuelo rojo (Etapa infantil)');
    await press(
      root,
      'Mantener mis chapas y pines. Siguen cosidas donde están.',
    );
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('red', true);
    expect(success).toHaveBeenCalledTimes(1);
    expect(root.findByType(CelebrationBurst).props.visible).toBe(true);
  });

  it('también se puede empezar limpio', async () => {
    mockScarf.value = 'yellow';
    const { root } = await mount();
    await press(
      root,
      'Empezar de cero la nueva etapa. Las conservas, pero quedan sin poner.',
    );
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('yellow', false);
  });

  it('«Luego» no cambia nada, no vuelve a saltar solo y el aviso la reabre', async () => {
    mockScarf.value = 'red';
    const { root } = await mount();
    await press(root, 'Luego');
    expect(mockPanuelo.changeStage).not.toHaveBeenCalled();
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    // El color sigue siendo de Comunica: no se elige a mano, pero hay aviso.
    expect(labelsOf(root)).not.toContain('Color del pañuelo');
    await press(root, 'Tienes pañuelo nuevo');
    expect(root.findByType('BottomSheet' as never).props.title).toBe(
      'Tienes pañuelo nuevo',
    );
  });

  it('la primera vez (sin color guardado) se asigna sin preguntar ni celebrar', async () => {
    mockPanuelo.state = { ...STATE, color: null };
    mockScarf.value = 'red';
    const { root } = await mount();
    expect(mockPanuelo.setColor).toHaveBeenCalledWith('red');
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    expect(mockPanuelo.changeStage).not.toHaveBeenCalled();
    expect(root.findByType(CelebrationBurst).props.visible).toBe(false);
  });

  it('espera al tutorial antes de preguntar', async () => {
    await AsyncStorage.clear();
    mockScarf.value = 'red';
    const { root } = await mount();
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    await press(root, 'Cerrar el tutorial');
    expect(root.findByType('BottomSheet' as never).props.title).toBe(
      'Tienes pañuelo nuevo',
    );
  });
});

describe('el tutorial a pantalla completa y la cabecera nativa', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const opts = () => mockSetOptions.mock.calls.map((c) => c[0]);

  it('mientras dura se oculta la cabecera nativa y el tutorial lleva la suya con una X de 44 pt', async () => {
    const { root } = await mount();
    expect(opts().some((o) => o.headerShown === false)).toBe(true);
    const close = pressable(root, 'Cerrar el tutorial');
    expect(close.props.accessibilityRole).toBe('button');
    const style = Object.assign(
      {},
      ...[close.props.style].flat(Infinity).filter(Boolean),
    );
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
    // El «?» de la cabecera no se pinta mientras tanto.
    expect(root.findAllByType('ToolbarButton' as never)).toHaveLength(0);
    // Sin título duplicado: el de la cabecera del tutorial.
    const titles = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityRole === 'header' &&
        textOf(n) === 'Tu pañuelo',
    );
    expect(titles.length).toBeGreaterThan(0);
  });

  it('la X sale del tutorial, lo da por visto y devuelve la cabecera', async () => {
    const { root } = await mount();
    await press(root, 'Cerrar el tutorial');
    expect(await AsyncStorage.getItem(PANUELO_TUTORIAL_KEY)).toBe(
      String(PANUELO_TUTORIAL_VERSION),
    );
    expect(textOf(root)).toContain('Tu colección');
    expect(opts()[opts().length - 1].headerShown).toBe(true);
    expect(labelsOf(root)).not.toContain('Cerrar el tutorial');
  });

  it('el «?» está en la cabecera nativa (iOS: botón de Stack.Toolbar) y abre el tutorial', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    );
    const { root } = await mount();
    const button = root.findByType('ToolbarButton' as never);
    expect(button.props.accessibilityLabel).toBe('Cómo funciona tu pañuelo');
    expect(button.props.icon).toBe('questionmark.circle');
    expect(button.props.tintColor).toBeDefined();
    // Ya no hay botón de información en la esquina del visor.
    expect(labelsOf(root)).not.toContain('Ver el tutorial del pañuelo');
    await act(async () => {
      button.props.onPress();
    });
    expect(labelsOf(root)).toContain('Cerrar el tutorial');
  });

  it('en Android y web el «?» va como headerRight', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    );
    const spy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const { root } = await mount();
      expect(root.findAllByType('ToolbarButton' as never)).toHaveLength(0);
      const withRight = opts().filter(
        (o) => typeof o.headerRight === 'function',
      );
      expect(withRight.length).toBeGreaterThan(0);
      const headerRight = withRight[withRight.length - 1].headerRight;
      let rendered!: ReactTestRenderer;
      await act(async () => {
        rendered = create(headerRight());
      });
      const button = rendered.root.findAll(
        (n) =>
          n.props.accessibilityLabel === 'Cómo funciona tu pañuelo' &&
          typeof n.props.onPress === 'function',
      )[0];
      expect(button.props.accessibilityRole).toBe('button');
      await act(async () => {
        button.props.onPress();
      });
      expect(labelsOf(root)).toContain('Cerrar el tutorial');
      rendered.unmount();
    } finally {
      spy.restore();
    }
  });

  it('cada paso deja el único visor como lo explica: «Decorarlo» en modo decorar', async () => {
    const { root } = await mount();
    const index = PANUELO_TUTORIAL.findIndex((s) => s.id === 'decorarlo');
    for (let i = 0; i < index; i++) await press(root, 'Continuar');
    expect(mockViewer.props.mode).toBe('edit');
    // «Cómo se hace», en pasos numerados.
    const page = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityElementsHidden === false &&
        n.props.importantForAccessibility === 'auto',
    )[0];
    expect(textOf(page)).toContain('Entra en «Decorar».');
    expect(textOf(page)).toContain('Recolocar');
    // Al arrastrar en el ejemplo no se mueve nada de verdad.
    await act(async () => {
      mockViewer.props.onEvent?.({ type: 'drop', id: 'chapa1', u: 0, v: 0.3 });
    });
    expect(mockPanuelo.move).not.toHaveBeenCalled();
    await press(root, 'Cerrar el tutorial');
    expect(mockViewer.props.mode).toBe('view');
  });

  it('los pasos que explican con una orden la mandan al visor', async () => {
    jest.useFakeTimers();
    try {
      const { root } = await mount();
      await act(async () => {
        mockViewer.props.onEvent?.({ type: 'ready' } as PanueloEvent);
      });
      const index = PANUELO_TUTORIAL.findIndex(
        (s) => s.id === 'verlas-de-cerca',
      );
      for (let i = 0; i < index; i++) await press(root, 'Continuar');
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSend).toHaveBeenCalledWith({
        type: 'focus',
        id: 'medalla-jubileo-2025',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('el visor de la pantalla y el del tutorial son el mismo: no se monta otro', async () => {
    const { root } = await mount();
    const viewers = () =>
      root.findAll(
        (n) => n.props.accessibilityHint !== undefined && n.props.state,
      );
    const before = viewers().length;
    await press(root, 'Continuar');
    await press(root, 'Cerrar el tutorial');
    expect(viewers().length).toBe(before);
  });
});

describe('el desvelado de las piezas por asistencia', () => {
  const NEWS: PanueloCatalog = {
    ...CATALOG,
    'chapa-pascua': {
      id: 'chapa-pascua',
      kind: 'chapa',
      name: 'Chapa de Pascua',
      origin: 'Pascua Joven 2027',
      description: 'Para quien vivió la Pascua.',
      look: { kind: 'chapa', bg: '#9D1E74' },
      grant: { type: 'attendance', events: ['evt-1'] },
      tradeable: false,
    },
    'pin-salida': {
      id: 'pin-salida',
      kind: 'pin',
      name: 'Pin de la salida',
      origin: 'Salida a la sierra',
      look: { kind: 'pin', shape: 'mountain', enamel: '#A3BD31' },
      grant: { type: 'attendance', events: ['evt-2'] },
      tradeable: false,
    },
  };
  const WITH_NEWS: PanueloUserState = {
    ...STATE,
    items: {
      ...STATE.items,
      'chapa-pascua': { at: Date.UTC(2027, 3, 12, 12), via: 'attendance' },
      'pin-salida': { at: Date.UTC(2027, 3, 20, 12), via: 'attendance' },
    },
  };
  /** El título de la página que se ve. */
  const pageTitle = (root: ReactTestInstance) => {
    const page = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityElementsHidden === false &&
        n.props.importantForAccessibility === 'auto',
    )[0];
    if (!page) return null;
    const header = page.findAll(
      (n) =>
        typeof n.type === 'string' && n.props.accessibilityRole === 'header',
    )[0];
    return { title: textOf(header), text: textOf(page) };
  };
  const bursts = (root: ReactTestInstance) =>
    root.findAllByType(CelebrationBurst).filter((b) => b.props.visible);

  beforeEach(() => {
    mockPanuelo.catalog = NEWS;
    mockPanuelo.state = WITH_NEWS;
    mockPanuelo.unseen = ['chapa-pascua', 'pin-salida'];
  });
  afterEach(() => {
    mockPanuelo.catalog = CATALOG;
    mockPanuelo.revokedNotice = null;
  });

  it('sale al abrir, una a una, con «Siguiente» y tu pañuelo de fondo', async () => {
    const { root } = await mount();
    expect(textOf(root)).toContain('Piezas nuevas');
    expect(pageTitle(root)?.title).toBe('Chapa de Pascua');
    expect(pageTitle(root)?.text).toContain('Por ir a Pascua Joven 2027.');
    expect(pageTitle(root)?.text).toContain('Para quien vivió la Pascua.');
    expect(pageTitle(root)?.text).toContain(
      'La conseguiste el 12 de abril de 2027',
    );
    expect(labelsOf(root)).toContain('Pieza 1 de 2');
    expect(pressable(root, 'Siguiente')).toBeTruthy();
    expect(labelsOf(root)).not.toContain('Ahora no');
    // El pañuelo de la persona (azul, con su chapa) y la nueva presentándose.
    expect(mockViewer.props.state?.color).toBe('blue');
    expect(mockViewer.props.state?.items.map((i) => i.id).sort()).toEqual([
      'chapa-pascua',
      'chapa1',
    ]);
    // La chapa de siempre sigue en su sitio.
    expect(
      mockViewer.props.state?.items.find((i) => i.id === 'chapa1'),
    ).toMatchObject({ u: 0, v: 0.5 });
    expect(mockPanuelo.markSeen).toHaveBeenCalledWith('chapa-pascua');
    expect(mockPanuelo.markSeen).not.toHaveBeenCalledWith('pin-salida');
    expect(announce).toHaveBeenCalledWith(
      'Pieza nueva, 1 de 2: Chapa de Pascua. Por ir a Pascua Joven 2027.',
    );
    // Mientras dura no hay colores ni decorar ni colección.
    expect(labelsOf(root)).not.toContain('Decorar el pañuelo');
    expect(labelsOf(root)).not.toContain('Canjear un código');
  });

  it('la última dice «Colocarlas» y ofrece «Ahora no»', async () => {
    const { root } = await mount();
    await press(root, 'Siguiente');
    expect(pageTitle(root)?.title).toBe('Pin de la salida');
    expect(pageTitle(root)?.text).toContain('Te esperan en tu colección');
    expect(mockPanuelo.markSeen).toHaveBeenCalledWith('pin-salida');
    expect(pressable(root, 'Colocarlas')).toBeTruthy();
    expect(pressable(root, 'Ahora no')).toBeTruthy();
  });

  it('«Colocarlas» abre decorar con «Sin poner» y la primera pieza a mano; no se cosen solas', async () => {
    const { root } = await mount();
    await press(root, 'Siguiente');
    await press(root, 'Colocarlas');
    expect(mockViewer.props.mode).toBe('edit');
    // La ficha de la primera, con «Ponérmela»: se cose cuando la persona quiera.
    expect(textOf(root)).toContain('Chapa de Pascua');
    expect(pressable(root, 'Ponérmela')).toBeTruthy();
    expect(mockPanuelo.place).not.toHaveBeenCalled();
    // Y el visor vuelve al pañuelo de verdad: la nueva no está cosida.
    expect(mockViewer.props.state?.items.map((i) => i.id)).toEqual(['chapa1']);
    // Al cerrar la ficha, la colección está en «Sin poner».
    await press(root, 'Cerrar la ficha');
    const selected = root
      .findAll(
        (n) =>
          n.props.accessibilityRole === 'tab' &&
          n.props.accessibilityState?.selected === true &&
          typeof n.props.onPress === 'function',
      )
      .map((n) => n.props.accessibilityLabel);
    expect(new Set(selected)).toEqual(new Set(['Sin poner']));
    expect(mockViewer.props.mode).toBe('edit');
  });

  it('la X cierra: queda visto solo lo que se enseñó', async () => {
    const { root } = await mount();
    await press(root, 'Cerrar');
    expect(mockPanuelo.markSeen).toHaveBeenCalledTimes(1);
    expect(mockPanuelo.markSeen).toHaveBeenCalledWith('chapa-pascua');
    expect(textOf(root)).toContain('Tu colección');
    expect(mockViewer.props.mode).toBe('view');
  });

  it('una sola pieza habla en singular', async () => {
    mockPanuelo.unseen = ['pin-salida'];
    const { root } = await mount();
    expect(textOf(root)).toContain('Pieza nueva');
    expect(pressable(root, 'Colocarla')).toBeTruthy();
    expect(pressable(root, 'Ahora no')).toBeTruthy();
  });

  it('va después del tutorial, y el canje espera a las dos cosas', async () => {
    await AsyncStorage.clear();
    mockRouter.params = { codigo: 'CAMINO' };
    const { root } = await mount();
    expect(pressable(root, 'Continuar')).toBeTruthy();
    expect(labelsOf(root)).not.toContain('Siguiente');
    await press(root, 'Cerrar el tutorial');
    expect(pageTitle(root)?.title).toBe('Chapa de Pascua');
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    await press(root, 'Cerrar');
    expect(root.findByType('BottomSheet' as never).props.title).toBe(
      'Canjear un código',
    );
  });

  it('se presenta en el visor: con giro y confeti del color de la pieza', async () => {
    jest.useFakeTimers();
    const success = jest
      .spyOn(h, 'formSuccess')
      .mockImplementation(() => undefined);
    try {
      const { root } = await mount();
      expect(success).toHaveBeenCalledTimes(1);
      expect(bursts(root)).toHaveLength(1);
      expect(bursts(root)[0].props.particles[0].c).toBe('#9D1E74');
      await act(async () => {
        mockViewer.props.onEvent?.({ type: 'ready' } as PanueloEvent);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSend).toHaveBeenCalledWith({
        type: 'reveal',
        id: 'chapa-pascua',
        still: false,
      });
    } finally {
      success.mockRestore();
      jest.useRealTimers();
    }
  });

  it('con «reducir movimiento»: aparece quieta y sin confeti', async () => {
    jest.useFakeTimers();
    mockMotion.reduced = true;
    try {
      const { root } = await mount();
      expect(bursts(root)).toHaveLength(0);
      await act(async () => {
        mockViewer.props.onEvent?.({ type: 'ready' } as PanueloEvent);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSend).toHaveBeenCalledWith({
        type: 'reveal',
        id: 'chapa-pascua',
        still: true,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('lo que ya está colocado o llegó por otra vía no entra en el desvelado', async () => {
    mockPanuelo.unseen = ['pin1'];
    const { root } = await mount();
    expect(labelsOf(root)).not.toContain('Siguiente');
    expect(textOf(root)).toContain('Tu colección');
  });

  it('lo retirado se avisa una vez, con una línea discreta, cuando la pantalla está libre', async () => {
    mockPanuelo.unseen = [];
    mockPanuelo.revokedNotice =
      'Ya no tienes «Chapa de Pascua»: se corrigió la lista de Pascua Joven 2027.';
    await mount();
    expect(mockToastShow).toHaveBeenCalledTimes(1);
    expect(mockToastShow).toHaveBeenCalledWith({
      label: mockPanuelo.revokedNotice,
    });
    expect(mockPanuelo.dismissRevokedNotice).toHaveBeenCalled();
  });
});
