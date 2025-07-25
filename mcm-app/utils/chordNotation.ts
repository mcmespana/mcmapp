export type Notation = 'EN' | 'ES';

const EN_TO_ES_MAP: Record<string, string> = {
  A: 'LA',
  B: 'SI',
  C: 'DO',
  D: 'RE',
  E: 'MI',
  F: 'FA',
  G: 'SOL',
};

export function convertChord(chord: string, notation: Notation): string {
  if (notation === 'EN') return chord;
  const converted = chord.replace(
    /(^|[\\/|-])([A-G])/g,
    (_, prefix: string, root: string) => {
      return prefix + (EN_TO_ES_MAP[root] || root);
    },
  );

  const isMinor = /[A-G][#b]?m(?![a-z])/i.test(chord);
  return isMinor ? converted.toLowerCase() : converted;
}

export function convertHtmlChords(html: string, notation: Notation): string {
  if (notation === 'EN') return html;
  return html.replace(
    /(<div class="chord"[^>]*>)([^<]*)(<\/div>)/g,
    (_m, p1: string, chord: string, p3: string) => {
      return p1 + convertChord(chord, notation) + p3;
    },
  );
}
