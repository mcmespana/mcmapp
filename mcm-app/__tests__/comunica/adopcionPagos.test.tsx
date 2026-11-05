/**
 * Pagos e inscripciones con las piezas compartidas (fase 3B): la tarjeta de un
 * pago es una `CardSurface` (borde `cardBorder`), la cápsula va en degradado si
 * la fecha es de hoy o futura y en gris si ya pasó, y la etiqueta accesible no
 * cambia. Nunca degradado de más en una lista.
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
jest.mock('@/services/comunica', () => ({
  comunicaNow: () => new Date('2026-11-05T10:00:00Z'),
}));

import PaymentCard from '@/components/comunica/pagos/PaymentCard';
import { comunicaTheme } from '@/components/comunica/comun/theme';
import type { Payment } from '@/services/comunica/contract';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  title: 'Cuota del campamento',
  date: '2026-11-20',
  amountCents: 12000,
  status: 'pending',
  statusLabel: 'Pendiente',
  method: 'transfer',
  methodLabel: 'Transferencia',
  canPayByCard: false,
  ...over,
});

function mount(p: Payment): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <PaymentCard payment={p} onOpen={jest.fn()} onPay={jest.fn()} />
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

const marks = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      typeof n.type === 'string' && n.props.testID === 'brand-gradient-mark',
  ).length;
const blocks = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      typeof n.type === 'string' && n.props.testID === 'brand-gradient-block',
  ).length;

describe('PaymentCard con las piezas compartidas', () => {
  it('es una CardSurface: borde cardBorder', () => {
    const border = comunicaTheme(false).cardBorder;
    const tree = mount(payment());
    const surfaces = tree.root.findAll((n) => {
      if (typeof n.type !== 'string') return false;
      const st = StyleSheet.flatten(n.props.style) as
        { borderColor?: string; borderWidth?: number } | undefined;
      return st?.borderColor === border && st?.borderWidth === 1;
    });
    expect(surfaces.length).toBeGreaterThan(0);
  });

  it('su etiqueta accesible no cambia', () => {
    const tree = mount(payment());
    const press = tree.root.find(
      (n) =>
        typeof n.type === 'string' &&
        n.props.accessibilityHint === 'Abre el pago',
    );
    expect(press.props.accessibilityLabel).toBe(
      'Cuota del campamento, Transferencia, 120 euros',
    );
  });

  it('fecha futura → cápsula en degradado; fecha pasada → gris', () => {
    expect(marks(mount(payment({ date: '2026-11-20' })))).toBe(1);
    expect(marks(mount(payment({ date: '2026-10-01' })))).toBe(0);
  });

  it('una tarjeta de lista nunca pinta un bloque de degradado', () => {
    expect(blocks(mount(payment()))).toBe(0);
  });
});
