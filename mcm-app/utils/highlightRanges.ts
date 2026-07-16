// Subrayado por rangos de caracteres sobre el texto canónico de una lectura
// (ver normalizeReadingText). El usuario selecciona con la selección NATIVA
// (inicio y fin exactos) y elige un color pastel; aquí vive la lógica pura de
// añadir/quitar rangos y trocear el texto en spans para pintarlo.

/** Claves de color pastel. Se guarda la clave (no el hex) para poder ajustar
 *  la paleta sin romper subrayados ya guardados. */
export type HighlightColorKey = 'sun' | 'mint' | 'rose' | 'sky' | 'lilac';

export interface HighlightRange {
  start: number;
  end: number; // exclusivo
  color: HighlightColorKey;
  /** Copia del texto subrayado — para mostrar en Guardados y por robustez. */
  text: string;
}

/** Subrayado guardado: rango nuevo o frase legacy (release anterior). */
export type StoredHighlight = string | HighlightRange;

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColorKey = 'sun';

/** Paleta pastel — fondo del marcador en claro/oscuro y color del chip. */
export const HIGHLIGHT_COLORS: Record<
  HighlightColorKey,
  { light: string; dark: string; swatch: string }
> = {
  sun: {
    light: 'rgba(255,214,102,0.55)',
    dark: 'rgba(255,214,102,0.30)',
    swatch: '#FFD666',
  },
  mint: {
    light: 'rgba(134,239,172,0.50)',
    dark: 'rgba(110,231,183,0.28)',
    swatch: '#86EFAC',
  },
  rose: {
    light: 'rgba(249,168,212,0.50)',
    dark: 'rgba(244,114,182,0.30)',
    swatch: '#F9A8D4',
  },
  sky: {
    light: 'rgba(147,197,253,0.50)',
    dark: 'rgba(125,211,252,0.28)',
    swatch: '#93C5FD',
  },
  lilac: {
    light: 'rgba(216,180,254,0.50)',
    dark: 'rgba(196,181,253,0.30)',
    swatch: '#D8B4FE',
  },
};

export const HIGHLIGHT_COLOR_KEYS = Object.keys(
  HIGHLIGHT_COLORS,
) as HighlightColorKey[];

export function highlightBg(key: HighlightColorKey, isDark: boolean): string {
  const c = HIGHLIGHT_COLORS[key] ?? HIGHLIGHT_COLORS[DEFAULT_HIGHLIGHT_COLOR];
  return isDark ? c.dark : c.light;
}

const clampRange = (text: string, start: number, end: number) => ({
  start: Math.max(0, Math.min(start, text.length)),
  end: Math.max(0, Math.min(end, text.length)),
});

/** Convierte subrayados guardados (rangos nuevos o frases legacy) en rangos
 *  válidos sobre el texto canónico. Las frases legacy se localizan con
 *  indexOf; si ya no aparecen en el texto, se descartan. */
export function normalizeHighlights(
  text: string,
  raw: StoredHighlight[] | undefined | null,
): HighlightRange[] {
  if (!raw?.length) return [];
  const out: HighlightRange[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const idx = text.indexOf(item.trim());
      if (idx >= 0) {
        out.push({
          start: idx,
          end: idx + item.trim().length,
          color: DEFAULT_HIGHLIGHT_COLOR,
          text: item.trim(),
        });
      }
      continue;
    }
    if (
      typeof item?.start === 'number' &&
      typeof item?.end === 'number' &&
      item.end > item.start
    ) {
      const { start, end } = clampRange(text, item.start, item.end);
      if (end > start) {
        out.push({
          start,
          end,
          color: item.color ?? DEFAULT_HIGHLIGHT_COLOR,
          text: text.slice(start, end),
        });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Resta el tramo [start,end) de un rango: devuelve 0, 1 o 2 trozos. */
function subtract(
  text: string,
  r: HighlightRange,
  start: number,
  end: number,
): HighlightRange[] {
  if (end <= r.start || start >= r.end) return [r]; // sin solape
  const pieces: HighlightRange[] = [];
  if (start > r.start) {
    pieces.push({
      start: r.start,
      end: start,
      color: r.color,
      text: text.slice(r.start, start),
    });
  }
  if (end < r.end) {
    pieces.push({
      start: end,
      end: r.end,
      color: r.color,
      text: text.slice(end, r.end),
    });
  }
  return pieces;
}

/** Añade un subrayado [start,end) con `color`. Pinta POR ENCIMA de lo que
 *  hubiera (recorta los rangos solapados) y funde con vecinos contiguos del
 *  mismo color. */
export function addHighlight(
  text: string,
  ranges: HighlightRange[],
  start: number,
  end: number,
  color: HighlightColorKey,
): HighlightRange[] {
  const c = clampRange(text, start, end);
  if (c.end <= c.start) return ranges;
  let out = ranges.flatMap((r) => subtract(text, r, c.start, c.end));
  out.push({
    start: c.start,
    end: c.end,
    color,
    text: text.slice(c.start, c.end),
  });
  out.sort((a, b) => a.start - b.start);
  // Fusión de contiguos del mismo color (evita fragmentación)
  const merged: HighlightRange[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && last.color === r.color && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
      last.text = text.slice(last.start, last.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/** Borra cualquier subrayado dentro de [start,end) (goma). */
export function removeHighlight(
  text: string,
  ranges: HighlightRange[],
  start: number,
  end: number,
): HighlightRange[] {
  const c = clampRange(text, start, end);
  if (c.end <= c.start) return ranges;
  return ranges.flatMap((r) => subtract(text, r, c.start, c.end));
}

export interface HighlightSpan {
  text: string;
  color: HighlightColorKey | null;
}

/** Trocea el texto canónico en spans consecutivos (con o sin color) listos
 *  para renderizar como <Text> anidados. */
export function computeSpans(
  text: string,
  ranges: HighlightRange[],
): HighlightSpan[] {
  if (!ranges.length) return [{ text, color: null }];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const spans: HighlightSpan[] = [];
  let cursor = 0;
  for (const r of sorted) {
    const start = Math.max(r.start, cursor);
    if (start >= r.end) continue; // solapado con el anterior
    if (start > cursor)
      spans.push({ text: text.slice(cursor, start), color: null });
    spans.push({ text: text.slice(start, r.end), color: r.color });
    cursor = r.end;
  }
  if (cursor < text.length)
    spans.push({ text: text.slice(cursor), color: null });
  return spans.filter((s) => s.text.length > 0);
}
