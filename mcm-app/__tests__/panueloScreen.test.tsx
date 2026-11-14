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
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import PanueloRoute from '@/app/panuelo';
import type {
  PanueloCatalog,
  PanueloEvent,
  PanueloUserState,
} from '@/types/panuelo';

// ── Dobles ──────────────────────────────────────────────────────────────────

const mockRouter: { params: Record<string, string> } = { params: {} };
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

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.params = {};
  mockAvailable.available = true;
  mockAvailable.settled = true;
  mockPanuelo.state = STATE;
  mockPanuelo.unseen = [];
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

  it('cambiar de color funciona desde el grupo de radio', async () => {
    const { root } = await mount();
    await press(root, 'Pañuelo rojo: Etapa infantil');
    expect(mockPanuelo.setColor).toHaveBeenCalledWith('red');
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
    expect(hidden.length).toBeGreaterThanOrEqual(2);
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
