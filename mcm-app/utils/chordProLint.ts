/**
 * El ChordPro del editor de texto, coloreado y revisado. Puro y con tests.
 *
 * - `tokenizeLine`: trocea una línea en letra, acordes y directivas (con su
 *   tipo) para pintarla en colores, como el editor del admin del cantoral.
 * - `lintChordPro`: lo que está mal — corchetes o llaves sin cerrar, un
 *   estribillo que se abre y no se cierra (o al revés), secciones metidas
 *   dentro de otras, corchetes que no parecen un acorde.
 */

export type TokenKind =
  'text' | 'chord' | 'directive' | 'section' | 'comment' | 'arr' | 'error';

export interface Token {
  text: string;
  kind: TokenKind;
}

export interface LintIssue {
  /** Número de línea, desde 1. */
  line: number;
  message: string;
}

const ES_NOTE_LEAK = /^(Do|Fa)[#b]?m?[0-9]*$/;

/** ¿Parece un acorde? (misma regla que el admin del cantoral). */
export function isKnownChord(raw: string): boolean {
  const t = raw.trim();
  if (!t || ES_NOTE_LEAK.test(t)) return false;
  const parts = t.split('/');
  if (parts.length > 2) return false;
  if (!/^[A-G][#b]?[A-Za-z0-9°ºø+\-#b().,]*$/.test(parts[0])) return false;
  if (parts.length === 2 && !/^[A-G][#b]?[A-Za-z0-9#b]*$/.test(parts[1]))
    return false;
  return true;
}

type Section = 'chorus' | 'verse' | 'bridge';
const OPEN: Record<string, Section> = {
  soc: 'chorus',
  start_of_chorus: 'chorus',
  sov: 'verse',
  start_of_verse: 'verse',
  sob: 'bridge',
  start_of_bridge: 'bridge',
};
const CLOSE: Record<string, Section> = {
  eoc: 'chorus',
  end_of_chorus: 'chorus',
  eov: 'verse',
  end_of_verse: 'verse',
  eob: 'bridge',
  end_of_bridge: 'bridge',
};
const SECTION_NAME: Record<Section, string> = {
  chorus: 'estribillo',
  verse: 'estrofa',
  bridge: 'puente',
};

const directiveName = (tok: string) =>
  tok.slice(1, -1).split(':')[0].trim().toLowerCase();

function directiveKind(tok: string): TokenKind {
  const name = directiveName(tok);
  if (name in OPEN || name in CLOSE || name === 'chorus') return 'section';
  if (name === 'c' || name === 'comment' || name === 'ci') return 'comment';
  if (name === 'arr') return 'arr';
  return 'directive';
}

export function tokenizeLine(line: string): Token[] {
  const out: Token[] = [];
  const push = (text: string, kind: TokenKind) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev && prev.kind === kind && kind === 'text') prev.text += text;
    else out.push({ text, kind });
  };
  let i = 0;
  let textStart = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '[' || ch === '{') {
      const close = line.indexOf(ch === '[' ? ']' : '}', i + 1);
      // Otra apertura antes del cierre: esta se quedó sin cerrar.
      const reopen = line.indexOf(ch, i + 1);
      if (close >= 0 && reopen >= 0 && reopen < close) {
        push(line.slice(textStart, i), 'text');
        push(line.slice(i, reopen), 'error');
        i = reopen;
        textStart = i;
        continue;
      }
      // Sin cerrar: de aquí al final, en error.
      if (close < 0) {
        push(line.slice(textStart, i), 'text');
        push(line.slice(i), 'error');
        return out;
      }
      push(line.slice(textStart, i), 'text');
      const tok = line.slice(i, close + 1);
      if (ch === '[') {
        push(tok, isKnownChord(tok.slice(1, -1)) ? 'chord' : 'error');
      } else {
        push(tok, directiveKind(tok));
      }
      i = close + 1;
      textStart = i;
      continue;
    }
    if (ch === ']' || ch === '}') {
      // Un cierre suelto, sin su apertura.
      push(line.slice(textStart, i), 'text');
      push(ch, 'error');
      i += 1;
      textStart = i;
      continue;
    }
    i += 1;
  }
  push(line.slice(textStart), 'text');
  return out;
}

const MAX_ISSUES = 50;

export function lintChordPro(body: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (line: number, message: string) => {
    if (issues.length < MAX_ISSUES) issues.push({ line, message });
  };
  let open: { kind: Section; line: number } | null = null;
  const lines = body.split('\n');
  lines.forEach((raw, idx) => {
    const n = idx + 1;
    for (const tok of tokenizeLine(raw)) {
      if (tok.kind === 'error') {
        if (tok.text === ']' || tok.text === '}')
          add(n, `«${tok.text}» sin su apertura`);
        else if (tok.text.startsWith('['))
          add(
            n,
            tok.text.includes(']')
              ? `«${tok.text}» no parece un acorde`
              : 'Corchete «[» sin cerrar',
          );
        else add(n, 'Llave «{» sin cerrar');
        continue;
      }
      if (tok.kind !== 'section') continue;
      const name = directiveName(tok.text);
      const opens = OPEN[name];
      const closes = CLOSE[name];
      if (opens) {
        if (open)
          add(
            n,
            `Empieza un ${SECTION_NAME[opens]} sin cerrar el ${SECTION_NAME[open.kind]} de la línea ${open.line}`,
          );
        open = { kind: opens, line: n };
      } else if (closes) {
        if (!open) add(n, `Cierre de ${SECTION_NAME[closes]} sin abrir`);
        else if (open.kind !== closes)
          add(
            n,
            `Cierra un ${SECTION_NAME[closes]} pero lo abierto es un ${SECTION_NAME[open.kind]} (línea ${open.line})`,
          );
        open = null;
      }
    }
  });
  if (open) {
    const o = open as { kind: Section; line: number };
    add(o.line, `El ${SECTION_NAME[o.kind]} no se cierra`);
  }
  return issues;
}
