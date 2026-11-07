/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
/**
 * Fase 3C: la tarjeta de un documento usa la cápsula neutral con el tipo (o un
 * icono) y no pinta degradado; la etiqueta accesible de la tarjeta no cambia.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('heroui-native', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  const PressableFeedback: any = ({ children, ...rest }: any) =>
    R.createElement(Pressable, rest, children);
  PressableFeedback.Scale = () => null;
  PressableFeedback.Highlight = () => null;
  return { PressableFeedback };
});

import DocumentCard from '@/components/comunica/documentos/DocumentCard';
import type { DocumentSummary } from '@/services/comunica/contract';

const base = {
  id: 'd1',
  name: 'DNI',
  status: { key: 'active', label: 'Vigente' },
} as unknown as DocumentSummary;

const render = (doc: DocumentSummary) => {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(
      <DocumentCard
        doc={doc}
        today="2026-11-05"
        downloading={false}
        onOpen={() => {}}
        onDownload={() => {}}
      />,
    );
  });
  return tree!;
};

const ids = (r: ReturnType<typeof create>) =>
  r.root
    .findAll((n) => typeof n.props.testID === 'string')
    .map((n) => n.props.testID as string);

describe('DocumentCard (adopción de las piezas del área)', () => {
  it('con archivo muestra el tipo en la cápsula neutral, sin degradado', () => {
    const r = render({ ...base, fileName: 'dni.pdf' } as DocumentSummary);
    const texts = r.root
      .findAll((n) => (n.type as unknown) === 'Text')
      .map((n) => [n.props.children].flat().join(''));
    expect(texts).toContain('PDF');
    expect(ids(r).filter((i) => i.startsWith('brand-gradient'))).toEqual([]);
  });

  it('sin archivo pinta un icono en la cápsula, sin degradado', () => {
    const r = render({ ...base, fileName: null } as unknown as DocumentSummary);
    expect(ids(r).filter((i) => i.startsWith('brand-gradient'))).toEqual([]);
  });

  it('la etiqueta accesible del botón de abrir sigue siendo la misma', () => {
    const r = render({ ...base, fileName: 'dni.pdf' } as DocumentSummary);
    const open = r.root.find(
      (n) => n.props.accessibilityHint === 'Abre el documento',
    );
    expect(open.props.accessibilityRole).toBe('button');
    expect(String(open.props.accessibilityLabel)).toContain('DNI');
  });
});
