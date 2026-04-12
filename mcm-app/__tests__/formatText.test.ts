/**
 * Tests para la conversión de BBCode a HTML.
 *
 * ¿Qué testea?
 * - Que cada tag BBCode se convierta correctamente a HTML
 * - Que los tags anidados funcionen
 * - Que las listas se generen bien
 * - Que el texto sin tags pase tal cual
 */
import { formatBBCodeToHtml } from '@/utils/formatText';

describe('formatBBCodeToHtml', () => {
  it('convierte [br] a <br/>', () => {
    expect(formatBBCodeToHtml('linea1[br]linea2')).toBe('linea1<br/>linea2');
  });

  it('convierte [b] a <strong>', () => {
    expect(formatBBCodeToHtml('[b]negrita[/b]')).toBe(
      '<strong>negrita</strong>',
    );
  });

  it('convierte [i] a <em>', () => {
    expect(formatBBCodeToHtml('[i]cursiva[/i]')).toBe('<em>cursiva</em>');
  });

  it('convierte [u] a <u>', () => {
    expect(formatBBCodeToHtml('[u]subrayado[/u]')).toBe('<u>subrayado</u>');
  });

  it('convierte [h1] a <h2>', () => {
    expect(formatBBCodeToHtml('[h1]Título[/h1]')).toBe('<h2>Título</h2>');
  });

  it('convierte [url] a <a>', () => {
    expect(formatBBCodeToHtml('[url=https://ejemplo.com]Link[/url]')).toBe(
      '<a href="https://ejemplo.com">Link</a>',
    );
  });

  it('convierte [btn-primary] a enlace con clase', () => {
    expect(
      formatBBCodeToHtml(
        '[btn-primary=https://ejemplo.com]Botón[/btn-primary]',
      ),
    ).toBe('<a href="https://ejemplo.com" class="btn-primary">Botón</a>');
  });

  it('convierte [btn-secondary] a enlace con clase', () => {
    expect(
      formatBBCodeToHtml(
        '[btn-secondary=https://ejemplo.com]Otro[/btn-secondary]',
      ),
    ).toBe('<a href="https://ejemplo.com" class="btn-secondary">Otro</a>');
  });

  it('convierte [color] a span con clase', () => {
    expect(formatBBCodeToHtml('[color=primary]texto[/color]')).toBe(
      '<span class="color-primary">texto</span>',
    );
  });

  it('convierte [quote] a blockquote', () => {
    expect(formatBBCodeToHtml('[quote]cita[/quote]')).toBe(
      '<blockquote class="quote">cita</blockquote>',
    );
  });

  it('convierte [gquote] a blockquote del evangelio', () => {
    expect(formatBBCodeToHtml('[gquote]evangelio[/gquote]')).toBe(
      '<blockquote class="gquote">evangelio</blockquote>',
    );
  });

  it('convierte [list] con items a <ul><li>', () => {
    const result = formatBBCodeToHtml('[list][*]uno[*]dos[/list]');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>uno</li>');
    expect(result).toContain('<li>dos</li>');
    expect(result).toContain('</ul>');
  });

  it('maneja tags anidados correctamente', () => {
    const result = formatBBCodeToHtml('[b][i]negrita y cursiva[/i][/b]');
    expect(result).toBe('<strong><em>negrita y cursiva</em></strong>');
  });

  it('devuelve texto sin tags tal cual', () => {
    expect(formatBBCodeToHtml('texto plano')).toBe('texto plano');
  });
});
