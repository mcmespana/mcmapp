// Segmentación de un texto de lectura en frases "subrayables".
//
// El subrayado funciona a nivel de frase (no de carácter): la selección nativa
// de iOS/Android sigue disponible con pulsación larga (copiar, buscar, IA),
// mientras que un toque en modo subrayar marca la frase completa. Segmentar por
// frase da un resultado limpio y estable para guardar y restaurar.

// Divide respetando saltos de línea y puntuación final. Mantiene el signo de
// puntuación pegado a su frase. Evita cortes en abreviaturas comunes.
const SENTENCE_SPLIT = /(?<=[.!?…»])\s+(?=[«"¿¡A-ZÁÉÍÓÚÑ0-9])/u;

export interface ReadingToken {
  /** Texto de la frase (recortado). */
  text: string;
  /** True si tras esta frase había un salto de línea/párrafo en el original. */
  breakAfter: boolean;
}

/** Trocea un texto en frases conservando la información de salto de párrafo,
 *  para poder renderizar respetando la estructura original. */
export function tokenizeReading(text: string): ReadingToken[] {
  if (!text) return [];
  const tokens: ReadingToken[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim());
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    const parts = line
      .split(SENTENCE_SPLIT)
      .map((p) => p.trim())
      .filter(Boolean);
    for (let pi = 0; pi < parts.length; pi++) {
      const isLastOfLine = pi === parts.length - 1;
      const moreLines = lines.slice(li + 1).some(Boolean);
      tokens.push({
        text: parts[pi],
        breakAfter: isLastOfLine && moreLines,
      });
    }
  }
  return tokens;
}

/** Trocea un texto en frases. Devuelve los segmentos con su texto ya recortado
 *  (sin espacios sobrantes) preservando el orden. Los segmentos vacíos se
 *  descartan. */
export function segmentReading(text: string): string[] {
  return tokenizeReading(text).map((t) => t.text);
}

/** Normaliza un fragmento para compararlo de forma robusta (por si cambia el
 *  espaciado entre guardado y render). */
export function normalizeSegment(seg: string): string {
  return seg.replace(/\s+/g, ' ').trim();
}
