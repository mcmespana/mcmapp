/**
 * El hero de la portada (fase 2D): un bloque de marca que se puede cerrar y
 * que no se pinta hasta saber si el saludo está oculto (`ready`).
 */
/* eslint-disable import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);

let mockPersonId: string | null = 'p1';
jest.mock('@/hooks/comunica/useMe', () => ({
  useMe: () => ({ me: mockPersonId ? { personId: mockPersonId } : null }),
}));
let mockDrawer: Promise<unknown> = Promise.resolve(undefined);
jest.mock('@/services/comunica/storage', () => ({
  readDrawer: () => mockDrawer,
  writeDrawer: jest.fn(async () => undefined),
}));

import AreaHero from '@/components/comunica/comun/AreaHero';
import { useGreetingHidden } from '@/hooks/comunica/useHomePrefs';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const render = async (el: React.ReactElement) => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>{el}</HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return tree;
};
const byTestId = (tree: ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label);

describe('AreaHero', () => {
  it('es un bloque de marca: pinta UN degradado de bloque con su título y su cuerpo', async () => {
    const tree = await render(
      <AreaHero title="Hola, Marta" body="Bienvenida" />,
    );
    expect(byTestId(tree, 'brand-gradient-block')).toHaveLength(1);
    expect(byTestId(tree, 'brand-gradient-mark')).toHaveLength(0);
    const texts = tree.root.findAllByType(Text).map((n) => n.props.children);
    expect(texts).toEqual(
      expect.arrayContaining(['Hola, Marta', 'Bienvenida']),
    );
    // El título es un encabezado para el lector de pantalla.
    expect(
      tree.root.findAll((n) => n.props.accessibilityRole === 'header'),
    ).not.toHaveLength(0);
  });

  it('con onClose lleva la × con su etiqueta, y al pulsarla llama a onClose', async () => {
    const onClose = jest.fn();
    const tree = await render(
      <AreaHero
        title="Hola"
        onClose={onClose}
        closeLabel="Ocultar el saludo (volverá dentro de un mes)"
      />,
    );
    const close = byLabel(tree, 'Ocultar el saludo (volverá dentro de un mes)');
    expect(close.length).toBeGreaterThan(0);
    const pressable = close.find((n) => typeof n.props.onPress === 'function');
    expect(pressable).toBeDefined();
    await act(async () => {
      pressable!.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sin onClose no hay ×', async () => {
    const tree = await render(<AreaHero title="Hola" closeLabel="Cerrar" />);
    expect(byLabel(tree, 'Cerrar')).toHaveLength(0);
  });
});

describe('useGreetingHidden: no se decide hasta leer el cajón', () => {
  function Probe() {
    const g = useGreetingHidden();
    return <Text>{`ready=${g.ready} hidden=${g.hidden}`}</Text>;
  }
  const out = (tree: ReactTestRenderer) =>
    tree.root.findByType(Text).props.children as string;

  it('ready es false hasta que el cajón contesta, y entonces true', async () => {
    let resolve!: (v: unknown) => void;
    mockPersonId = 'p1';
    mockDrawer = new Promise((r) => {
      resolve = r;
    });
    const tree = await render(<Probe />);
    expect(out(tree)).toBe('ready=false hidden=false');
    await act(async () => {
      resolve(undefined);
    });
    expect(out(tree)).toBe('ready=true hidden=false');
  });

  it('un saludo oculto hasta el futuro sale ready y hidden', async () => {
    mockPersonId = 'p1';
    mockDrawer = Promise.resolve({ greetingHiddenUntil: Date.now() + 100000 });
    const tree = await render(<Probe />);
    expect(out(tree)).toBe('ready=true hidden=true');
  });

  it('sin persona no hay lectura: ready sigue en false', async () => {
    mockPersonId = null;
    mockDrawer = Promise.resolve(undefined);
    const tree = await render(<Probe />);
    expect(out(tree)).toBe('ready=false hidden=false');
  });
});
