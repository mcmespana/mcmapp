/**
 * Tests de los helpers puros de Grupos, extraídos de GruposScreen a
 * components/grupos/gruposHelpers.ts.
 */
import { normalize, isMe } from '@/components/grupos/gruposHelpers';

describe('normalize', () => {
  it('pasa a minúsculas', () => {
    expect(normalize('HOLA')).toBe('hola');
  });

  it('quita acentos y diacríticos', () => {
    expect(normalize('Álvaro')).toBe('alvaro');
    expect(normalize('Begoña')).toBe('begona');
    expect(normalize('José Ramón')).toBe('jose ramon');
  });

  it('es idempotente sobre texto ya normalizado', () => {
    expect(normalize(normalize('Münster'))).toBe(normalize('Münster'));
  });
});

describe('isMe', () => {
  it('coincide ignorando mayúsculas y acentos', () => {
    expect(isMe('José Ramón', 'jose ramon')).toBe(true);
    expect(isMe('ÁLVARO', 'alvaro')).toBe(true);
  });

  it('coincide por subcadena (nombre dentro del texto)', () => {
    expect(isMe('Izan Rivera Gómez', 'Izan Rivera')).toBe(true);
  });

  it('no coincide cuando son distintos', () => {
    expect(isMe('Marta', 'Pedro')).toBe(false);
  });

  it('devuelve false con entradas vacías o nulas', () => {
    expect(isMe('', 'pedro')).toBe(false);
    expect(isMe('Pedro', '')).toBe(false);
    expect(isMe(null, 'pedro')).toBe(false);
    expect(isMe(undefined, 'pedro')).toBe(false);
  });
});
