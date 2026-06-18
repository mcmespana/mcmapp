/**
 * Calcula el tono resultante tras aplicar `semitones` a la nota original.
 *
 * Usa ChordSheetJS internamente para evitar duplicar la tabla cromática
 * (y para que coincida exactamente con la transposición real que aplica
 * `useSongProcessor`).
 */
import { ChordProParser, ChordLyricsPair } from 'chordsheetjs';

const cache = new Map<string, string>();

/**
 * Recupera una clave parseable por ChordSheetJS a partir de la forma en
 * MAYÚSCULAS con la que llega (quien llama hace `song.key.toUpperCase()`, lo
 * que convierte "Am" → "AM" y "Bb" → "BB", formas que ChordSheetJS NO entiende
 * y que provocaban que la transposición devolviera el tono original).
 *
 *  - Tras la nota raíz, una "B" solo puede ser bemol → la pasamos a "b".
 *  - Una "M" representa el modo menor → la pasamos a "m".
 */
function normalizeKeyForParse(upperKey: string): string {
  if (!upperKey) return upperKey;
  const root = upperKey[0];
  const rest = upperKey
    .slice(1)
    .replace(/^B/, 'b') // bemol
    .replace(/M/g, 'm'); // menor
  return root + rest;
}

export function transposeKey(
  originalKey: string | undefined | null,
  semitones: number,
): string {
  if (!originalKey) return '';
  const k = originalKey.toUpperCase();
  if (!semitones) return k;

  const cacheKey = `${k}|${semitones}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  try {
    // El `{key:}` ayuda a ChordSheetJS a elegir el enarmónico correcto
    // (sostenidos vs bemoles) acorde a la tonalidad. El acorde `[${k}]` queda
    // en una línea aparte de la directiva, así que recorremos TODAS las líneas
    // e items buscando el primer acorde (antes se miraba solo `lines[0]`, que
    // es la línea de la directiva `{key:}` y nunca contenía el acorde → la
    // función devolvía el tono original sin transponer).
    const parseKey = normalizeKeyForParse(k);
    const tmp = new ChordProParser().parse(`{key: ${parseKey}}\n[${parseKey}]`);
    const transposed = tmp.transpose(semitones);
    for (const line of transposed.lines) {
      for (const item of line.items) {
        if (item instanceof ChordLyricsPair && item.chords) {
          const out = item.chords.toUpperCase();
          cache.set(cacheKey, out);
          return out;
        }
      }
    }
  } catch (e) {
    console.warn('transposeKey error', e);
  }
  return k;
}

/** Etiqueta humana corta del transporte: "+2", "-3", "" si 0. */
export function transposeLabel(semitones: number): string {
  if (!semitones) return '';
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}
