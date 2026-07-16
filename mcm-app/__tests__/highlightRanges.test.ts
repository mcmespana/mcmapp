import {
  addHighlight,
  computeSpans,
  normalizeHighlights,
  removeHighlight,
  type HighlightRange,
} from '@/utils/highlightRanges';
import { normalizeReadingText } from '@/utils/readingSegments';

const TEXT =
  'En el principio existía la Palabra y la Palabra estaba junto a Dios.';

const r = (
  start: number,
  end: number,
  color: HighlightRange['color'] = 'sun',
): HighlightRange => ({ start, end, color, text: TEXT.slice(start, end) });

describe('addHighlight', () => {
  it('añade un rango con su texto', () => {
    const out = addHighlight(TEXT, [], 0, 15, 'mint');
    expect(out).toEqual([
      { start: 0, end: 15, color: 'mint', text: 'En el principio' },
    ]);
  });

  it('pinta por encima de un rango solapado de otro color', () => {
    const out = addHighlight(TEXT, [r(0, 20, 'sun')], 10, 30, 'rose');
    expect(out).toEqual([
      expect.objectContaining({ start: 0, end: 10, color: 'sun' }),
      expect.objectContaining({ start: 10, end: 30, color: 'rose' }),
    ]);
  });

  it('funde rangos contiguos del mismo color', () => {
    const out = addHighlight(TEXT, [r(0, 10, 'sun')], 10, 20, 'sun');
    expect(out).toEqual([expect.objectContaining({ start: 0, end: 20 })]);
  });

  it('ignora selecciones vacías o fuera de rango', () => {
    expect(addHighlight(TEXT, [], 5, 5, 'sun')).toEqual([]);
    const clamped = addHighlight(
      TEXT,
      [],
      TEXT.length - 3,
      TEXT.length + 50,
      'sun',
    );
    expect(clamped[0].end).toBe(TEXT.length);
  });
});

describe('removeHighlight', () => {
  it('borra el tramo central partiendo el rango en dos', () => {
    const out = removeHighlight(TEXT, [r(0, 30)], 10, 20);
    expect(out).toEqual([
      expect.objectContaining({ start: 0, end: 10 }),
      expect.objectContaining({ start: 20, end: 30 }),
    ]);
  });

  it('elimina rangos totalmente cubiertos', () => {
    expect(removeHighlight(TEXT, [r(5, 10)], 0, 20)).toEqual([]);
  });

  it('no toca rangos sin solape', () => {
    const out = removeHighlight(TEXT, [r(0, 5)], 10, 20);
    expect(out).toEqual([r(0, 5)]);
  });
});

describe('normalizeHighlights', () => {
  it('convierte frases legacy (string) en rangos localizándolas', () => {
    const out = normalizeHighlights(TEXT, ['la Palabra']);
    expect(out).toEqual([
      expect.objectContaining({
        start: TEXT.indexOf('la Palabra'),
        color: 'sun',
      }),
    ]);
  });

  it('descarta frases legacy que ya no están en el texto', () => {
    expect(normalizeHighlights(TEXT, ['no existe esto'])).toEqual([]);
  });

  it('acepta rangos válidos, recalcula text y ordena', () => {
    const out = normalizeHighlights(TEXT, [
      { start: 20, end: 30, color: 'sky', text: 'x' },
      { start: 0, end: 5, color: 'rose', text: 'y' },
    ]);
    expect(out.map((x) => x.start)).toEqual([0, 20]);
    expect(out[0].text).toBe(TEXT.slice(0, 5));
  });

  it('devuelve vacío sin datos', () => {
    expect(normalizeHighlights(TEXT, undefined)).toEqual([]);
    expect(normalizeHighlights(TEXT, [])).toEqual([]);
  });
});

describe('computeSpans', () => {
  it('trocea el texto en spans con y sin color', () => {
    const spans = computeSpans(TEXT, [r(3, 5, 'mint')]);
    expect(spans).toEqual([
      { text: TEXT.slice(0, 3), color: null },
      { text: TEXT.slice(3, 5), color: 'mint' },
      { text: TEXT.slice(5), color: null },
    ]);
    expect(spans.map((s) => s.text).join('')).toBe(TEXT);
  });

  it('sin rangos devuelve el texto entero', () => {
    expect(computeSpans(TEXT, [])).toEqual([{ text: TEXT, color: null }]);
  });
});

describe('normalizeReadingText', () => {
  it('es estable (aplicarla dos veces no cambia nada)', () => {
    const once = normalizeReadingText('Hola mundo. Adiós.\n\nOtra  línea.');
    expect(normalizeReadingText(once)).toBe(once);
  });

  it('conserva los saltos de párrafo', () => {
    expect(normalizeReadingText('Uno.\nDos.')).toBe('Uno.\nDos.');
  });
});
