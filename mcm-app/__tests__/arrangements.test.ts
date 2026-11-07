/**
 * Tests para la lógica de arreglos `{arr:}` del cantoral.
 *
 * ¿Qué testea?
 * - El número de línea de cada fila (modo admin) ya no se deduce contando
 *   filas: lo pone la hoja (`utils/songSheet.ts`) con el número que da el
 *   parser. Su test está en `songSheet.test.ts`.
 * - `insertArrangementAtLine`: inserción de `{arr:}` encima de una línea.
 * - `postProcessArrangementsHtml`: prefijo "| " sin duplicar.
 */
import {
  insertArrangementAtLine,
  postProcessArrangementsHtml,
  hasArrangements,
} from '@/utils/arrangements';

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
