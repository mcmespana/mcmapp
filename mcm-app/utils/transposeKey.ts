/**
 * Calcula el tono resultante tras aplicar `semitones` a la nota original.
 *
 * Usa ChordSheetJS internamente para evitar duplicar la tabla cromática
 * (y para que coincida exactamente con la transposición real que aplica
 * `useSongProcessor`).
 */
import { ChordProParser, ChordLyricsPair } from 'chordsheetjs';

const cache = new Map<string, string>();

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
    const tmp = new ChordProParser().parse(`{key: ${k}}\n[${k}]`);
    const transposed = tmp.transpose(semitones);
    if (transposed.lines.length > 0 && transposed.lines[0].items.length > 0) {
      const item = transposed.lines[0].items[0];
      if (item instanceof ChordLyricsPair && item.chords) {
        const out = item.chords.toUpperCase();
        cache.set(cacheKey, out);
        return out;
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
