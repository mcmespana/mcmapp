/**
 * Cápsula de fecha, chip y tarjeta de registro (fase 2A del estilo del plugin):
 * la voz sigue leyendo lo de siempre, el degradado solo aparece donde toca y la
 * destacada no pone marca sobre marca.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { longDay } from '@/utils/comunica/dates';
import DateCapsule from '@/components/comunica/comun/DateCapsule';
import RecordCard, {
  FeaturedRecordCard,
} from '@/components/comunica/comun/RecordCard';
import StatusChip from '@/components/comunica/comun/StatusChip';

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: () => null,
  Ionicons: () => null,
}));
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);

const render = (el: React.ReactElement): ReactTestRenderer => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el);
  });
  return r;
};
const testIds = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => typeof n.props.testID === 'string')
    .map((n) => n.props.testID as string);
const count = (r: ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')
    .length;
const text = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => [n.props.children].flat().join(''));

describe('DateCapsule', () => {
  it('lee la fecha larga y pinta la marca de degradado por defecto', () => {
    const r = render(<DateCapsule day="2026-11-07" />);
    const box = r.root.find(
      (n) => n.props.accessibilityLabel === longDay('2026-11-07'),
    );
    expect(box).toBeTruthy();
    expect(count(r, 'brand-gradient-mark')).toBe(1);
  });

  it('en neutral (fecha pasada) no pinta degradado', () => {
    const r = render(<DateCapsule day="2026-11-07" tone="neutral" />);
    expect(testIds(r).some((id) => id.startsWith('brand-gradient'))).toBe(
      false,
    );
  });

  it('dentro de un bloque (onGradient) tampoco: marca sobre marca no', () => {
    const r = render(<DateCapsule day="2026-11-07" tone="onGradient" />);
    expect(testIds(r).some((id) => id.startsWith('brand-gradient'))).toBe(
      false,
    );
  });

  it('con `kind` enseña el texto y la voz lo lee', () => {
    const r = render(<DateCapsule kind="PDF" tone="neutral" />);
    expect(text(r)).toContain('PDF');
    expect(
      r.root.find((n) => n.props.accessibilityLabel === 'PDF'),
    ).toBeTruthy();
  });
});

describe('StatusChip', () => {
  it('conserva el texto tal cual (las mayúsculas son de estilo)', () => {
    const r = render(<StatusChip label="Pasada" tone="neutral" />);
    expect(text(r)).toEqual(['Pasada']);
    const label = r.root.find((n) => (n.type as unknown) === 'Text');
    expect(label.props.numberOfLines).toBeUndefined();
  });
});

describe('RecordCard', () => {
  it('una tarjeta normal no pinta bloque; su cápsula es la marca', () => {
    const r = render(
      <RecordCard
        kicker={{ label: 'Hoy', tone: 'accent' }}
        title="Retiro"
        day="2026-11-07"
        lines={['Madrid', { icon: 'clock', text: '10:00' }]}
      />,
    );
    expect(count(r, 'brand-gradient-block')).toBe(0);
    expect(count(r, 'brand-gradient-mark')).toBe(1);
    expect(text(r)).toEqual(
      expect.arrayContaining(['Hoy', 'Retiro', 'Madrid', '10:00']),
    );
  });

  it('la destacada pinta UN bloque y su cápsula no pinta marca', () => {
    const r = render(
      <FeaturedRecordCard
        kicker={{ label: 'Hoy' }}
        code="C1"
        title="Los Peques"
        day="2026-11-07"
      />,
    );
    expect(count(r, 'brand-gradient-block')).toBe(1);
    expect(count(r, 'brand-gradient-mark')).toBe(0);
  });

  it('la voz lee kicker, código, título y líneas', () => {
    const r = render(
      <RecordCard
        kicker={{ label: 'Hoy' }}
        code="C1"
        title="Los Peques"
        lines={['Sala 2', { icon: 'clock', text: '10:00' }]}
      />,
    );
    const card = r.root.find(
      (n) =>
        n.props.accessibilityLabel === 'Hoy, C1, Los Peques, Sala 2, 10:00',
    );
    expect(card).toBeTruthy();
  });

  it('una fecha pasada pide la cápsula neutral', () => {
    const r = render(
      <RecordCard title="Reunión" day="2026-09-01" capsuleTone="neutral" />,
    );
    expect(count(r, 'brand-gradient-mark')).toBe(0);
  });
});
