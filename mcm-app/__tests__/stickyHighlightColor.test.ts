import {
  pickStickyHighlightColor,
  resetStickyHighlightColor,
} from '@/utils/stickyHighlightColor';
import { HIGHLIGHT_COLOR_KEYS } from '@/utils/highlightRanges';

describe('pickStickyHighlightColor', () => {
  beforeEach(() => resetStickyHighlightColor());

  it('devuelve un color de la paleta', () => {
    expect(HIGHLIGHT_COLOR_KEYS).toContain(pickStickyHighlightColor(0));
  });

  it('mantiene el mismo color durante los minutos siguientes', () => {
    const first = pickStickyHighlightColor(0);
    expect(pickStickyHighlightColor(60_000)).toBe(first);
    expect(pickStickyHighlightColor(5 * 60_000)).toBe(first);
  });

  it('cambia de color pasado el rato, y no repite el anterior', () => {
    const first = pickStickyHighlightColor(0);
    const next = pickStickyHighlightColor(60 * 60_000);
    expect(next).not.toBe(first);
  });

  it('la ventana se cuenta desde que se eligió, no desde el último uso', () => {
    const first = pickStickyHighlightColor(0);
    // Usarlo por el camino no alarga la ventana.
    pickStickyHighlightColor(7 * 60_000);
    expect(pickStickyHighlightColor(9 * 60_000)).not.toBe(first);
  });
});
