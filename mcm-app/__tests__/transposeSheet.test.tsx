/**
 * Hoja de tono y cejilla (`TransposeBottomSheet`).
 *
 * Con la tonalidad de la canción, la hoja habla en TONOS («LA · Original: DO»)
 * y cada botón dice a qué tono te lleva. Sin ella, cae a semitonos. Y al
 * mantener pulsado, cada paso cuenta aunque el prop llegue con retraso.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

import TransposeBottomSheet from '@/components/TransposeBottomSheet';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: () => null,
}));

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function render(
  props: Partial<React.ComponentProps<typeof TransposeBottomSheet>>,
) {
  const onSetTranspose = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      // El botón de restablecer es un `PressableFeedback` de heroui: sin su
      // provider, su hook de animación lee un global que no existe.
      <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
        <HeroUINativeProvider>
          <TransposeBottomSheet
            visible
            onClose={() => {}}
            currentTranspose={0}
            onSetTranspose={onSetTranspose}
            {...props}
          />
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return { tree, onSetTranspose };
}

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .filter(Boolean);

const button = (tree: ReactTestRenderer, label: RegExp) => {
  const b = tree.root
    .findAll(
      (n) =>
        typeof n.props.onPressIn === 'function' &&
        label.test(String(n.props.accessibilityLabel ?? '')),
    )
    .at(0);
  if (!b) throw new Error(`No hay botón ${label}`);
  return b;
};

describe('TransposeBottomSheet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('con tonalidad: el valor es el tono y los botones dicen a dónde van', () => {
    const { tree } = render({
      songKey: 'C',
      notation: 'ES',
      currentTranspose: 9,
    });
    const t = texts(tree);
    expect(t).toContain('LA');
    expect(t).toContain('Original: DO');
    expect(t).toContain('+9 semitonos');
    expect(button(tree, /^Subir un semitono/).props.accessibilityLabel).toBe(
      'Subir un semitono, a LA#',
    );
  });

  it('sin transponer: dice el tono y que es el original', () => {
    const { tree } = render({ songKey: 'D', notation: 'EN' });
    const t = texts(tree);
    expect(t).toContain('D');
    expect(t).toContain('Tono original');
    expect(t).toContain('Original');
  });

  it('sin tonalidad: cae a semitonos', () => {
    const { tree } = render({ currentTranspose: -2 });
    expect(texts(tree)).toContain('-2');
    expect(texts(tree)).toContain('semitonos');
  });

  it('cada pulsación cuenta aunque el prop no se haya actualizado aún', () => {
    const { tree, onSetTranspose } = render({ songKey: 'C' });
    const up = button(tree, /^Subir un semitono/);
    act(() => {
      up.props.onPressIn();
      up.props.onPressOut();
      up.props.onPressIn();
      up.props.onPressOut();
    });
    expect(onSetTranspose.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });

  it('la cejilla no baja de 0, pero avisa en vez de quedarse muda', () => {
    const onSetCapoOverride = jest.fn();
    const { tree } = render({ originalCapo: 0, onSetCapoOverride });
    const down = button(tree, /^Bajar la cejilla/);
    expect(down.props.accessibilityState).toEqual({ disabled: true });
    act(() => {
      down.props.onPressIn();
    });
    expect(onSetCapoOverride).not.toHaveBeenCalled();
    // Subir desde el original guarda el override; volver a él lo borra.
    act(() => {
      button(tree, /^Subir la cejilla/).props.onPressIn();
    });
    expect(onSetCapoOverride).toHaveBeenLastCalledWith(1);
  });
});
