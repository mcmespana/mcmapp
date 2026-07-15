import {
  segmentReading,
  tokenizeReading,
  normalizeSegment,
} from '@/utils/readingSegments';

describe('segmentReading', () => {
  it('divide un texto en frases', () => {
    const segs = segmentReading(
      'Yo soy la luz del mundo. El que me sigue no caminará en tinieblas.',
    );
    expect(segs).toEqual([
      'Yo soy la luz del mundo.',
      'El que me sigue no caminará en tinieblas.',
    ]);
  });

  it('respeta los saltos de línea como límites de frase', () => {
    const segs = segmentReading('Primera línea.\nSegunda línea sin punto');
    expect(segs).toEqual(['Primera línea.', 'Segunda línea sin punto']);
  });

  it('mantiene los signos de exclamación/interrogación pegados', () => {
    const segs = segmentReading('¿Quién eres tú? ¡Soy yo!');
    expect(segs).toEqual(['¿Quién eres tú?', '¡Soy yo!']);
  });

  it('devuelve vacío para texto vacío', () => {
    expect(segmentReading('')).toEqual([]);
    expect(segmentReading('   \n  ')).toEqual([]);
  });
});

describe('tokenizeReading', () => {
  it('marca breakAfter en la última frase de cada línea salvo la última', () => {
    const tokens = tokenizeReading('Uno. Dos.\nTres.');
    expect(tokens.map((t) => t.text)).toEqual(['Uno.', 'Dos.', 'Tres.']);
    expect(tokens.map((t) => t.breakAfter)).toEqual([false, true, false]);
  });

  it('es coherente con segmentReading', () => {
    const text = 'Frase una. Frase dos.\nFrase tres.';
    expect(tokenizeReading(text).map((t) => t.text)).toEqual(
      segmentReading(text),
    );
  });
});

describe('normalizeSegment', () => {
  it('colapsa espacios y recorta', () => {
    expect(normalizeSegment('  hola   mundo \n ')).toBe('hola mundo');
  });
});
