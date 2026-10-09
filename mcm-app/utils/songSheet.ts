/**
 * Hoja de canción: ChordPro (ya parseado por ChordSheetJS) → modelo propio →
 * HTML que pinta el WebView.
 *
 * Por qué no `HtmlDivFormatter` de ChordSheetJS: parte cada línea en columnas
 * que van de acorde a acorde («a|quí»), no en palabras, y el salto de línea en
 * un móvil caía donde caía la columna («Miembro de / un pueblo, tengo
 * familia.»). Aquí cada línea se trocea en PALABRAS (un acorde a media palabra
 * queda dentro de su palabra) y el script de maquetación
 * (`utils/songSheetLayout.ts`) elige dónde partir una línea que no cabe:
 * primero tras un punto o una coma, nunca detrás de un artículo.
 *
 * Además del troceo, el modelo entiende la estructura de la canción:
 *  - Secciones: estrofa, estribillo, puente, intro de solo acordes.
 *  - Un `{soc}` pegado a la estrofa (sin línea en blanco) abre su propia
 *    sección: ChordSheetJS lo metía en el mismo párrafo y el estribillo no se
 *    separaba.
 *  - Estribillos repetidos (idénticos o casi): se marcan para que la vista
 *    compacta los pliegue en una línea «Estribillo».
 *  - `{chorus}` (ChordPro estándar: «aquí va el estribillo») se expande.
 *  - Estrofas numeradas: la numeración a mano («1. Hay muchas…») se quita del
 *    texto y se pinta con el mismo estilo que la automática.
 *  - Las marcas de revisión («♩ REVISAR ACORDES») salen de la letra y van a
 *    la cabecera.
 *
 * El ChordPro llega ESCAPADO (ver `useSongProcessor`): todo el texto que sale
 * del `Song` ya es HTML seguro y aquí no se vuelve a escapar.
 */
import type { Song } from 'chordsheetjs';
import { ARR_SENTINEL } from './arrangements';
import { convertChord, type Notation } from './chordNotation';

/** Centinela de `{chorus}`: se convierte en comentario antes de parsear. */
export const CHORUS_REF_SENTINEL = '@@CHORUS@@';

export interface SheetSegment {
  /** Acorde (ya transportado y en la notación pedida) o '' si no hay. */
  chord: string;
  /** Texto bajo el acorde. Puede acabar en espacio (fin de palabra). */
  text: string;
}

/** Una palabra con su espacio final: la unidad que nunca se parte. */
export interface SheetAtom {
  segs: SheetSegment[];
}

export type SheetLine =
  | { kind: 'lyrics'; atoms: SheetAtom[]; src: number | null }
  | { kind: 'chords'; chords: string[]; note: string; src: number | null }
  | { kind: 'comment'; text: string; src: number | null }
  | { kind: 'arr'; text: string; src: number | null };

export type SectionKind =
  'verse' | 'chorus' | 'bridge' | 'instrumental' | 'note';

export interface SheetSection {
  kind: SectionKind;
  /** Etiqueta visible («Estribillo», «Puente», «Intro»…), si la hay. */
  label: string | null;
  /** Número de estrofa (solo `verse`). */
  number: number | null;
  lines: SheetLine[];
  /**
   * Si esta sección repite otra anterior: índice de la primera aparición, si
   * la letra es idéntica (`exact`) o solo casi igual, y si lleva los mismos
   * acordes (un estribillo que sube de tono tiene la misma letra y no).
   */
  repeatOf: { index: number; exact: boolean; sameChords: boolean } | null;
  /** El estribillo no venía marcado: se deduce porque el bloque se repite. */
  inferred?: boolean;
}

export interface SheetModel {
  sections: SheetSection[];
  /** Avisos de revisión pendientes («REVISAR ACORDES»…), fuera de la letra. */
  reviewNotes: string[];
  /** Las estrofas traían número escrito a mano. */
  manualNumbers: boolean;
}

export interface BuildSheetOptions {
  notation: Notation;
}

// ─── Clasificación de comentarios ────────────────────────────────────────────

const REVIEW_RE = /revis|pendiente|\bto ?do\b/i;
const CHORUS_LABEL_RE = /^(estribillo|coro|chorus)\b/i;
const BRIDGE_LABEL_RE = /^(puente|pre-?estribillo|bridge)\b/i;
const INSTRUMENTAL_LABEL_RE =
  /^(intro|instrumental|interludio|final|outro|solo)\b/i;
const VERSE_LABEL_RE = /^estrofa\s*(\d+)?\s*$/i;
/** «1. Hay muchas…», «2) Porque…», «3.- Vas…» */
const MANUAL_NUMBER_RE = /^(\s*)(\d{1,2})\s*(?:[.)º°ª]|\.-)\s+/;

/** Quita emoji/símbolos decorativos del principio y del final de una etiqueta. */
function cleanLabel(text: string): string {
  return text
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}).]+$/u, '')
    .trim();
}

// ─── Utilidades de texto ─────────────────────────────────────────────────────

/** Texto de letra normalizado para comparar estribillos. */
export function normalizeLyrics(text: string): string {
  return text
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(?\s*\b(bis|x\s?\d+)\b\s*\)?/g, ' ')
    .replace(/[^a-zñ0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parecido entre dos letras normalizadas: 1 − distancia de edición por palabras. */
export function lyricsSimilarity(a: string, b: string): number {
  const wa = a ? a.split(' ') : [];
  const wb = b ? b.split(' ') : [];
  if (wa.length === 0 && wb.length === 0) return 1;
  if (wa.length === 0 || wb.length === 0) return 0;
  let prev = Array.from({ length: wb.length + 1 }, (_, j) => j);
  for (let i = 1; i <= wa.length; i++) {
    const cur = [i];
    for (let j = 1; j <= wb.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (wa[i - 1] === wb[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[wb.length] / Math.max(wa.length, wb.length);
}

/** A partir de este parecido, un estribillo cuenta como «casi igual». */
export const NEAR_REPEAT_THRESHOLD = 0.8;

function lineText(line: SheetLine): string {
  if (line.kind !== 'lyrics') return '';
  return line.atoms.map((a) => a.segs.map((s) => s.text).join('')).join('');
}

function sectionLyrics(section: SheetSection): string {
  return normalizeLyrics(section.lines.map(lineText).join(' '));
}

// ─── Troceo de una línea en palabras ─────────────────────────────────────────

interface RawSeg {
  chord: string;
  text: string;
}

/**
 * Parte los pares acorde+letra de una línea en palabras. Un acorde a media
 * palabra («a[G]quí») queda como segundo segmento de la misma palabra; un
 * segmento con varias palabras («[C]Seas quien seas ») se reparte: el acorde
 * va con la primera y las demás salen sin acorde.
 */
export function splitIntoAtoms(raw: RawSeg[]): SheetAtom[] {
  const atoms: SheetAtom[] = [];
  let cur: SheetSegment[] = [];
  const flush = () => {
    if (cur.length) atoms.push({ segs: cur });
    cur = [];
  };
  for (const { chord, text } of raw) {
    // Trozos de «palabra + espacios»; el primero puede ser solo espacios.
    // Varios espacios seguidos cuentan como uno: en la letra no significan
    // nada y harían una palabra más ancha que la pantalla.
    const parts = (text.match(/[^\s]+\s*|\s+/g) ?? ['']).map((p) =>
      p.replace(/\s+$/, (sp) => (sp ? ' ' : '')),
    );
    parts.forEach((part, i) => {
      const segChord = i === 0 ? chord : '';
      const startsWithSpace = /^\s/.test(part);
      if (startsWithSpace) {
        // Espacio suelto: cierra la palabra en curso (o es un acorde «al
        // aire», sobre un hueco, como en «[G] [C] [D]»).
        if (cur.length && !segChord) {
          cur[cur.length - 1] = {
            ...cur[cur.length - 1],
            text: cur[cur.length - 1].text + part,
          };
          flush();
          return;
        }
        flush();
        cur.push({ chord: segChord, text: part });
        flush();
        return;
      }
      cur.push({ chord: segChord, text: part });
      if (/\s$/.test(part)) flush();
    });
  }
  flush();
  // Un acorde sobre el hueco ENTRE dos palabras («[G] al oírlo») va con la
  // palabra siguiente: suena con ella, y así el renglón nunca empieza por un
  // hueco. Al final de la línea («BEBER [G] [G7]») se queda donde está.
  for (let i = 0; i < atoms.length - 1; i++) {
    const a = atoms[i];
    const next = atoms[i + 1];
    const onSpace =
      a.segs.length === 1 && a.segs[0].chord && a.segs[0].text.trim() === '';
    const nextIsWord = next.segs.some((s) => s.text.trim() !== '');
    if (onSpace && nextIsWord && !next.segs[0].chord) {
      next.segs[0] = { ...next.segs[0], chord: a.segs[0].chord };
      if (i > 0) {
        const prev = atoms[i - 1];
        const tail = prev.segs[prev.segs.length - 1];
        prev.segs[prev.segs.length - 1] = {
          ...tail,
          text: tail.text.replace(/\s*$/, ' '),
        };
      }
      atoms.splice(i, 1);
      i--;
    }
  }
  // Fuera los espacios del principio de la línea («  [G]Ven…»).
  while (
    atoms.length &&
    atoms[0].segs.every((s) => !s.chord && s.text.trim() === '')
  ) {
    atoms.shift();
  }
  return atoms;
}

const PLACEHOLDER_RE =
  /^\(?\s*(estribillo|coro)\s*\)?\s*(\(?\s*(bis|x\s?\d+)\s*\)?)?\s*[.:]?$/i;

/** «ESTRIBILLO», «(Coro)», «Estribillo x2»: la línea que manda repetirlo. */
function isChorusPlaceholder(raw: RawSeg[]): boolean {
  if (raw.some((r) => r.chord)) return false;
  return PLACEHOLDER_RE.test(
    raw
      .map((r) => r.text)
      .join('')
      .trim(),
  );
}

/** Texto de una línea que, sin acordes, no es letra: «x4», «|», «(bis)». */
const CHORD_LINE_NOISE_RE = /^[\s|/\-–·.,()x×\d]*$/i;

function toLine(raw: RawSeg[], src: number | null): SheetLine | null {
  const atoms = splitIntoAtoms(raw);
  if (atoms.length === 0) return null;
  const chords = raw.map((r) => r.chord).filter(Boolean);
  const text = raw
    .map((r) => r.text)
    .join('')
    .trim();
  if (chords.length > 0 && CHORD_LINE_NOISE_RE.test(text)) {
    return { kind: 'chords', chords, note: text, src };
  }
  return { kind: 'lyrics', atoms, src };
}

// ─── Construcción del modelo ─────────────────────────────────────────────────

interface TagLike {
  name: string;
  value: string | null;
}

function isTag(item: unknown): item is TagLike {
  return (
    !!item &&
    typeof (item as TagLike).name === 'string' &&
    !('chords' in (item as object))
  );
}

interface PairLike {
  chords: string;
  lyrics: string | null;
  annotation?: string | null;
}

function isPair(item: unknown): item is PairLike {
  return !!item && typeof (item as PairLike).chords === 'string';
}

const COMMENT_TAGS = new Set(['comment', 'c', 'comment_italic', 'ci']);

export function buildSheet(song: Song, opts: BuildSheetOptions): SheetModel {
  const sections: SheetSection[] = [];
  const reviewNotes: string[] = [];
  let manualNumbers = false;
  let current: SheetSection | null = null;
  let currentType = '';
  /** Etiqueta de un `{c: …}` a la espera de la sección que encabeza. */
  let pendingLabel: {
    kind: SectionKind;
    label: string | null;
    number: number | null;
  } | null = null;

  const open = (kind: SectionKind, label: string | null, type: string) => {
    current = { kind, label, number: null, lines: [], repeatOf: null };
    currentType = type;
    sections.push(current);
    return current;
  };
  const close = () => {
    current = null;
    currentType = '';
  };
  const ensure = (type: string): SheetSection => {
    const wanted: SectionKind =
      type === 'chorus' ? 'chorus' : type === 'bridge' ? 'bridge' : 'verse';
    if (current && currentType === type) return current;
    if (pendingLabel) {
      const p = pendingLabel;
      pendingLabel = null;
      const kind = wanted === 'verse' ? p.kind : wanted;
      const s = open(kind, p.label, type);
      s.number = p.number;
      return s;
    }
    return open(wanted, null, type);
  };

  for (const paragraph of song.paragraphs) {
    close();
    const paraLabel = paragraph.label;
    for (const line of paragraph.lines) {
      const src = line.lineNumber ?? null;
      const type =
        line.type === 'chorus' || line.type === 'bridge' ? line.type : 'verse';
      const raw: RawSeg[] = [];
      for (const item of line.items) {
        if (isPair(item)) {
          const chord = item.annotation
            ? item.annotation
            : item.chords
              ? convertChord(item.chords, opts.notation)
              : '';
          raw.push({ chord, text: item.lyrics ?? '' });
          continue;
        }
        if (!isTag(item)) continue;
        const name = item.name.toLowerCase();
        const value = (item.value ?? '').trim();
        if (!COMMENT_TAGS.has(name) || !value) continue;

        if (value.startsWith(ARR_SENTINEL)) {
          ensure(type).lines.push({
            kind: 'arr',
            text: value.slice(ARR_SENTINEL.length).trim(),
            src,
          });
          continue;
        }
        if (value.startsWith(CHORUS_REF_SENTINEL)) {
          // `{chorus}`: se resuelve al final, cuando ya conocemos los estribillos.
          close();
          const ref = open(
            'chorus',
            value.slice(CHORUS_REF_SENTINEL.length).trim() || null,
            '@ref',
          );
          ref.repeatOf = { index: -1, exact: true, sameChords: true };
          close();
          continue;
        }
        if (REVIEW_RE.test(value)) {
          reviewNotes.push(cleanLabel(value) || value);
          continue;
        }
        const label = cleanLabel(value);
        const verse = label.match(VERSE_LABEL_RE);
        if (CHORUS_LABEL_RE.test(label) && label.length <= 24) {
          close();
          pendingLabel = { kind: 'chorus', label, number: null };
          continue;
        }
        if (BRIDGE_LABEL_RE.test(label) && label.length <= 24) {
          close();
          pendingLabel = { kind: 'bridge', label, number: null };
          continue;
        }
        if (verse) {
          close();
          pendingLabel = {
            kind: 'verse',
            label: null,
            number: verse[1] ? Number(verse[1]) : null,
          };
          if (verse[1]) manualNumbers = true;
          continue;
        }
        if (INSTRUMENTAL_LABEL_RE.test(label) && !label.includes(':')) {
          close();
          pendingLabel = { kind: 'instrumental', label, number: null };
          continue;
        }
        ensure(type).lines.push({ kind: 'comment', text: value, src });
      }
      if (raw.length === 0) continue;
      if (isChorusPlaceholder(raw)) {
        // Una línea que solo dice «ESTRIBILLO» (dentro o fuera de un
        // `{soc}`) es una referencia, como `{chorus}`: se pinta el estribillo.
        close();
        const ref = open('chorus', null, '@ref');
        ref.repeatOf = { index: -1, exact: true, sameChords: true };
        close();
        continue;
      }
      const sheetLine = toLine(raw, src);
      if (!sheetLine) continue;
      const section = ensure(type);
      if (type !== 'verse' && paraLabel && section.label === null) {
        section.label = paraLabel;
      }
      section.lines.push(sheetLine);
    }
  }

  // Una etiqueta al final, sin nada debajo («{c: Final}»), se queda como nota.
  if (pendingLabel?.label) {
    sections.push({
      kind: 'note',
      label: null,
      number: null,
      lines: [{ kind: 'comment', text: pendingLabel.label, src: null }],
      repeatOf: null,
    });
  }

  const cleaned = sections.filter(
    (s) => s.lines.length > 0 || s.repeatOf?.index === -1,
  );
  classify(cleaned);
  manualNumbers = extractManualNumbers(cleaned) || manualNumbers;
  resolveRepeats(cleaned);
  numberVerses(cleaned, manualNumbers);
  return { sections: cleaned, reviewNotes, manualNumbers };
}

/** Secciones de solo acordes → instrumental; de solo notas → nota. */
function classify(sections: SheetSection[]) {
  for (const s of sections) {
    if (s.kind !== 'verse') continue;
    const hasLyrics = s.lines.some((l) => l.kind === 'lyrics');
    if (hasLyrics) continue;
    s.kind = s.lines.some((l) => l.kind === 'chords') ? 'instrumental' : 'note';
  }
}

/** Quita «1. » del principio de la estrofa y lo guarda como número. */
function extractManualNumbers(sections: SheetSection[]): boolean {
  let found = false;
  for (const s of sections) {
    if (s.kind !== 'verse') continue;
    const first = s.lines.find((l) => l.kind === 'lyrics');
    if (!first || first.kind !== 'lyrics' || !first.atoms[0]) continue;
    // Solo cuando el número va en su propia palabra («1. Hay»): «1.Hay»
    // es raro y ambiguo, y se queda como está.
    const atomText = first.atoms[0].segs.map((x) => x.text).join('');
    const m = atomText.match(MANUAL_NUMBER_RE);
    if (!m || atomText.trim().length > m[0].trim().length) continue;
    const chord = first.atoms[0].segs.find((x) => x.chord)?.chord ?? '';
    first.atoms.shift();
    // Si el acorde iba sobre el número, pasa a la primera palabra.
    const head = first.atoms[0]?.segs[0];
    if (chord && head && !head.chord) {
      first.atoms[0].segs[0] = { ...head, chord };
    }
    s.number = Number(m[2]);
    found = true;
  }
  return found;
}

/**
 * Marca los estribillos que repiten uno anterior y resuelve `{chorus}`. Un
 * bloque de estrofa que aparece dos veces idéntico es un estribillo sin
 * marcar: se trata como tal.
 */
function resolveRepeats(sections: SheetSection[]) {
  const texts = sections.map((s) =>
    s.repeatOf?.index === -1 ? '' : sectionLyrics(s),
  );

  // Estribillos sin marcar: estrofas de 2+ líneas que se repiten idénticas.
  const byText = new Map<string, number[]>();
  sections.forEach((s, i) => {
    if (s.kind !== 'verse') return;
    const lyricLines = s.lines.filter((l) => l.kind === 'lyrics').length;
    if (lyricLines < 2 || texts[i].length < 12) return;
    byText.set(texts[i], [...(byText.get(texts[i]) ?? []), i]);
  });
  for (const idx of byText.values()) {
    if (idx.length < 2) continue;
    for (const i of idx) {
      sections[i].kind = 'chorus';
      sections[i].inferred = true;
    }
  }

  const sigs = sections.map(chordSignature);
  // Estribillos distintos, en orden. Cada estribillo marcado se compara con
  // los anteriores: si la letra es la misma (o casi), es una repetición.
  const distinct: number[] = [];
  const refs: number[] = [];
  sections.forEach((s, i) => {
    if (s.kind !== 'chorus') return;
    if (s.repeatOf?.index === -1) {
      refs.push(i);
      return;
    }
    let best = -1;
    let bestScore = 0;
    for (const c of distinct) {
      const score =
        texts[c] === texts[i] ? 1 : lyricsSimilarity(texts[c], texts[i]);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (best >= 0 && bestScore >= NEAR_REPEAT_THRESHOLD) {
      s.repeatOf = {
        index: best,
        exact: texts[best] === texts[i],
        sameChords: sigs[best] === sigs[i],
      };
      return;
    }
    distinct.push(i);
  });

  // `{chorus}`, `{chorus: Etiqueta}` o una línea «ESTRIBILLO»: como en
  // ChordPro, el último estribillo antes de la referencia (o el de esa
  // etiqueta); si aún no había ninguno, el primero que venga después.
  for (const i of refs) {
    const s = sections[i];
    const before = distinct.filter((c) => c < i);
    const target =
      (s.label
        ? distinct.find((c) => sections[c].label === s.label)
        : undefined) ??
      before[before.length - 1] ??
      distinct[0];
    if (target === undefined) {
      s.repeatOf = null;
      s.kind = 'note';
      s.lines = [{ kind: 'comment', text: s.label ?? 'Estribillo', src: null }];
      continue;
    }
    s.lines = sections[target].lines;
    s.label = s.label ?? sections[target].label;
    s.repeatOf = { index: target, exact: true, sameChords: true };
  }
}

function chordSignature(s: SheetSection): string {
  return s.lines
    .map((l) =>
      l.kind === 'lyrics'
        ? l.atoms
            .flatMap((a) => a.segs.map((x) => x.chord))
            .filter(Boolean)
            .join(' ')
        : l.kind === 'chords'
          ? l.chords.join(' ')
          : '',
    )
    .join('|');
}

function numberVerses(sections: SheetSection[], manual: boolean) {
  const verses = sections.filter((s) => s.kind === 'verse');
  if (manual) return; // Se respeta lo escrito; las sin número se quedan sin él.
  if (verses.length < 2) {
    verses.forEach((v) => (v.number = null));
    return;
  }
  verses.forEach((v, i) => (v.number = i + 1));
}

// ─── HTML ────────────────────────────────────────────────────────────────────

const REPEAT_MARK_RE = /^\(?\s*(bis|x\s?\d+|\d+\s?veces)\s*\)?[.,;:]?\s*$/i;

function atomHtml(atom: SheetAtom, extra = ''): string {
  const text = atom.segs.map((s) => s.text).join('');
  const cls = REPEAT_MARK_RE.test(text) ? 'w bis' : 'w';
  const segs = atom.segs
    .map((s, i) => {
      const mid = i < atom.segs.length - 1 ? ' m' : '';
      const chord = s.chord ? `<b class="c">${s.chord}</b>` : '';
      // Un texto de solo espacios (acorde «al aire», sobre un hueco) no se
      // pintaría dentro de un flex: se escribe como espacios duros.
      const text = /^\s+$/.test(s.text)
        ? s.text.replace(/\s/g, '&#160;')
        : s.text;
      return `<span class="s${mid}">${chord}<span class="t">${text}</span></span>`;
    })
    .join('');
  return `<span class="${cls}">${extra}${segs}</span>`;
}

function lineHtml(
  line: SheetLine,
  number: number | null,
  lineNumbers: boolean,
): string {
  const data =
    lineNumbers && line.src !== null ? ` data-line="${line.src}"` : '';
  switch (line.kind) {
    case 'lyrics': {
      const hasChords = line.atoms.some((a) => a.segs.some((s) => s.chord));
      const atoms = line.atoms
        .map((a, i) =>
          atomHtml(
            a,
            i === 0 && number !== null
              ? `<span class="vn">${number}</span>`
              : '',
          ),
        )
        .join('');
      return `<div class="ln ly${hasChords ? '' : ' nc'}"${data}>${atoms}</div>`;
    }
    case 'chords': {
      const chords = line.chords.map((c) => `<b class="c">${c}</b>`).join('');
      const note = line.note ? `<span class="cn">${line.note}</span>` : '';
      return `<div class="ln co"${data}>${chords}${note}</div>`;
    }
    case 'comment':
      return `<div class="cm"${data}>${line.text}</div>`;
    case 'arr': {
      const text = /^\s*\|/.test(line.text) ? line.text : `| ${line.text}`;
      return `<div class="arrangement"${data}>${text}</div>`;
    }
  }
}

const KIND_LABEL: Record<SectionKind, string> = {
  verse: 'Estrofa',
  chorus: 'Estribillo',
  bridge: 'Puente',
  instrumental: 'Instrumental',
  note: '',
};

function sectionBody(s: SheetSection, lineNumbers: boolean): string {
  let numberPending = s.kind === 'verse' ? s.number : null;
  return s.lines
    .map((l) => {
      if (l.kind === 'lyrics' && numberPending !== null) {
        const n = numberPending;
        numberPending = null;
        return lineHtml(l, n, lineNumbers);
      }
      return lineHtml(l, null, lineNumbers);
    })
    .join('');
}

/** Primera línea de letra de una sección, en texto plano, para el plegado. */
function firstLyric(s: SheetSection): string {
  const l = s.lines.find((x) => x.kind === 'lyrics');
  return l ? lineText(l).trim() : '';
}

/**
 * HTML de la hoja. Las repeticiones se emiten DOS veces: completas
 * (`.rep-full`) y plegadas (`.rep-fold`); la clase `compact` del `<body>`
 * decide cuál se ve, así cambiar de vista no recarga el WebView.
 */
export interface RenderSheetOptions {
  /**
   * Modo admin: cada línea lleva `data-line` con su número de línea en el
   * ChordPro original, para insertar un `{arr:}` con un toque largo.
   */
  lineNumbers?: boolean;
}

export function renderSheetHtml(
  model: SheetModel,
  { lineNumbers = false }: RenderSheetOptions = {},
): string {
  const parts: string[] = [];
  let i = 0;
  const { sections } = model;
  while (i < sections.length) {
    const s = sections[i];
    const kindCls = s.kind + (s.inferred ? ' inferred' : '');
    const label =
      s.label ??
      (s.kind === 'chorus' || s.kind === 'bridge' ? KIND_LABEL[s.kind] : null);
    if (s.repeatOf) {
      // Repeticiones seguidas del mismo estribillo → «Estribillo ×2».
      let times = 1;
      while (
        i + times < sections.length &&
        sections[i + times].repeatOf?.index === s.repeatOf.index &&
        sections[i + times].repeatOf?.exact === s.repeatOf.exact &&
        sections[i + times].repeatOf?.sameChords === s.repeatOf.sameChords
      ) {
        times++;
      }
      const full = sections
        .slice(i, i + times)
        .map((r) => {
          const lbl = label ? `<div class="lbl">${label}</div>` : '';
          return `<section class="sec ${kindCls} rep-full">${lbl}${sectionBody(r, lineNumbers)}</section>`;
        })
        .join('');
      const preview = firstLyric(s);
      const foldLabel =
        (label ?? KIND_LABEL[s.kind]) +
        (times > 1 ? ` <span class="x">×${times}</span>` : '') +
        (s.repeatOf.exact
          ? s.repeatOf.sameChords
            ? ''
            : ' <span class="x xc">otros acordes</span>'
          : ' <span class="x">con cambios</span>');
      const fold =
        `<details class="sec ${kindCls} rep-fold"><summary>` +
        `<span class="lbl">${foldLabel}</span>` +
        (preview ? `<span class="pv">${preview}</span>` : '') +
        `</summary>${sectionBody(s, lineNumbers)}</details>`;
      parts.push(full + fold);
      i += times;
      continue;
    }
    const lbl =
      label && s.kind !== 'verse' ? `<div class="lbl">${label}</div>` : '';
    parts.push(
      `<section class="sec ${kindCls}">${lbl}${sectionBody(s, lineNumbers)}</section>`,
    );
    i++;
  }
  return `<div class="sheet">${parts.join('')}</div>`;
}
