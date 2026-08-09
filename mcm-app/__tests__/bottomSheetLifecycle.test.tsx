/**
 * Ciclo de vida del `BottomSheet` compartido — lo comparten una veintena de
 * hojas (calendarios, multimedia, sugerir canción, acciones de playlist…), así
 * que cuando se rompe se rompen todas a la vez. Estos tests cubren los dos
 * fallos reales del 2026-08-09:
 *
 *  1. El `Modal` no se montaba en el mismo render en que `visible` pasaba a
 *     true (se encendía con un setState en fase de render que se perdía en
 *     pantallas que hacen su propio setState en fase de render). La hoja se
 *     quedaba invisible con `visible` a true.
 *  2. `onCloseComplete` no llegaba a dispararse, y con él se perdía la acción
 *     diferida del menú "..." del cantoral (cada opción es "cierra la hoja y
 *     abre otra cosa"), así que el menú entero parecía muerto.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import BottomSheet from '@/components/BottomSheet';

const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      {children}
    </SafeAreaProvider>
  );
}

function renderSheet(props: Partial<React.ComponentProps<typeof BottomSheet>>) {
  const merged = {
    visible: false,
    onClose: () => {},
    children: <Text>contenido</Text>,
    ...props,
  } as React.ComponentProps<typeof BottomSheet>;
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <Wrap>
        <BottomSheet {...merged} />
      </Wrap>,
    );
  });
  return { tree, merged };
}

/** ¿Hay un `Modal` montado y presentándose? */
const modalIsUp = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Modal).some((m) => m.props.visible === true);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('BottomSheet', () => {
  it('no monta el Modal si nace cerrada', () => {
    const { tree } = renderSheet({ visible: false });
    expect(modalIsUp(tree)).toBe(false);
  });

  it('monta el Modal en cuanto `visible` pasa a true', () => {
    const { tree, merged } = renderSheet({ visible: false });

    act(() => {
      tree.update(
        <Wrap>
          <BottomSheet {...merged} visible />
        </Wrap>,
      );
    });

    expect(modalIsUp(tree)).toBe(true);
  });

  it('sigue montada mientras se cierra y se desmonta al acabar', () => {
    const { tree, merged } = renderSheet({ visible: true });
    expect(modalIsUp(tree)).toBe(true);

    act(() => {
      tree.update(
        <Wrap>
          <BottomSheet {...merged} visible={false} />
        </Wrap>,
      );
    });
    // Durante la animación de salida el Modal NO puede desaparecer de golpe.
    expect(modalIsUp(tree)).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(modalIsUp(tree)).toBe(false);
  });

  it('dispara `onCloseComplete` al cerrar, y una sola vez', () => {
    const onCloseComplete = jest.fn();
    const { tree, merged } = renderSheet({ visible: true, onCloseComplete });

    act(() => {
      tree.update(
        <Wrap>
          <BottomSheet
            {...merged}
            visible={false}
            onCloseComplete={onCloseComplete}
          />
        </Wrap>,
      );
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onCloseComplete).toHaveBeenCalledTimes(1);
  });

  it('no dispara `onCloseComplete` si nunca llegó a abrirse', () => {
    const onCloseComplete = jest.fn();
    renderSheet({ visible: false, onCloseComplete });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onCloseComplete).not.toHaveBeenCalled();
  });

  it('abrir de nuevo tras cerrar vuelve a montar el Modal', () => {
    const { tree, merged } = renderSheet({ visible: true });

    act(() => {
      tree.update(
        <Wrap>
          <BottomSheet {...merged} visible={false} />
        </Wrap>,
      );
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(modalIsUp(tree)).toBe(false);

    act(() => {
      tree.update(
        <Wrap>
          <BottomSheet {...merged} visible />
        </Wrap>,
      );
    });
    expect(modalIsUp(tree)).toBe(true);
  });
});
