import {
  harmoniousColors,
  harmonyOffsets,
  hexToOklch,
  oklchToHex,
} from '@/utils/colorHarmony';

const HEX = /^#[0-9A-F]{6}$/;

describe('armonía de colores (OKLCH)', () => {
  it.each(['#F07C2B', '#253883', '#A3BD31', '#FFFFFF', '#000000', '#E15C62'])(
    'ida y vuelta OKLCH conserva el color %s',
    (hex) => {
      const back = oklchToHex(hexToOklch(hex));
      const d = (a: string, b: string, i: number) =>
        Math.abs(
          parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16),
        );
      for (const i of [1, 3, 5]) expect(d(back, hex, i)).toBeLessThanOrEqual(1);
    },
  );

  it('los giros: 1 → nada, 2 → complementario, 3 → complementario dividido', () => {
    expect(harmonyOffsets(1)).toEqual([0]);
    expect(harmonyOffsets(2)).toEqual([0, 180]);
    expect(harmonyOffsets(3)).toEqual([0, 150, 210]);
    expect(harmonyOffsets(4)).toEqual([0, 90, 180, 270]);
  });

  it('el primero es el color base tal cual', () => {
    expect(harmoniousColors('#f07c2b', 3)[0]).toBe('#F07C2B');
  });

  it.each([1, 2, 3, 4, 5, 8])('%i colores válidos y distintos', (n) => {
    const cols = harmoniousColors('#F07C2B', n);
    expect(cols).toHaveLength(n);
    cols.forEach((c) => expect(c).toMatch(HEX));
    expect(new Set(cols).size).toBe(n);
  });

  it('conserva la luminosidad percibida al girar (no salen chillones)', () => {
    const [base, ...rest] = harmoniousColors('#F07C2B', 3);
    const L = hexToOklch(base).l;
    rest.forEach((c) =>
      expect(Math.abs(hexToOklch(c).l - L)).toBeLessThan(0.02),
    );
  });

  it('con un naranja, los hermanos son fríos (teal y azul)', () => {
    const [, a, b] = harmoniousColors('#F07C2B', 3).map((c) => hexToOklch(c).h);
    expect(a).toBeGreaterThan(180);
    expect(a).toBeLessThan(230);
    expect(b).toBeGreaterThan(230);
    expect(b).toBeLessThan(290);
  });
});
