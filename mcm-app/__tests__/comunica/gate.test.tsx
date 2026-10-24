/**
 * La puerta de la pestaña Comunica (planes 01 §7 y 10 §1): con el enrutador en
 * «legado» se pinta la WebView de siempre, sin tocarla; con el modo mockAlpha, la
 * nativa.
 */
// Los dobles de `jest.mock` tienen que pedir sus módulos dentro de la fábrica
// (`require`) y el import de la puerta va después de los mocks.
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

let mockAlpha = false;
let mockFlag: string | undefined;

jest.mock('@/app/screens/ComunicaScreen', () => {
  const { Text: T } = require('react-native');
  return () => <T>LEGADO</T>;
});
jest.mock('@/components/comunica/pasar-lista/ComunicaHome', () => {
  const { Text: T } = require('react-native');
  return () => <T>NATIVA</T>;
});
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/components/comunica/comun/ComunicaAreaProvider', () => ({
  useArea: () => ({ session: { status: 'signedIn', me: null } }),
}));
jest.mock('@/contexts/PreviewChannelContext', () => ({
  usePreviewChannel: () => ({ enabled: mockAlpha }),
}));
jest.mock('@/contexts/ProfileConfigContext', () => ({
  useProfileConfigContext: () => ({
    rawConfig: { global: { comunicaNativa: mockFlag } },
  }),
}));

import ComunicaGate from '@/app/(tabs)/comunica/index';

const render = () => {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<ComunicaGate />);
  });
  return tree!.root
    .findAllByType(Text)
    .map((t) => t.props.children)
    .join('');
};

describe('puerta de Comunica', () => {
  it('modo normal → el legado', () => {
    mockAlpha = false;
    mockFlag = undefined;
    expect(render()).toBe('LEGADO');
  });
  it('modo alpha → la nativa', () => {
    mockAlpha = true;
    mockFlag = undefined;
    expect(render()).toBe('NATIVA');
  });
  it('interruptor en off → el legado aunque haya alpha', () => {
    mockAlpha = true;
    mockFlag = 'off';
    expect(render()).toBe('LEGADO');
  });
  it('interruptor en all → la nativa para todos', () => {
    mockAlpha = false;
    mockFlag = 'all';
    expect(render()).toBe('NATIVA');
  });
});
