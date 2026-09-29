/**
 * `onColor` — el color de texto legible sobre un fondo de color.
 *
 * Antes esta pregunta se respondía con un umbral de brillo puesto a ojo, y
 * había CINCO umbrales distintos por el repo (150, 160, 170, 175, 200) con
 * tres parejas de blanco/negro diferentes. Este test fija que ahora se decide
 * por contraste real y que los casos que importan salen bien.
 */
import { onColor } from '@/utils/colorUtils';
import brand, { LiturgicalColors } from '@/constants/colors';

const DARK = '#1C1C1E';
const LIGHT = '#FFFFFF';

describe('onColor', () => {
  it.each([
    ['amarillo de marca', brand.yellow, DARK],
    ['verde de marca', brand.green, DARK],
    ['celeste', brand.info, DARK],
    ['azul MCM', brand.primary, LIGHT],
    ['morado LC', brand.purple, LIGHT],
    ['azul de texto', brand.text, LIGHT],
    // Ojo: sobre el rojo MIC gana el texto OSCURO (4,79:1 frente a 3,55 del
    // blanco). Es contraintuitivo y es justo lo que un umbral a ojo fallaba.
    ['rojo MIC', brand.accent, DARK],
  ])('sobre el %s elige el legible', (_label, bg, expected) => {
    expect(onColor(bg)).toBe(expected);
  });

  it.each(Object.entries(LiturgicalColors))(
    'el color litúrgico %s recibe un texto legible',
    (_name, hex) => {
      expect([DARK, LIGHT]).toContain(onColor(hex));
    },
  );

  it('los extremos son obvios', () => {
    expect(onColor('#000000')).toBe(LIGHT);
    expect(onColor('#FFFFFF')).toBe(DARK);
  });

  it('acepta hex de 3 dígitos', () => {
    expect(onColor('#fff')).toBe(onColor('#FFFFFF'));
    expect(onColor('#000')).toBe(onColor('#000000'));
  });

  it('siempre da al menos 4.5:1 de contraste con el fondo', () => {
    const lum = (hex: string) => {
      const h = hex.replace('#', '');
      const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const [r, g, b] = ch.map((c) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // Los colores reales que la app pinta de fondo: marca y litúrgicos.
    const backgrounds = [
      ...Object.values(brand),
      ...Object.values(LiturgicalColors),
    ];
    for (const bg of backgrounds) {
      expect(ratio(onColor(bg), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
