/**
 * Las cabeceras de ficha (participante, monitor y foto de «Mis datos») llevan
 * el avatar de identidad de marca; las filas de persona de las listas, nunca
 * (plan 3D). La barra de asistencia conserva el verde de estado: la marca no
 * se mezcla con la semántica de asistencia.
 */
/* eslint-disable import/first */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));

import PersonAvatar from '@/components/comunica/comun/PersonAvatar';
import PersonRow from '@/components/comunica/comun/PersonRow';

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

const marks = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      typeof n.type === 'string' && n.props.testID === 'brand-gradient-mark',
  );

const person = { id: 'p1', firstName: 'Lucía', lastName: 'Messeguer' };
const badges = { healthNote: false, noPhotos: false, notHomeAlone: false };

const ROOT = path.join(__dirname, '..', '..', 'components', 'comunica');
const src = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('avatar de ficha (72 pt)', () => {
  it('con tone="brand" pinta UNA marca de degradado', () => {
    expect(
      marks(mount(<PersonAvatar person={person} size={72} tone="brand" />)),
    ).toHaveLength(1);
  });

  it('una fila de persona de una lista no pinta ninguna', () => {
    const tree = mount(
      <PersonRow
        person={{ ...person, fullName: 'Lucía Messeguer', badges } as never}
        onPress={() => {}}
      />,
    );
    expect(marks(tree)).toHaveLength(0);
  });
});

describe('quién usa el avatar de marca', () => {
  it.each([
    ['grupos/ParticipantScreen.tsx', /size=\{72\}\s+tone="brand"/],
    ['coordinacion/MonitorScreen.tsx', /size=\{72\}\s+tone="brand"/],
    ['datos/PhotoBlock.tsx', /size=\{AVATAR\}\s+tone="brand"/],
  ])('%s pone el avatar de la ficha en tone="brand"', (file, pattern) => {
    expect(src(file)).toMatch(pattern);
  });

  it('un `background` explícito anularía el degradado: las fichas no lo pasan', () => {
    for (const file of [
      'grupos/ParticipantScreen.tsx',
      'coordinacion/MonitorScreen.tsx',
      'datos/PhotoBlock.tsx',
    ]) {
      const call = src(file).match(/<PersonAvatar[^>]*tone="brand"[^>]*\/>/);
      expect(call?.[0]).toBeDefined();
      expect(call![0]).not.toMatch(/background=/);
    }
  });

  it('la barra de asistencia sigue en el verde de estado, sin degradado', () => {
    const att = src('grupos/FichaAttendance.tsx');
    expect(att).toMatch(/MARK_FILL\.yes/);
    expect(att).not.toMatch(/BrandGradient/);
  });
});
