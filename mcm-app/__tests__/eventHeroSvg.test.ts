import {
  HERO_SVG_MAX_LENGTH,
  isSafeHeroSvg,
  paintHeroSvg,
} from '@/utils/eventHeroSvg';

const ok =
  '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>';

describe('SVG del logo de un evento', () => {
  describe('isSafeHeroSvg', () => {
    it('acepta un SVG de formas, con espacios alrededor', () => {
      expect(isSafeHeroSvg(ok)).toBe(true);
      expect(isSafeHeroSvg(`\n  ${ok}  \n`)).toBe(true);
    });

    it('acepta degradados y grupos (lo habitual en un logo abstracto)', () => {
      expect(
        isSafeHeroSvg(
          '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><g><path d="M0 0L10 10" stroke="url(#g)"/></g></svg>',
        ),
      ).toBe(true);
    });

    it.each([
      ['no es texto', 42],
      ['vacío', '   '],
      ['no empieza por <svg', '<div>hola</div>'],
      ['sin cierre', '<svg viewBox="0 0 1 1"><circle r="1"/>'],
    ])('rechaza: %s', (_n, v) => {
      expect(isSafeHeroSvg(v)).toBe(false);
    });

    it.each([
      ['script', '<svg><script>alert(1)</script></svg>'],
      ['foreignObject', '<svg><foreignObject><div/></foreignObject></svg>'],
      ['image externa', '<svg><image x="0" y="0" width="1" height="1"/></svg>'],
      ['use', '<svg><use/></svg>'],
      ['style', '<svg><style>*{fill:red}</style></svg>'],
      ['manejador on*', '<svg onload="x()"><circle r="1"/></svg>'],
      ['javascript:', '<svg><circle r="1" fill="javascript:x"/></svg>'],
      ['data:', '<svg><circle r="1" fill="data:text/plain,x"/></svg>'],
      ['href', '<svg><circle r="1" href="#a"/></svg>'],
      ['entidad', '<svg><!ENTITY x "y"></svg>'],
    ])('rechaza contenido peligroso: %s', (_n, v) => {
      expect(isSafeHeroSvg(v)).toBe(false);
    });

    it('rechaza un SVG por encima del tope de tamaño', () => {
      const big = `<svg>${'<circle r="1"/>'.repeat(HERO_SVG_MAX_LENGTH)}</svg>`;
      expect(isSafeHeroSvg(big)).toBe(false);
    });
  });

  describe('paintHeroSvg', () => {
    it('sustituye currentColor por el color de tinta del hero', () => {
      expect(paintHeroSvg(ok, '#111111')).toContain('fill="#111111"');
      expect(paintHeroSvg(ok, '#111111')).not.toMatch(/currentColor/i);
    });
    it('sin currentColor deja el SVG igual', () => {
      const plain = '<svg><circle fill="#f00"/></svg>';
      expect(paintHeroSvg(plain, '#000')).toBe(plain);
    });
  });
});
