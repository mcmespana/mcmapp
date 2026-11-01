/**
 * Las frases del «un momentín» (`constants/updatePhrases.ts`). Son texto libre,
 * así que el test no juzga el humor: vigila lo que se rompe sin que nadie lo
 * note (duplicadas, vacías, enormes, gritonas) y que la mezcla no pierda ni
 * invente frases.
 */
import { UPDATE_PHRASES, shufflePhrases } from '@/constants/updatePhrases';

describe('UPDATE_PHRASES', () => {
  it('hay entre 100 y 200', () => {
    expect(UPDATE_PHRASES.length).toBeGreaterThanOrEqual(100);
    expect(UPDATE_PHRASES.length).toBeLessThanOrEqual(200);
  });

  it('no hay repetidas (ni por mayúsculas)', () => {
    const lower = UPDATE_PHRASES.map((p) => p.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('ninguna está vacía, con espacios sobrantes ni pasa de 80 caracteres', () => {
    for (const p of UPDATE_PHRASES) {
      expect(p.trim()).toBe(p);
      expect(p.length).toBeGreaterThan(5);
      expect(p.length).toBeLessThanOrEqual(80);
    }
  });

  it('sin exclamaciones: el aviso ya es amable por sí solo', () => {
    expect(UPDATE_PHRASES.filter((p) => /[!¡]/.test(p))).toEqual([]);
  });

  it('conserva las frases de casa que pidió el equipo', () => {
    const all = UPDATE_PHRASES.join('\n');
    for (const frag of [
      'pañuelo amarillo',
      'COM de incorporación a crecimiento',
      'libros de vida',
      'de MIC a COM',
      'nuevo LC',
      'autobús del campamento',
      'fiesta inicial',
      'STOP',
    ]) {
      expect(all).toContain(frag);
    }
  });
});

describe('shufflePhrases', () => {
  it('devuelve las mismas frases, sin perder ni repetir ninguna', () => {
    const out = shufflePhrases();
    expect([...out].sort()).toEqual([...UPDATE_PHRASES].sort());
  });

  it('no toca el original', () => {
    const before = [...UPDATE_PHRASES];
    shufflePhrases();
    expect([...UPDATE_PHRASES]).toEqual(before);
  });

  it('es determinista con el mismo azar y cambia el orden con otro', () => {
    const seq = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
    };
    expect(shufflePhrases(UPDATE_PHRASES, seq(7))).toEqual(
      shufflePhrases(UPDATE_PHRASES, seq(7)),
    );
    expect(shufflePhrases(UPDATE_PHRASES, seq(7))).not.toEqual(
      shufflePhrases(UPDATE_PHRASES, seq(11)),
    );
  });
});
