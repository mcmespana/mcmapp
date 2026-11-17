/**
 * Editor de canciones: la parte pura. Trabaja sobre el ChordPro tal cual (el
 * mismo texto que se guarda), sin pasar por ChordSheetJS: aquí lo que importa
 * es no perder ni un carácter de lo que no se toca.
 *
 * - Cabecera ↔ cuerpo: `{title}`, `{artist}`, `{key}`, `{capo}` se editan como
 *   campos; el resto es el cuerpo.
 * - Una línea de letra = texto + acordes con su posición (índice de carácter).
 * - La «edición» que se manda es la misma que ya entiende el cantoral
 *   (`songs/ediciones`: pares `…Old`/`…New`).
 */

export interface EditorChord {
  /** Índice en la letra (sin acordes) donde cae. */
  pos: number;
  /** Como está escrito en el ChordPro (cifrado inglés). */
  name: string;
}

export type EditorLine =
  | { kind: 'lyrics'; lyrics: string; chords: EditorChord[] }
  | { kind: 'other'; raw: string };

const DIRECTIVE = /^\s*\{.*\}\s*$/;

export function parseEditorLine(raw: string): EditorLine {
  if (DIRECTIVE.test(raw) || raw.trim().startsWith('#')) {
    return { kind: 'other', raw };
  }
  const chords: EditorChord[] = [];
  let lyrics = '';
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '[') {
      const close = raw.indexOf(']', i);
      if (close > i) {
        chords.push({ pos: lyrics.length, name: raw.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }
    lyrics += raw[i];
    i += 1;
  }
  return { kind: 'lyrics', lyrics, chords };
}

export function serializeEditorLine(line: EditorLine): string {
  if (line.kind === 'other') return line.raw;
  const sorted = line.chords
    .map((c, order) => ({ ...c, order }))
    .sort((a, b) => a.pos - b.pos || a.order - b.order);
  let out = '';
  let at = 0;
  for (const c of sorted) {
    const pos = Math.max(0, Math.min(line.lyrics.length, c.pos));
    out += line.lyrics.slice(at, pos) + `[${c.name}]`;
    at = pos;
  }
  return out + line.lyrics.slice(at);
}

type LyricsLine = Extract<EditorLine, { kind: 'lyrics' }>;

const clampPos = (line: LyricsLine, pos: number) =>
  Math.max(0, Math.min(line.lyrics.length, Math.round(pos)));

export function moveChord(
  line: LyricsLine,
  index: number,
  pos: number,
): LyricsLine {
  return {
    ...line,
    chords: line.chords.map((c, i) =>
      i === index ? { ...c, pos: clampPos(line, pos) } : c,
    ),
  };
}

export function addChord(
  line: LyricsLine,
  pos: number,
  name: string,
): LyricsLine {
  return {
    ...line,
    chords: [...line.chords, { pos: clampPos(line, pos), name }],
  };
}

export function removeChord(line: LyricsLine, index: number): LyricsLine {
  return { ...line, chords: line.chords.filter((_, i) => i !== index) };
}

export function renameChord(
  line: LyricsLine,
  index: number,
  name: string,
): LyricsLine {
  return {
    ...line,
    chords: line.chords.map((c, i) => (i === index ? { ...c, name } : c)),
  };
}

/**
 * Cambiar la letra de una línea sin descolocar los acordes: los de antes del
 * cambio se quedan, los de después se corren lo que haya crecido o encogido.
 */
export function replaceLyrics(line: LyricsLine, next: string): LyricsLine {
  const prev = line.lyrics;
  let start = 0;
  while (
    start < prev.length &&
    start < next.length &&
    prev[start] === next[start]
  )
    start += 1;
  let endPrev = prev.length;
  let endNext = next.length;
  while (
    endPrev > start &&
    endNext > start &&
    prev[endPrev - 1] === next[endNext - 1]
  ) {
    endPrev -= 1;
    endNext -= 1;
  }
  const delta = next.length - prev.length;
  return {
    kind: 'lyrics',
    lyrics: next,
    chords: line.chords.map((c) => ({
      ...c,
      pos:
        c.pos < start
          ? c.pos
          : c.pos >= endPrev
            ? Math.max(0, Math.min(next.length, c.pos + delta))
            : Math.min(next.length, endNext),
    })),
  };
}

/** Parte la letra en filas de como mucho `cols` caracteres, por palabras. */
export function wrapRows(
  lyrics: string,
  cols: number,
): { start: number; end: number }[] {
  const width = Math.max(8, Math.floor(cols));
  if (lyrics.length <= width) return [{ start: 0, end: lyrics.length }];
  const rows: { start: number; end: number }[] = [];
  let start = 0;
  while (lyrics.length - start > width) {
    let cut = lyrics.lastIndexOf(' ', start + width);
    if (cut <= start) cut = start + width;
    else cut += 1; // el espacio se queda al final de la fila
    rows.push({ start, end: cut });
    start = cut;
  }
  rows.push({ start, end: lyrics.length });
  return rows;
}

// ── Acordes ──

const ES_ROOTS: [string, string][] = [
  ['sol', 'G'],
  ['do', 'C'],
  ['re', 'D'],
  ['mi', 'E'],
  ['fa', 'F'],
  ['la', 'A'],
  ['si', 'B'],
];

function oneChordToEnglish(part: string): string {
  const s = part.trim();
  if (!s) return s;
  const lower = s.toLowerCase();
  for (const [es, en] of ES_ROOTS) {
    if (!lower.startsWith(es)) continue;
    // «la-» también es menor.
    const rest = s.slice(es.length).replace(/^-/, 'm');
    return en + rest;
  }
  // Ya en inglés: primera letra en mayúscula.
  if (
    /^[a-g]/.test(s) &&
    /^[a-g](#|b)?(m|maj|min|dim|aug|sus|add|\d|\/|$)/i.test(s)
  )
    return s[0].toUpperCase() + s.slice(1);
  return s;
}

/**
 * Lo que se teclea («Sol7», «lam», «FA#m», «do/mi», «G») → cifrado inglés,
 * que es como se guarda. Lo que no se reconoce se deja tal cual.
 */
export function chordToEnglish(input: string): string {
  return input
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .split('/')
    .map(oneChordToEnglish)
    .join('/');
}

/** Acordes del texto, sin repetir, en orden de aparición. */
export function chordsUsed(content: string): string[] {
  const seen = new Set<string>();
  for (const m of content.matchAll(/\[([^\]\n]+)\]/g)) {
    const name = m[1].trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

// ── Cabecera ──

export interface SongFields {
  title: string;
  author: string;
  key: string;
  capo: number;
  info: string;
}

const HEADER_RX =
  /^\s*\{\s*(title|t|artist|author|key|capo|info)\s*:\s*(.*?)\s*\}\s*$/i;

/** Separa las directivas de cabecera (que se editan como campos) del cuerpo. */
export function splitSongHeader(content: string): {
  header: string[];
  body: string;
} {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const header: string[] = [];
  let i = 0;
  for (; i < lines.length; i++) {
    if (HEADER_RX.test(lines[i])) header.push(lines[i]);
    else if (lines[i].trim() === '' && header.length && i + 1 < lines.length) {
      // línea en blanco tras la cabecera: se salta si lo siguiente es cuerpo
      if (!HEADER_RX.test(lines[i + 1])) {
        i += 1;
        break;
      }
    } else break;
  }
  return { header, body: lines.slice(i).join('\n') };
}

const clean = (v: string) => v.replace(/[{}\n\r]/g, ' ').trim();

/** Cabecera nueva + cuerpo: el `content` que viaja a Firebase y al `.cho`. */
export function composeSongContent(fields: SongFields, body: string): string {
  const head = [`{title: ${clean(fields.title)}}`];
  if (clean(fields.author)) head.push(`{artist: ${clean(fields.author)}}`);
  if (clean(fields.key)) head.push(`{key: ${clean(fields.key)}}`);
  if (fields.capo > 0) head.push(`{capo: ${fields.capo}}`);
  if (clean(fields.info)) head.push(`{info: ${clean(fields.info)}}`);
  return `${head.join('\n')}\n\n${body.replace(/^\n+/, '').trimEnd()}\n`;
}

// ── Edición ──

export interface MediaLink {
  label: string;
  url: string;
}

export interface SongSnapshot extends SongFields {
  content: string;
  album: string;
  source: string;
  rhythm: string;
  liturgicalTime: string;
  videoEmbed: string;
  youtubeLinks: MediaLink[];
  audioLinks: MediaLink[];
  spotifyLinks: MediaLink[];
  /** Documentos de Drive (partituras, PDF). */
  driveLinks: MediaLink[];
  /** Cualquier otro enlace (una web con la partitura…). */
  otherLinks: MediaLink[];
  /** Etiquetas, en slug. */
  tags: string[];
}

export const cleanLinks = (links: MediaLink[] | undefined): MediaLink[] =>
  (links ?? [])
    .map((l) => ({ label: (l.label ?? '').trim(), url: (l.url ?? '').trim() }))
    .filter((l) => l.url.length > 0);

const SCALAR_FIELDS = [
  'title',
  'author',
  'key',
  'capo',
  'info',
  'content',
  'album',
  'source',
  'rhythm',
  'liturgicalTime',
  'videoEmbed',
] as const;
const LINK_FIELDS = [
  'youtubeLinks',
  'audioLinks',
  'spotifyLinks',
  'driveLinks',
  'otherLinks',
] as const;

export type EditableField =
  (typeof SCALAR_FIELDS)[number] | (typeof LINK_FIELDS)[number];

/**
 * Qué ha cambiado: `{ titleOld, titleNew, … }` solo con los campos tocados, y
 * los valores nuevos para aplicarlos en Firebase. Vacío = nada que guardar.
 */
export function buildEdition(
  before: SongSnapshot,
  after: SongSnapshot,
): { changes: Record<string, unknown>; fields: Partial<SongSnapshot> } {
  const changes: Record<string, unknown> = {};
  const fields: Partial<SongSnapshot> = {};
  for (const f of SCALAR_FIELDS) {
    const a =
      typeof before[f] === 'string' ? (before[f] as string).trim() : before[f];
    const b =
      typeof after[f] === 'string' ? (after[f] as string).trim() : after[f];
    if (a !== b) {
      changes[`${f}Old`] = before[f];
      changes[`${f}New`] = after[f];
      (fields as Record<string, unknown>)[f] = after[f];
    }
  }
  for (const f of LINK_FIELDS) {
    const a = cleanLinks(before[f]);
    const b = cleanLinks(after[f]);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[`${f}Old`] = a;
      changes[`${f}New`] = b;
      fields[f] = b;
    }
  }
  const tagsA = normalizeTags(before.tags);
  const tagsB = normalizeTags(after.tags);
  if (tagsA.join(',') !== tagsB.join(',')) {
    changes.tagsOld = tagsA;
    changes.tagsNew = tagsB;
    fields.tags = tagsB;
  }
  return { changes, fields };
}

/** «Adviento, Misa joven» → ['adviento', 'misa-joven'] (sin repetir). */
export function normalizeTags(input: string | string[] | undefined): string[] {
  const parts = Array.isArray(input) ? input : (input ?? '').split(',');
  const out: string[] = [];
  for (const part of parts) {
    const slug = String(part)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

/**
 * El catálogo (`songs/data`) con una canción ya editada: lo que se pinta en
 * este móvil nada más guardar, mientras el cantoral publica la versión de
 * verdad. El título conserva el número de orden que lleva en el catálogo.
 * Devuelve `undefined` si la canción no está (nada que tocar).
 */
export function applyEditToCatalog<
  T extends Record<string, { songs?: Record<string, unknown>[] } | undefined>,
>(
  data: T,
  category: string,
  filename: string,
  fields: Partial<SongSnapshot>,
): T | undefined {
  const cat = data?.[category];
  const songs = Array.isArray(cat?.songs) ? cat.songs : null;
  if (!songs) return undefined;
  const index = songs.findIndex((s) => s?.filename === filename);
  if (index < 0) return undefined;
  const prev = songs[index];
  const next: Record<string, unknown> = { ...prev, ...fields };
  if (fields.title !== undefined) {
    const prefix = String(prev.title ?? '').match(/^\s*\d+\s*\.\s*/)?.[0];
    next.title = `${prefix ?? ''}${fields.title}`;
  }
  if (fields.author !== undefined) next.author = fields.author;
  const nextSongs = songs.slice();
  nextSongs[index] = next;
  return { ...data, [category]: { ...cat, songs: nextSongs } };
}
