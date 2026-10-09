/**
 * El algoritmo de cortes de línea de la hoja de canción. Corre dentro del
 * WebView como string (Hermes no guarda el fuente de las funciones), así que
 * se evalúa aquí tal cual, sin DOM: solo `penalty` y `chooseBreaks`.
 */
import { SHEET_LAYOUT_JS } from '@/utils/songSheetLayout';

interface Layout {
  penalty: (prev: string, next: string, nextHasChord: boolean) => number;
  chooseBreaks: (
    w: number[],
    pen: number[],
    first: number,
    rest: number,
    ov?: number[],
  ) => number[];
}

function load(): Layout {
  const win: { __SONG_LAYOUT__?: Layout } = {};
  // `document` indefinido: el script registra la API y no toca el DOM.
  new Function('window', 'document', SHEET_LAYOUT_JS)(win, undefined);
  return win.__SONG_LAYOUT__!;
}

const L = load();

/** Palabras de ancho = nº de letras (incluido el espacio final). */
function breaksFor(sentence: string, width: number, indent = 0) {
  const words = sentence.match(/\S+\s*/g)!;
  const w = words.map((x) => x.length);
  const pen = words
    .slice(0, -1)
    .map((x, i) => L.penalty(x, words[i + 1], false));
  const br = L.chooseBreaks(w, pen, width, width - indent);
  const rows: string[] = [];
  let start = 0;
  for (const b of [...br, words.length]) {
    rows.push(words.slice(start, b).join('').trim());
    start = b;
  }
  return rows;
}

describe('penalty — dónde se puede partir', () => {
  it('tras un punto es lo mejor, tras una coma casi', () => {
    expect(L.penalty('aquí. ', 'Aquí', false)).toBeLessThan(
      L.penalty('aquí, ', 'ahora', false),
    );
    expect(L.penalty('aquí, ', 'ahora', false)).toBeLessThan(
      L.penalty('felicidad ', 'ligada', false),
    );
  });

  it('antes de «y» o «que» es buen sitio', () => {
    expect(L.penalty('cielo ', 'y', false)).toBeLessThan(
      L.penalty('cielo ', 'de', false),
    );
  });

  it('nunca detrás de un artículo o una preposición', () => {
    expect(L.penalty('la ', 'felicidad', false)).toBeGreaterThan(
      L.penalty('felicidad ', 'ligada', false),
    );
    expect(L.penalty('de ', 'nación', false)).toBeGreaterThan(
      L.penalty('nación ', 'Piedra', false),
    );
  });

  it('partir justo antes de un acorde suma un poco', () => {
    expect(L.penalty('cielo ', 'ligada', true)).toBeLessThan(
      L.penalty('cielo ', 'ligada', false),
    );
  });
});

describe('chooseBreaks — cortes óptimos', () => {
  it('si cabe, no parte', () => {
    expect(breaksFor('Seas quien seas', 40)).toEqual(['Seas quien seas']);
  });

  it('parte por la coma aunque quede menos equilibrado', () => {
    // «Miembro de un pueblo, / tengo familia.» y no «Miembro de / un pueblo…»
    expect(breaksFor('Miembro de un pueblo, tengo familia.', 26)).toEqual([
      'Miembro de un pueblo,',
      'tengo familia.',
    ]);
  });

  it('usa el menor número de renglones posible', () => {
    const rows = breaksFor(
      'Esta paz que hoy nos das, viva siempre estará, en la tierra como en el cielo.',
      30,
    );
    expect(rows).toEqual([
      'Esta paz que hoy nos das,',
      'viva siempre estará,',
      'en la tierra como en el cielo.',
    ]);
  });

  it('no deja un artículo colgando al final del renglón', () => {
    const rows = breaksFor('Siempre imaginé la felicidad ligada al poder', 24);
    for (const r of rows.slice(0, -1)) {
      expect(r).not.toMatch(/\b(la|al|de|el)$/);
    }
  });

  it('los renglones de continuación respetan la sangría', () => {
    const rows = breaksFor('uno dos tres cuatro cinco seis siete ocho', 20, 4);
    for (const r of rows.slice(1)) expect(r.length + 4).toBeLessThanOrEqual(20);
  });

  it('una palabra más ancha que la línea va sola, sin bucles', () => {
    expect(L.chooseBreaks([50, 5, 5], [8, 8], 20, 20)).toEqual([1]);
  });

  it('cuenta lo que sobresale un acorde al final del renglón', () => {
    // Sin sobresaliente, cabe entero; con 6 de acorde al final, no.
    expect(L.chooseBreaks([8, 8], [8], 16, 16)).toEqual([]);
    expect(L.chooseBreaks([8, 8], [8], 16, 16, [0, 6])).toEqual([1]);
  });
});
