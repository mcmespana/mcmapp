/**
 * Fase 2B del estilo del plugin: la etiqueta de sección en mayúsculas pequeñas
 * (sin tocar el texto), la superficie de `Section` con las keys de siempre, la
 * celda de lista con borde y sin degradado, y la lista de datos de una ficha.
 */
/* eslint-disable import/first */
import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

import ListCell, { cellPosition } from '@/components/comunica/comun/ListCell';
import Section, { SectionLabel } from '@/components/comunica/comun/Section';
import FactList from '@/components/comunica/comun/record/FactList';
import { comunicaTheme } from '@/components/comunica/comun/theme';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <HeroUINativeProvider>{node}</HeroUINativeProvider>
  </SafeAreaProvider>
);

function mount(node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(wrap(node));
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');

const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {};

const gradients = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.testID === 'string' &&
      n.props.testID.startsWith('brand-gradient-'),
  );

describe('SectionLabel', () => {
  it('pone las mayúsculas con textTransform y deja el texto tal cual', () => {
    const tree = mount(<SectionLabel>Tu perfil</SectionLabel>);
    expect(texts(tree)).toBe('Tu perfil');
    const label = tree.root.findAllByType(Text)[0];
    expect(flat(label.props.style).textTransform).toBe('uppercase');
    expect(label.props.accessibilityRole).toBe('header');
  });

  it('con warning va en la misma receta (mayúsculas) y en ámbar', () => {
    const t = comunicaTheme(false);
    const tree = mount(<SectionLabel warning>Te faltan 2 listas</SectionLabel>);
    const label = tree.root.findAllByType(Text)[0];
    const style = flat(label.props.style);
    expect(texts(tree)).toBe('Te faltan 2 listas');
    // Misma receta que el resto de etiquetas; el texto no se transforma a mano.
    expect(style.textTransform).toBe('uppercase');
    expect(style.color).toBe(t.warningText);
  });
});

describe('Section', () => {
  it('lleva la etiqueta y mantiene las keys: al filtrar no se remonta', () => {
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
    expect(texts(tree)).toContain('Participantes');
    expect(mounts).toEqual(['ana', 'bea', 'carla']);
    act(() => {
      tree.update(wrap(list(['bea', 'carla'])));
    });
    expect(mounts).toEqual(['ana', 'bea', 'carla']);
  });

  it('no pinta degradado', () => {
    const tree = mount(
      <Section title="Datos">
        <Text>fila</Text>
      </Section>,
    );
    expect(gradients(tree)).toHaveLength(0);
  });
});

describe('ListCell', () => {
  const t = comunicaTheme(false);
  const cell = (n: number, i: number) => {
    const tree = mount(
      <ListCell position={cellPosition(i, n)}>
        <Text>x</Text>
      </ListCell>,
    );
    // La vista de fuera de la celda (la primera con borde izquierdo).
    const outer = tree.root.findAllByType(View).find((v) => {
      const s = flat(v.props.style);
      return s.borderLeftWidth === 1;
    });
    return { tree, style: flat(outer?.props.style) };
  };

  it('lleva el borde de la tarjeta: lados siempre, arriba en la primera y abajo en la última', () => {
    const first = cell(3, 0).style;
    const middle = cell(3, 1).style;
    const last = cell(3, 2).style;
    const only = cell(1, 0).style;
    for (const s of [first, middle, last, only]) {
      expect(s.borderColor).toBe(t.cardBorder);
      expect(s.borderLeftWidth).toBe(1);
      expect(s.borderRightWidth).toBe(1);
    }
    expect([first.borderTopWidth, first.borderBottomWidth]).toEqual([1, 0]);
    expect([middle.borderTopWidth, middle.borderBottomWidth]).toEqual([0, 0]);
    expect([last.borderTopWidth, last.borderBottomWidth]).toEqual([0, 1]);
    expect([only.borderTopWidth, only.borderBottomWidth]).toEqual([1, 1]);
  });

  it('nunca pinta degradado (es fila de una lista larga)', () => {
    for (const [n, i] of [
      [1, 0],
      [3, 0],
      [3, 1],
      [3, 2],
    ]) {
      expect(gradients(cell(n, i).tree)).toHaveLength(0);
    }
  });
});

describe('FactList', () => {
  it('pinta cada fila con su etiqueta y su dato, y sin degradado', () => {
    const tree = mount(
      <FactList
        facts={[
          { icon: 'calendar', label: 'Cuándo', value: 'Sábado 8' },
          {
            icon: 'person.crop.circle',
            label: 'Quién',
            value: 'Marta',
            onPress: jest.fn(),
          },
        ]}
      />,
    );
    expect(texts(tree)).toBe('Cuándo | Sábado 8 | Quién | Marta');
    expect(gradients(tree)).toHaveLength(0);
  });

  it('no pinta nada sin datos', () => {
    const tree = mount(<FactList facts={[]} />);
    expect(texts(tree)).toBe('');
  });
});
