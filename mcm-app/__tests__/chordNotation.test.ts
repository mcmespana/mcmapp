/**
 * Tests para la conversión de acordes entre notación inglesa y española.
 *
 * ¿Qué testea?
 * - Que los acordes se conviertan correctamente de EN a ES (C → DO, Am → lam, etc.)
 * - Que no se toquen cuando la notación ya es EN
 * - Que los acordes compuestos (G/B) se conviertan bien
 * - Que los acordes en HTML se conviertan correctamente
 */
import { convertChord, convertHtmlChords } from '@/utils/chordNotation';

describe('convertChord', () => {
  it('no modifica el acorde si la notación es EN', () => {
    expect(convertChord('Am', 'EN')).toBe('Am');
    expect(convertChord('C', 'EN')).toBe('C');
    expect(convertChord('G7', 'EN')).toBe('G7');
  });

  it('convierte acordes mayores básicos a notación española', () => {
    expect(convertChord('C', 'ES')).toBe('DO');
    expect(convertChord('D', 'ES')).toBe('RE');
    expect(convertChord('E', 'ES')).toBe('MI');
    expect(convertChord('F', 'ES')).toBe('FA');
    expect(convertChord('G', 'ES')).toBe('SOL');
    expect(convertChord('A', 'ES')).toBe('LA');
    expect(convertChord('B', 'ES')).toBe('SI');
  });

  it('convierte acordes menores a minúscula en español', () => {
    expect(convertChord('Am', 'ES')).toBe('lam');
    expect(convertChord('Em', 'ES')).toBe('mim');
    expect(convertChord('Dm', 'ES')).toBe('rem');
  });

  it('maneja acordes con sostenidos y bemoles', () => {
    expect(convertChord('F#', 'ES')).toBe('FA#');
    expect(convertChord('Bb', 'ES')).toBe('SIb');
  });

  it('convierte acordes compuestos con barra (G/B)', () => {
    expect(convertChord('G/B', 'ES')).toBe('SOL/SI');
    expect(convertChord('C/E', 'ES')).toBe('DO/MI');
  });
});

describe('convertHtmlChords', () => {
  it('no modifica el HTML si la notación es EN', () => {
    const html = '<div class="chord">Am</div>';
    expect(convertHtmlChords(html, 'EN')).toBe(html);
  });

  it('convierte acordes dentro de divs HTML a español', () => {
    const html = '<div class="chord">C</div>';
    expect(convertHtmlChords(html, 'ES')).toBe('<div class="chord">DO</div>');
  });

  it('convierte múltiples acordes en el mismo HTML', () => {
    const html = '<div class="chord">C</div> texto <div class="chord">G</div>';
    const expected =
      '<div class="chord">DO</div> texto <div class="chord">SOL</div>';
    expect(convertHtmlChords(html, 'ES')).toBe(expected);
  });
});
