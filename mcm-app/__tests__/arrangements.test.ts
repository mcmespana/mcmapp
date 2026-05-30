/**
 * Tests para la lógica de arreglos `{arr:}` del cantoral.
 *
 * ¿Qué testea?
 * - `renderableRowLineIndices`: qué líneas del ChordPro producen una fila
 *   renderizada (letra/acordes y comentarios sí; directivas estructurales no).
 * - `injectRowLineIndices`: que se etiquete cada `<div class="row">` con el
 *   índice de su línea original, y que NO toque el HTML si los conteos no
 *   coinciden (guarda de seguridad).
 * - `insertArrangementAtLine`: inserción de `{arr:}` encima de una línea.
 * - `postProcessArrangementsHtml`: prefijo "| " sin duplicar.
 */
import {
  renderableRowLineIndices,
  injectRowLineIndices,
  insertArrangementAtLine,
  postProcessArrangementsHtml,
  hasArrangements,
} from '@/utils/arrangements';

describe('renderableRowLineIndices', () => {
  it('cuenta letra/acordes y comentarios, ignora estructura y vacíos', () => {
    const cho = [
      '{title: T}', // 0 - no
      '{key: G}', // 1 - no
      '', // 2 - no
      '{soc}', // 3 - no
      '[G]linea uno', // 4 - sí
      '[D]linea dos', // 5 - sí
      '{eoc}', // 6 - no
      '', // 7 - no
      '{comment: nota}', // 8 - sí
      '{arr: arreglo}', // 9 - sí
      '[C]estrofa', // 10 - sí
    ].join('\n');
    expect(renderableRowLineIndices(cho)).toEqual([4, 5, 8, 9, 10]);
  });

  it('trata {c:} como fila pero {ci:} no', () => {
    const cho = '{c: seccion}\n{ci: italica}\n[G]letra';
    expect(renderableRowLineIndices(cho)).toEqual([0, 2]);
  });
});

describe('injectRowLineIndices', () => {
  it('etiqueta cada fila con el índice de su línea original', () => {
    const cho = '{soc}\n[G]uno\n[D]dos\n{eoc}';
    const html =
      '<div class="row"><div class="lyrics">uno</div></div>' +
      '<div class="row"><div class="lyrics">dos</div></div>';
    const out = injectRowLineIndices(html, cho);
    expect(out).toContain('<div class="row" data-line="1">');
    expect(out).toContain('<div class="row" data-line="2">');
  });

  it('no toca el HTML si los conteos no coinciden', () => {
    const cho = '[G]uno\n[D]dos';
    const html = '<div class="row">solo una</div>'; // 1 fila vs 2 líneas
    expect(injectRowLineIndices(html, cho)).toBe(html);
  });
});

describe('insertArrangementAtLine', () => {
  it('inserta {arr:} encima de la línea indicada', () => {
    const cho = '[G]uno\n[D]dos';
    expect(insertArrangementAtLine(cho, 1, 'mi arreglo')).toBe(
      '[G]uno\n{arr: mi arreglo}\n[D]dos',
    );
  });

  it('inserta al principio con índice 0', () => {
    const cho = '[G]uno';
    expect(insertArrangementAtLine(cho, 0, 'intro')).toBe(
      '{arr: intro}\n[G]uno',
    );
  });

  it('inserta al final si el índice se pasa de rango', () => {
    const cho = '[G]uno';
    expect(insertArrangementAtLine(cho, 99, 'coda')).toBe(
      '[G]uno\n{arr: coda}',
    );
  });

  it('ignora texto vacío', () => {
    const cho = '[G]uno';
    expect(insertArrangementAtLine(cho, 0, '   ')).toBe(cho);
  });
});

describe('postProcessArrangementsHtml', () => {
  it('reetiqueta comentarios-centinela y antepone "| "', () => {
    const html = '<div class="comment">@@ARR@@Intro guitarra</div>';
    expect(postProcessArrangementsHtml(html)).toBe(
      '<div class="arrangement">| Intro guitarra</div>',
    );
  });

  it('no duplica el prefijo si ya empieza por |', () => {
    const html = '<div class="comment">@@ARR@@| ya tiene barra</div>';
    expect(postProcessArrangementsHtml(html)).toBe(
      '<div class="arrangement">| ya tiene barra</div>',
    );
  });
});

describe('hasArrangements', () => {
  it('detecta la presencia de {arr:}', () => {
    expect(hasArrangements('[G]hola\n{arr: x}')).toBe(true);
    expect(hasArrangements('[G]hola')).toBe(false);
    expect(hasArrangements(null)).toBe(false);
  });
});
