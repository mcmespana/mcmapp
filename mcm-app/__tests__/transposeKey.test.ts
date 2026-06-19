import { transposeKey, transposeLabel } from '@/utils/transposeKey';

describe('transposeKey', () => {
  it('transpone tonos mayores devolviendo el tono destino real', () => {
    // Caso reportado: La (A) +5 semitonos => Re (D), no "La".
    expect(transposeKey('A', 5)).toBe('D');
    expect(transposeKey('C', 2)).toBe('D');
    expect(transposeKey('F#', 1)).toBe('G');
  });

  it('mantiene el tono cuando no hay transporte', () => {
    expect(transposeKey('A', 0)).toBe('A');
    expect(transposeKey('G', 0)).toBe('G');
  });

  it('respeta tonos menores aunque lleguen en mayúsculas ("Am" -> "AM")', () => {
    expect(transposeKey('AM', 2)).toBe('BM');
    expect(transposeKey('EM', 3)).toBe('GM');
  });

  it('respeta bemoles aunque lleguen en mayúsculas ("Bb" -> "BB")', () => {
    expect(transposeKey('BB', 2)).toBe('C');
  });

  it('tolera entradas vacías', () => {
    expect(transposeKey('', 5)).toBe('');
    expect(transposeKey(undefined, 5)).toBe('');
    expect(transposeKey(null, 5)).toBe('');
  });
});

describe('transposeLabel', () => {
  it('formatea el transporte con signo', () => {
    expect(transposeLabel(5)).toBe('+5');
    expect(transposeLabel(-3)).toBe('-3');
    expect(transposeLabel(0)).toBe('');
  });
});
