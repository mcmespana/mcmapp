/**
 * `capitalizeFirst` — mayúscula solo en la inicial.
 *
 * Existe porque `textTransform: 'capitalize'` de RN capitaliza CADA palabra, y
 * en español eso escribe «Jueves, 10 De Septiembre De 2026 A Las 14:32». Se
 * veía en el detalle de una notificación, en Evangelio, en Oración y en
 * Visitas.
 */
import { capitalizeFirst } from '@/utils/textCase';

describe('capitalizeFirst', () => {
  it('pone mayúscula en la primera letra y deja el resto', () => {
    expect(capitalizeFirst('jueves, 10 de septiembre de 2026')).toBe(
      'Jueves, 10 de septiembre de 2026',
    );
  });

  it('no toca un texto que ya empieza en mayúscula', () => {
    expect(capitalizeFirst('Jueves 10 septiembre')).toBe(
      'Jueves 10 septiembre',
    );
  });

  it('respeta los acentos', () => {
    expect(capitalizeFirst('miércoles 3 de abril')).toBe(
      'Miércoles 3 de abril',
    );
  });

  it('no revienta con cadena vacía', () => {
    expect(capitalizeFirst('')).toBe('');
  });

  it('funciona con una sola letra', () => {
    expect(capitalizeFirst('a')).toBe('A');
  });

  it('deja en paz lo que empieza por número', () => {
    expect(capitalizeFirst('10 de septiembre')).toBe('10 de septiembre');
  });
});
