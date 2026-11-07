/**
 * `GlassSurface` (Android y web) en modo oscuro.
 *
 * Sin `tintColor`, el respaldo era blanco al 95 % en los DOS modos. En iOS no
 * se veía (manda el cristal nativo), así que pasó meses sin que nadie lo
 * notara: en Android, la cápsula de la Home, el botón de volver, los de un
 * evento y el FAB de la canción eran pastillas blancas con iconos claros.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/colors';

let mockScheme: 'light' | 'dark' = 'dark';
jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => mockScheme,
}));

// Jest corre como iOS y resolvería `GlassSurface.ios`: se pide el de
// Android/web por su nombre completo.
const GlassSurface: typeof import('@/components/ui/GlassSurface').default =
  jest.requireActual('@/components/ui/GlassSurface.tsx').default;

function backgroundOf(tree: ReactTestRenderer): string | undefined {
  const root = tree.root.findAllByType(View)[0];
  return StyleSheet.flatten(root.props.style)?.backgroundColor as
    string | undefined;
}

function render(props: React.ComponentProps<typeof GlassSurface> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<GlassSurface {...props} />);
  });
  return tree;
}

describe('GlassSurface sin tinte', () => {
  it('en oscuro NO es blanco: es la superficie elevada', () => {
    mockScheme = 'dark';
    const bg = backgroundOf(render());
    expect(bg).not.toMatch(/255,\s*255,\s*255/);
    expect(bg?.toLowerCase().startsWith(Colors.dark.card.toLowerCase())).toBe(
      true,
    );
  });

  it('en claro sigue siendo el blanco translúcido de siempre', () => {
    mockScheme = 'light';
    expect(backgroundOf(render())).toBe('rgba(255, 255, 255, 0.95)');
  });

  it('un tinte explícito manda sobre el modo', () => {
    mockScheme = 'dark';
    expect(backgroundOf(render({ tintColor: '#FCD200' }))).toBe('#FCD200F0');
  });
});
