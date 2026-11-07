/**
 * Avatares, filas de navegación y piezas de perfiles con el estilo del plugin
 * (plan 2C): el degradado solo en las MARCAS (avatar de ficha, inicial de la
 * persona que se ve), nunca en una fila de lista, y las etiquetas para el
 * lector de pantalla intactas.
 */
/* eslint-disable import/first */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

import NavRow from '@/components/comunica/comun/NavRow';
import PersonAvatar from '@/components/comunica/comun/PersonAvatar';
import PersonRow from '@/components/comunica/comun/PersonRow';
import ProfileCard from '@/components/comunica/perfiles/ProfileCard';
import ProfileInitial from '@/components/comunica/perfiles/ProfileInitial';
import { comunicaTheme } from '@/components/comunica/comun/theme';

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

const gradients = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      typeof n.type === 'string' &&
      typeof n.props.testID === 'string' &&
      n.props.testID.startsWith('brand-gradient-'),
  );

const tilesOf = (tree: ReactTestRenderer) => {
  const fill = comunicaTheme(false).iconTile.fill;
  return tree.root.findAll((n) => {
    if (typeof n.type !== 'string') return false;
    const st = StyleSheet.flatten(n.props.style) as
      { backgroundColor?: string; width?: number } | undefined;
    return st?.backgroundColor === fill && st?.width === 36;
  });
};

const person = { id: 'p1', firstName: 'Lucía', lastName: 'Messeguer' };
const badges = { healthNote: false, noPhotos: false, notHomeAlone: false };
const profile = { id: 'h1', firstName: 'Lucía', lastName: 'Messeguer' };

describe('PersonAvatar', () => {
  it('por defecto es neutro: sin degradado', () => {
    expect(gradients(mount(<PersonAvatar person={person} />))).toHaveLength(0);
  });

  it('tone="accent" tampoco pinta degradado', () => {
    expect(
      gradients(mount(<PersonAvatar person={person} tone="accent" />)),
    ).toHaveLength(0);
  });

  it('tone="brand" pinta UNA marca de degradado', () => {
    const g = gradients(mount(<PersonAvatar person={person} tone="brand" />));
    expect(g).toHaveLength(1);
    expect(g[0].props.testID).toBe('brand-gradient-mark');
  });

  it('si se pasa un fondo, manda sobre el tono de marca', () => {
    expect(
      gradients(
        mount(
          <PersonAvatar person={person} tone="brand" background="#000000" />,
        ),
      ),
    ).toHaveLength(0);
  });
});

describe('PersonRow', () => {
  it('nunca lleva degradado (listas largas), ni con avatarTone', () => {
    const t = mount(
      <>
        <PersonRow person={{ ...person, badges }} />
        <PersonRow person={{ ...person, badges }} avatarTone="accent" />
      </>,
    );
    expect(gradients(t)).toHaveLength(0);
  });
});

describe('ProfileInitial', () => {
  it('la persona que se ve (selected) lleva la marca; las demás, no', () => {
    expect(
      gradients(mount(<ProfileInitial profile={profile} selected />)),
    ).toHaveLength(1);
    expect(
      gradients(mount(<ProfileInitial profile={profile} selected={false} />)),
    ).toHaveLength(0);
  });
});

describe('ProfileCard', () => {
  it('conserva su etiqueta accesible y marca solo a la persona activa', () => {
    const onPress = jest.fn();
    const active = mount(
      <ProfileCard
        profile={profile as never}
        isSelf={false}
        isActive
        onPress={onPress}
      />,
    );
    const btn = active.root.find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.accessibilityLabel === 'string',
    );
    expect(btn.props.accessibilityLabel).toMatch(
      /viéndolo ahora\. Seguir aquí$/,
    );
    expect(gradients(active)).toHaveLength(1);

    const other = mount(
      <ProfileCard
        profile={profile as never}
        isSelf={false}
        isActive={false}
        onPress={onPress}
      />,
    );
    expect(gradients(other)).toHaveLength(0);
    expect(
      other.root.find(
        (n) =>
          n.props.accessibilityRole === 'button' &&
          typeof n.props.accessibilityLabel === 'string',
      ).props.accessibilityLabel,
    ).toMatch(/\. Elegir$/);
  });
});

describe('NavRow', () => {
  const label = 'Pagos, Tus pagos y recibos';

  it('con icono pinta la baldosa y deja la etiqueta de la fila como estaba', () => {
    const tree = mount(
      <NavRow
        icon="creditcard"
        title="Pagos"
        subtitle="Tus pagos y recibos"
        onPress={jest.fn()}
      />,
    );
    const row = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === label,
    );
    expect(row).toBeTruthy();
    const tiles = tilesOf(tree);
    expect(tiles.length).toBeGreaterThan(0);
    // La baldosa no es un objetivo propio: el lector la salta.
    expect(tiles[0].props.accessible).toBe(false);
    expect(gradients(tree)).toHaveLength(0);
  });

  it('sin icono no hay baldosa', () => {
    const tree = mount(<NavRow title="Pagos" onPress={jest.fn()} dot="#000" />);
    const tiles = tilesOf(tree);
    expect(tiles).toHaveLength(0);
  });
});
