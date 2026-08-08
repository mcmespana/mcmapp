/**
 * Selección de las lecturas: seleccionar PRIMERO y tocar el lápiz DESPUÉS.
 *
 * Era el fallo que se colaba: `HighlightableReading` solo reportaba la selección
 * dentro del modo lápiz, así que al entrar en el modo la barra decía "selecciona
 * un texto" aunque hubiera texto seleccionado, y no reaccionaba hasta mover las
 * asas un pelo.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { HighlightableReading } from '@/components/contigo/HighlightableReading';
import {
  useReadingHighlights,
  type ReadingHighlights,
} from '@/hooks/useReadingHighlights';

const TEXT = 'En aquel tiempo, Jesús dijo a sus discípulos.';

function renderReading(props: {
  penMode: boolean;
  onSelectionChange: (sel: { start: number; end: number } | null) => void;
}) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <HighlightableReading
        text={TEXT}
        penMode={props.penMode}
        onSelectionChange={props.onSelectionChange}
        color="#000"
        fontSize={18}
        lineHeight={28}
        isDark={false}
      />,
    );
  });
  return tree;
}

/** Simula la selección nativa del UITextView / EditText. */
function selectRange(
  tree: ReturnType<typeof create>,
  start: number,
  end: number,
) {
  act(() => {
    tree.root.findByType(TextInput).props.onSelectionChange({
      nativeEvent: { selection: { start, end } },
    });
  });
}

describe('HighlightableReading — reporte de selección', () => {
  it('reporta la selección FUERA del modo lápiz', () => {
    const onSelectionChange = jest.fn();
    const tree = renderReading({ penMode: false, onSelectionChange });

    selectRange(tree, 16, 21);

    expect(onSelectionChange).toHaveBeenCalledWith({ start: 16, end: 21 });
  });

  it('normaliza una selección hecha de derecha a izquierda', () => {
    const onSelectionChange = jest.fn();
    const tree = renderReading({ penMode: true, onSelectionChange });

    selectRange(tree, 21, 16);

    expect(onSelectionChange).toHaveBeenCalledWith({ start: 16, end: 21 });
  });

  it('una selección vacía se reporta como null', () => {
    const onSelectionChange = jest.fn();
    const tree = renderReading({ penMode: false, onSelectionChange });

    selectRange(tree, 7, 7);

    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });
});

describe('useReadingHighlights — selección pegajosa', () => {
  const readings = {
    evangelio: { cita: 'Mt 1,1', texto: TEXT },
  } as never;

  it('mantiene la selección aunque luego llegue una vacía', () => {
    let hl!: ReadingHighlights;
    function Probe() {
      hl = useReadingHighlights('2026-08-08', readings, undefined, () => {});
      return null;
    }
    act(() => {
      create(<Probe />);
    });

    act(() => {
      hl.onSelectionChange.evangelio({ start: 16, end: 21 });
    });
    expect(hl.hasSelection).toBe(true);

    // Al tocar un chip de color, iOS colapsa la selección nativa antes de que
    // llegue el onPress: si la vaciáramos, el color no tendría a qué aplicarse.
    act(() => {
      hl.onSelectionChange.evangelio(null);
    });
    expect(hl.hasSelection).toBe(true);

    act(() => {
      hl.clearSelection();
    });
    expect(hl.hasSelection).toBe(false);
  });
});
