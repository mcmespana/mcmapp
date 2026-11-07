/**
 * `readableOn` — el mismo color, movido hasta que se lee.
 *
 * Hermano de `onColor` (ver `onColor.test.ts`): aquel elige entre blanco y
 * negro para un texto SOBRE un relleno de color; este conserva el color y lo
 * mueve para que se pueda leer sobre un fondo. Nació de los chips de categoría
 * de las notificaciones, donde un solo valor se usaba en claro y en oscuro y
 * cinco de seis categorías no llegaban al mínimo en oscuro.
 */
import { readableOn } from '@/utils/colorUtils';

function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = ch.map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Tono aproximado, para comprobar que no se cambia el color por otro. */
function tono(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  let t =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return (t * 60 + 360) % 360;
}

const BLANCO = '#FFFFFF';
const OSCURO = '#2C2C2E';

describe('readableOn', () => {
  it('deja el color como está si ya se lee', () => {
    // #C62828 da 5,62:1 sobre blanco: no hay nada que tocar.
    expect(readableOn('#C62828', BLANCO)).toBe('#C62828');
  });

  it('oscurece lo justo sobre un fondo claro', () => {
    const salida = readableOn('#31AADF', BLANCO);
    expect(salida).not.toBe('#31AADF');
    expect(contraste(salida, BLANCO)).toBeGreaterThanOrEqual(4.5);
    // Y no se pasa: un escalón más claro ya no cumpliría.
    expect(contraste(salida, BLANCO)).toBeLessThan(5.6);
  });

  it('aclara lo justo sobre un fondo oscuro', () => {
    const salida = readableOn('#9D1E74', OSCURO);
    expect(contraste('#9D1E74', OSCURO)).toBeLessThan(2); // el problema real
    expect(contraste(salida, OSCURO)).toBeGreaterThanOrEqual(4.5);
  });

  it('conserva el tono: sigue siendo ese color', () => {
    for (const color of ['#31AADF', '#9D1E74', '#4E8A1F', '#C62828']) {
      for (const fondo of [BLANCO, OSCURO]) {
        const salida = readableOn(color, fondo);
        expect(Math.abs(tono(salida) - tono(color))).toBeLessThan(4);
      }
    }
  });

  it('respeta un objetivo de contraste mayor', () => {
    const salida = readableOn('#31AADF', BLANCO, 7);
    expect(contraste(salida, BLANCO)).toBeGreaterThanOrEqual(7);
  });

  it('con un gris sobre gris también llega, moviendo la luminosidad', () => {
    // Un gris no tiene tono que conservar, así que aquí "el mismo color" es
    // "un gris": sale `#151515`, no un blanco/negro de emergencia. Solo se cae
    // a `onColor` cuando ni el extremo del tono alcanza el objetivo.
    const salida = readableOn('#808080', '#7F7F7F');
    expect(contraste(salida, '#7F7F7F')).toBeGreaterThanOrEqual(4.5);
  });

  it('cuando el objetivo es imposible, devuelve el mejor extremo', () => {
    // 21:1 solo lo da el negro sobre blanco puro; con un fondo a media luz no
    // hay color que llegue, y la respuesta correcta es el extremo que más
    // contraste da, que es lo que hace `onColor`.
    expect(['#1C1C1E', '#FFFFFF']).toContain(
      readableOn('#31AADF', '#7F7F7F', 21),
    );
  });

  it('acepta hex de 3 dígitos', () => {
    expect(
      contraste(readableOn('#0af', BLANCO), BLANCO),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
