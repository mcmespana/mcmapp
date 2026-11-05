/**
 * Fase 3A: la tarjeta de una actividad pinta la cápsula de fecha con el
 * degradado de marca si la fecha es de hoy o futura, y apagada si ya pasó.
 * La fila de un evento pasado (`muted`) tampoco lleva degradado.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { HeroUINativeProvider } from 'heroui-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EventCard from '@/components/comunica/actividades/EventCard';
import { EventListRow } from '@/components/comunica/eventos/EventCards';
import type {
  EventCard as EventCardData,
  EventSummary,
} from '@/services/comunica/contract';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const TODAY = '2026-11-05';

const event = (startDate: string, endDate = startDate): EventCardData => ({
  id: 'e1',
  name: 'Convivencia',
  startDate,
  endDate,
  place: 'Sevilla',
  statusLabel: null,
  window: { opensOn: null, closesOn: null },
  hasAdvancedForm: false,
  myRegistrationId: null,
  myRegistrationStatus: null,
});

const marks = (tree: ReturnType<typeof create>) =>
  tree.root.findAll(
    (n) =>
      n.props.testID === 'brand-gradient-mark' && typeof n.type === 'string',
  ).length;

const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 375, height: 812 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <HeroUINativeProvider>{node}</HeroUINativeProvider>
  </SafeAreaProvider>
);

const render = (node: React.ReactElement) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(wrap(node));
  });
  return tree;
};

describe('actividades: adopción de las piezas del área', () => {
  it('una actividad futura lleva la cápsula con degradado', () => {
    const tree = render(
      <EventCard
        event={event('2026-12-20')}
        today={TODAY}
        onOpen={() => {}}
        onAction={() => {}}
      />,
    );
    expect(marks(tree)).toBe(1);
  });

  it('una actividad ya pasada lleva la cápsula apagada', () => {
    const tree = render(
      <EventCard
        event={event('2026-10-01')}
        today={TODAY}
        onOpen={() => {}}
        onAction={() => {}}
      />,
    );
    expect(marks(tree)).toBe(0);
  });

  it('una actividad en curso (empezó antes, acaba después) no se apaga', () => {
    const tree = render(
      <EventCard
        event={event('2026-11-01', '2026-11-09')}
        today={TODAY}
        onOpen={() => {}}
        onAction={() => {}}
      />,
    );
    expect(marks(tree)).toBe(1);
  });

  it('la fila de un evento pasado (muted) no pinta degradado', () => {
    const summary: EventSummary = {
      id: 'e2',
      name: 'Pascua',
      startDate: '2026-04-01',
      endDate: '2026-04-05',
      startsAt: '2026-04-01T08:00:00.000Z',
      endsAt: '2026-04-05T18:00:00.000Z',
    };
    const muted = render(<EventListRow event={summary} muted />);
    expect(marks(muted)).toBe(0);
    const next = render(<EventListRow event={summary} />);
    expect(marks(next)).toBe(1);
  });
});
