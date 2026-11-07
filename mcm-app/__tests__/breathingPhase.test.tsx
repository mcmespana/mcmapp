/**
 * `BreathingPhase`: el texto va con el movimiento del círculo. El círculo CRECE
 * al inspirar y se ENCOGE al espirar; antes decía «Respira...» al crecer e
 * «Inspira...» al encoger, justo al revés.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BreathingPhase } from '@/components/contigo/BreathingPhase';

const BREATH_MS = 2100;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function texto(tree: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string') out.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object')
      walk((n as { children?: unknown }).children);
  };
  walk(tree.toJSON());
  return out.join(' ');
}

describe('BreathingPhase', () => {
  it('inspira al crecer, espira al encoger y vuelve a inspirar', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<BreathingPhase onDone={jest.fn()} />);
    });
    expect(texto(tree)).toContain('Inspira...');
    expect(texto(tree)).not.toContain('Respira');

    await act(async () => {
      jest.advanceTimersByTime(BREATH_MS);
    });
    expect(texto(tree)).toContain('Espira...');

    await act(async () => {
      jest.advanceTimersByTime(BREATH_MS);
    });
    expect(texto(tree)).toContain('Inspira...');
    act(() => tree.unmount());
  });
});
