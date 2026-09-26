import {
  addHighlight,
  computeSpans,
  highlightBg,
  HIGHLIGHT_COLORS,
  normalizeHighlights,
  removeHighlight,
  selectionHighlight,
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

describe('selectionHighlight', () => {
  // "En el principio existía la Palabra…" — se subraya "principio" (6..15).
  const ranges: HighlightRange[] = [
    { start: 6, end: 15, color: 'sun', text: TEXT.slice(6, 15) },
  ];

  it('devuelve null si la selección no toca ningún subrayado', () => {
    expect(selectionHighlight(ranges, 20, 30)).toBeNull();
  });

  it('devuelve null sin rangos o con selección vacía', () => {
    expect(selectionHighlight([], 0, 10)).toBeNull();
    expect(selectionHighlight(ranges, 8, 8)).toBeNull();
    expect(selectionHighlight(ranges, 10, 6)).toBeNull();
  });

  it('reconoce una selección enteramente subrayada', () => {
    expect(selectionHighlight(ranges, 6, 15)).toEqual({
      color: 'sun',
      full: true,
    });
  });

  it('reconoce una selección DENTRO de un subrayado', () => {
    expect(selectionHighlight(ranges, 8, 12)).toEqual({
      color: 'sun',
      full: true,
    });
  });

  it('marca full=false cuando la selección se sale del subrayado', () => {
    // 0..15 incluye "En el " sin subrayar más "principio" subrayado.
    expect(selectionHighlight(ranges, 0, 15)).toEqual({
      color: 'sun',
      full: false,
    });
  });

  it('con varios colores gana el que cubre más caracteres', () => {
    const mixed: HighlightRange[] = [
      { start: 0, end: 3, color: 'sun', text: TEXT.slice(0, 3) },
      { start: 3, end: 15, color: 'mint', text: TEXT.slice(3, 15) },
    ];
    expect(selectionHighlight(mixed, 0, 15)).toEqual({
      color: 'mint',
      full: true,
    });
  });

  it('el color que gana no depende del orden de los rangos', () => {
    const mixed: HighlightRange[] = [
      { start: 3, end: 15, color: 'mint', text: TEXT.slice(3, 15) },
      { start: 0, end: 3, color: 'sun', text: TEXT.slice(0, 3) },
    ];
    expect(selectionHighlight(mixed, 0, 15)?.color).toBe('mint');
  });
});

describe('datos guardados de versiones anteriores o corruptos', () => {
  it('un color que ya no existe en la paleta pinta el de por defecto (no fondo undefined)', () => {
    const bg = highlightBg('naranja' as HighlightRange['color'], false);
    expect(bg).toBe(HIGHLIGHT_COLORS.sun.light);
    expect(highlightBg('naranja' as HighlightRange['color'], true)).toBe(
      HIGHLIGHT_COLORS.sun.dark,
    );
  });

  it('un rango guardado sin color se trata como el color por defecto', () => {
    const [h] = normalizeHighlights(TEXT, [
      { start: 0, end: 2 } as unknown as HighlightRange,
    ]);
    expect(h.color).toBe('sun');
  });

  it('si la lectura se acortó, el rango se recorta al texto y el que queda fuera se descarta', () => {
    const out = normalizeHighlights(TEXT, [
      r(TEXT.length - 4, TEXT.length + 20),
      { start: TEXT.length + 5, end: TEXT.length + 9, color: 'sky', text: '' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].end).toBe(TEXT.length);
    expect(out[0].text).toBe(TEXT.slice(-4));
  });

  it('entradas basura (null, números en texto, rango invertido) se ignoran sin romper la lectura', () => {
    const out = normalizeHighlights(TEXT, [
      null,
      { start: '1', end: '5', color: 'sun' },
      { start: 10, end: 4, color: 'sun' },
      r(0, 2),
    ] as unknown as HighlightRange[]);
    expect(out).toEqual([r(0, 2)]);
  });
});

describe('computeSpans — rangos solapados guardados', () => {
  it('dos rangos que se pisan no duplican texto en pantalla', () => {
    const spans = computeSpans(TEXT, [r(0, 10, 'sun'), r(5, 15, 'sky')]);
    expect(spans.map((s) => s.text).join('')).toBe(TEXT);
    expect(spans.slice(0, 2)).toEqual([
      { text: TEXT.slice(0, 10), color: 'sun' },
      { text: TEXT.slice(10, 15), color: 'sky' },
    ]);
  });

  it('un rango contenido en otro no se repite', () => {
    const spans = computeSpans(TEXT, [r(0, 20, 'sun'), r(5, 8, 'mint')]);
    expect(spans.map((s) => s.text).join('')).toBe(TEXT);
    expect(spans.some((s) => s.color === 'mint')).toBe(false);
  });

  it('ordena por inicio aunque lleguen desordenados', () => {
    const spans = computeSpans(TEXT, [r(20, 25, 'sky'), r(0, 3, 'sun')]);
    expect(spans.map((s) => s.text).join('')).toBe(TEXT);
    expect(spans[0]).toEqual({ text: TEXT.slice(0, 3), color: 'sun' });
  });
});

describe('addHighlight — solapes del mismo color', () => {
  it('pintar sobre un subrayado del mismo color lo amplía en uno solo (sin trozos)', () => {
    const out = addHighlight(TEXT, [r(0, 10)], 5, 20, 'sun');
    expect(out).toEqual([r(0, 20)]);
  });

  it('pintar dentro de otro color lo parte en tres, con el nuevo en medio', () => {
    const out = addHighlight(TEXT, [r(0, 30, 'sky')], 10, 20, 'rose');
    expect(out.map((x) => [x.start, x.end, x.color])).toEqual([
      [0, 10, 'sky'],
      [10, 20, 'rose'],
      [20, 30, 'sky'],
    ]);
  });
});
