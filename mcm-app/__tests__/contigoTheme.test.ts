/**
 * Paleta cálida de Contigo: lo que pinta TEXTO tiene que leerse.
 *
 * `textMuted` es decorativo (placeholders, iconos inactivos) y se queda por
 * debajo de 3:1 a propósito; el texto pequeño —etiquetas, leyendas, fechas—
 * usa `textSec`. Este test fija las dos mitades del contrato: `textSec` llega
 * a 4,5:1 sobre las superficies donde se pinta, y `textMuted` NO se puede
 * subir sin perder el escalón (si algún día llega a 4,5 este test avisará de
 * que ya no hace falta distinguirlos).
 */
import { contrastRatio } from '@/utils/colorUtils';
import { WARM_DARK, WARM_LIGHT, warm } from '@/components/contigo/theme';

describe('paleta cálida de Contigo', () => {
  const surfaces = [
    ['claro · bg', WARM_LIGHT.textSec, WARM_LIGHT.bg],
    ['claro · bgCard', WARM_LIGHT.textSec, WARM_LIGHT.bgCard],
    ['claro · bgDeep', WARM_LIGHT.textSec, WARM_LIGHT.bgDeep],
    ['oscuro · bg', WARM_DARK.textSec, WARM_DARK.bg],
    ['oscuro · bgCard', WARM_DARK.textSec, WARM_DARK.bgCard],
  ] as const;

  it.each(surfaces)('textSec se lee en %s (4,5:1)', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('textMuted sigue siendo decorativo: no llega a 4,5:1 en claro', () => {
    expect(contrastRatio(WARM_LIGHT.textMuted, WARM_LIGHT.bg)).toBeLessThan(
      4.5,
    );
  });

  it('el degradado de fondo nace del propio fondo del tema', () => {
    // El examen había derivado a `#FBF7F1` de inicio; con esto no puede.
    expect(warm(false).bgGradient[0]).toBe(WARM_LIGHT.bg);
    expect(warm(true).bgGradient[0]).toBe(WARM_DARK.bg);
    expect(warm(true).bgGradient[1]).toBe(WARM_DARK.bgDeep);
  });
});
