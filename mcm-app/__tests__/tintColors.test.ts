import colors, { Colors, TabHeaderColors } from '@/constants/colors';
import { contrastRatio } from '@/utils/colorUtils';
import { solidTint, tintedGlyph } from '@/utils/tintColors';

describe('solidTint', () => {
  it('deja un hex tal cual', () => {
    expect(solidTint('#E15C62')).toBe('#E15C62');
  });

  it('convierte el rgba de Comunica en su morado sólido', () => {
    expect(solidTint(TabHeaderColors.comunica)).toBe('#9D1E74');
    expect(solidTint('rgb(255, 0, 16)')).toBe('#FF0010');
  });
});

describe('tintedGlyph', () => {
  const tints: Record<string, string> = {
    cantoral: TabHeaderColors.cancionero,
    visita: TabHeaderColors.visitapapa,
    fotos: TabHeaderColors.fotos,
    contigo: TabHeaderColors.contigo,
    comunica: colors.purple,
    calendario: TabHeaderColors.calendario,
    verde: colors.green,
  };

  const modes = [
    ['claro', Colors.light.background, '1F'],
    ['oscuro', Colors.dark.background, '33'],
  ] as const;

  it.each(
    Object.entries(tints).flatMap(([name, tint]) =>
      modes.map(([mode, surface, alpha]) => [name, mode, tint, surface, alpha]),
    ),
  )(
    '%s en %s: el glifo llega a 3:1 sobre su pastilla',
    (_n, _m, tint, surface, alpha) => {
      const { fill, glyph } = tintedGlyph(tint, surface, alpha);
      expect(fill).toMatch(/^rgba\(/);
      // La pastilla real: el color a esa opacidad sobre el fondo.
      const m = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(fill)!;
      const a = Number(m[4]);
      const sr = parseInt(surface.slice(1, 3), 16);
      const sg = parseInt(surface.slice(3, 5), 16);
      const sb = parseInt(surface.slice(5, 7), 16);
      const hex = (c: number, s: number) =>
        Math.round(c * a + s * (1 - a))
          .toString(16)
          .padStart(2, '0');
      const pill = `#${hex(Number(m[1]), sr)}${hex(Number(m[2]), sg)}${hex(Number(m[3]), sb)}`;
      expect(contrastRatio(glyph, pill)).toBeGreaterThanOrEqual(2.95);
    },
  );

  it('no toca un color que ya se lee', () => {
    // El azul de marca sobre blanco ya pasa de 3:1.
    expect(tintedGlyph(colors.primary, '#ffffff', '1F').glyph).toBe(
      colors.primary,
    );
  });
});
