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
import { AccessibilityInfo, Dimensions } from 'react-native';
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
jest.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 0,
}));

jest.mock('expo-router', () => {
  const Local = jest.requireActual<typeof React>('react');
  return {
    Redirect: (props: { href: string }) =>
      Local.createElement('Redirect', { href: props.href }),
    useLocalSearchParams: () => mockRouter.params,
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
  return { PressableFeedback };
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
  setColor: jest.fn(),
  changeStage: jest.fn(),
  arrange: jest.fn(),
  history: [] as PanueloMemory[],
  place: jest.fn(),
  unplace: jest.fn(),
  move: jest.fn(),
  rotate: jest.fn(),
  redeem: jest.fn(),
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
    expect(text).toContain('Tu pañuelo azul se guarda como recuerdo.');
    expect(text).toContain('Pasas al pañuelo rojo (Etapa infantil).');
    for (const label of [
      'Llevarme las piezas',
      'Empezar con el pañuelo limpio',
      'Cancelar',
    ]) {
      expect(pressable(root, label).props.accessibilityRole).toBe('button');
    }
  });

  it('«Llevarme las piezas» cambia de etapa dejando las piezas cosidas', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    await press(root, 'Llevarme las piezas');
    expect(mockPanuelo.changeStage).toHaveBeenCalledTimes(1);
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('red', true);
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
  });

  it('«Empezar con el pañuelo limpio» las descose todas', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo verde: Conocimiento');
    await press(root, 'Empezar con el pañuelo limpio');
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('green', false);
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
    expect(labelsOf(root)).not.toContain('Empezar con el pañuelo limpio');
    await press(root, 'Cambiar de pañuelo');
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('red', true);
  });

  it('al cambiar: confeti del color del pañuelo nuevo, háptico y anuncio', async () => {
    jest.useFakeTimers();
    try {
      const { root } = await mount();
      await press(root, 'Pañuelo rojo: Etapa infantil');
      await press(root, 'Llevarme las piezas');
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
    await press(root, 'Empezar con el pañuelo limpio');
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining('han vuelto a la colección'),
    );
  });

  it('con «reducir movimiento» no hay confeti, pero sí háptico y anuncio', async () => {
    mockMotion.reduced = true;
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    await press(root, 'Llevarme las piezas');
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
  const headerTitles = (root: ReactTestInstance) =>
    root
      .findAll(
        (n) =>
          typeof n.type === 'string' &&
          n.props.accessibilityRole === 'header' &&
          PANUELO_TUTORIAL.some((s) => s.title === textOf(n)),
      )
      .map((n) => textOf(n));

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('sale solo la primera vez, en el sitio de la colección, con el pañuelo de ejemplo en el visor', async () => {
    const { root } = await mount();
    expect(headerTitles(root)).toEqual([first.title]);
    expect(textOf(root)).toContain(first.body);
    expect(textOf(root)).not.toContain('Tu colección');
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

  it('se recorre con Siguiente y Atrás, con indicador de paso accesible', async () => {
    const { root } = await mount();
    expect(labelsOf(root)).toContain(
      `Tutorial, paso 1 de ${PANUELO_TUTORIAL.length}`,
    );
    await press(root, 'Siguiente');
    expect(headerTitles(root)).toEqual([PANUELO_TUTORIAL[1].title]);
    expect(labelsOf(root)).toContain(
      `Tutorial, paso 2 de ${PANUELO_TUTORIAL.length}`,
    );
    // «Las piezas» enseña las seis clases, en el visor y en plano.
    expect(mockViewer.props.state?.items.length).toBe(6);
    expect([...labelsOf(root)].some((l) => l.startsWith('Ejemplos: '))).toBe(
      true,
    );
    await press(root, 'Atrás');
    expect(headerTitles(root)).toEqual([first.title]);
  });

  it('deslizar también cambia de sección', async () => {
    const { root } = await mount();
    const swipeArea = root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        typeof n.props.onTouchStart === 'function',
    )[0];
    const touch = (pageX: number) => ({ nativeEvent: { pageX } });
    await act(async () => {
      swipeArea.props.onTouchStart(touch(300));
      swipeArea.props.onTouchEnd(touch(100));
    });
    expect(headerTitles(root)).toEqual([PANUELO_TUTORIAL[1].title]);
    // Un toque corto no cuenta.
    await act(async () => {
      swipeArea.props.onTouchStart(touch(300));
      swipeArea.props.onTouchEnd(touch(290));
    });
    expect(headerTitles(root)).toEqual([PANUELO_TUTORIAL[1].title]);
  });

  it('«Entendido» en la última lo da por visto, con su versión, y vuelve la colección', async () => {
    const { root } = await mount();
    for (let i = 0; i < PANUELO_TUTORIAL.length - 1; i++) {
      await press(root, 'Siguiente');
    }
    expect(labelsOf(root)).not.toContain('Saltar el tutorial');
    await press(root, 'Entendido');
    expect(await AsyncStorage.getItem(PANUELO_TUTORIAL_KEY)).toBe(
      String(PANUELO_TUTORIAL_VERSION),
    );
    expect(textOf(root)).toContain('Tu colección');
    expect(mockViewer.props.state?.color).toBe('blue');
  });

  it('«Saltar» también lo da por visto', async () => {
    const { root } = await mount();
    await press(root, 'Saltar el tutorial');
    expect(await AsyncStorage.getItem(PANUELO_TUTORIAL_KEY)).toBe(
      String(PANUELO_TUTORIAL_VERSION),
    );
    expect(textOf(root)).toContain('Tu colección');
  });

  it('visto, no vuelve a salir solo; el botón de información lo enseña siempre', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    );
    const { root } = await mount();
    expect(headerTitles(root)).toEqual([]);
    expect(pressable(root, 'Ver el tutorial del pañuelo')).toBeTruthy();
    await press(root, 'Ver el tutorial del pañuelo');
    expect(headerTitles(root)).toEqual([first.title]);
  });

  it('al abrirlo a mano sale de decorar y vuelve a la primera sección', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    );
    const { root } = await mount();
    await press(root, 'Decorar el pañuelo');
    await press(root, 'Ver el tutorial del pañuelo');
    expect(mockViewer.props.mode).toBe('view');
    await press(root, 'Siguiente');
    await press(root, 'Saltar el tutorial');
    await press(root, 'Ver el tutorial del pañuelo');
    expect(headerTitles(root)).toEqual([first.title]);
  });

  it('una versión guardada anterior lo vuelve a enseñar', async () => {
    await AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION - 1),
    );
    const { root } = await mount();
    expect(headerTitles(root)).toEqual([first.title]);
  });

  it('el canje de `?codigo=` espera a que acabe el tutorial', async () => {
    mockRouter.params = { codigo: 'CAMINO' };
    const { root } = await mount();
    expect(root.findAllByType('BottomSheet' as never)).toHaveLength(0);
    await press(root, 'Saltar el tutorial');
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
        expect.objectContaining({ type: 'reveal' }),
      );
      await press(root, 'Saltar el tutorial');
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
    await press(root, 'Llevarme las piezas');
    expect(mockPanuelo.changeStage).toHaveBeenCalledWith('red', true);
    expect(success).toHaveBeenCalledTimes(1);
    expect(root.findByType(CelebrationBurst).props.visible).toBe(true);
  });

  it('también se puede empezar limpio', async () => {
    mockScarf.value = 'yellow';
    const { root } = await mount();
    await press(root, 'Empezar con el pañuelo limpio');
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
    await press(root, 'Saltar el tutorial');
    expect(root.findByType('BottomSheet' as never).props.title).toBe(
      'Tienes pañuelo nuevo',
    );
  });
});
