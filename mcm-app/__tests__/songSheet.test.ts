/**
 * Hoja de canción (`utils/songSheet.ts`): del ChordPro parseado al modelo de
 * secciones/palabras y al HTML. Lo que se blinda aquí es lo que se veía mal
 * en el móvil: palabras partidas por un acorde, estribillos que no se
 * separaban, numeración a mano y a veces no, marcas de revisión en la letra.
 */
import { ChordProParser } from 'chordsheetjs';
import { preprocessArrangements } from '@/utils/arrangements';
import {
  buildSheet,
  CHORUS_REF_SENTINEL,
  lyricsSimilarity,
  normalizeLyrics,
  renderSheetHtml,
  splitIntoAtoms,
  type SheetLine,
  type SheetModel,
} from '@/utils/songSheet';

/** Igual que `parseChordPro` de `useSongProcessor`, sin el escapado. */
function sheet(chordPro: string, notation: 'EN' | 'ES' = 'EN'): SheetModel {
  const src = preprocessArrangements(chordPro)
    .replace(/\{soc\}/gi, '{start_of_chorus}')
    .replace(/\{eoc\}/gi, '{end_of_chorus}')
    .replace(
      /\{\s*chorus\s*(?::\s*([^}]*))?\}/gi,
      (_m, label?: string) =>
        `{comment: ${CHORUS_REF_SENTINEL}${(label ?? '').trim()}}`,
    );
  return buildSheet(new ChordProParser().parse(src), { notation });
}

const words = (line: SheetLine) =>
  line.kind === 'lyrics'
    ? line.atoms.map((a) => a.segs.map((s) => s.text).join(''))
    : [];

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('splitIntoAtoms — la palabra es la unidad', () => {
  it('un acorde a media palabra queda dentro de su palabra', () => {
    const atoms = splitIntoAtoms([
      { chord: 'C', text: 'Dios está a' },
      { chord: 'G', text: 'quí, tan ' },
      { chord: 'Am', text: 'cierto' },
    ]);
    expect(atoms.map((a) => a.segs.map((s) => s.text).join(''))).toEqual([
      'Dios ',
      'está ',
      'aquí, ',
      'tan ',
      'cierto',
    ]);
    // «aquí» son dos trozos: «a» sin acorde y «quí» con el SOL.
    expect(atoms[2].segs).toEqual([
      { chord: '', text: 'a' },
      { chord: 'G', text: 'quí, ' },
    ]);
    // El acorde de un trozo con varias palabras va con la primera.
    expect(atoms[0].segs[0].chord).toBe('C');
    expect(atoms[1].segs[0].chord).toBe('');
  });

  it('un acorde sobre el hueco entre palabras se va con la siguiente', () => {
    const atoms = splitIntoAtoms([
      { chord: '', text: 'mi voz.' },
      { chord: 'G', text: ' En medio' },
    ]);
    expect(atoms.map((a) => a.segs.map((s) => s.text).join(''))).toEqual([
      'mi ',
      'voz. ',
      'En ',
      'medio',
    ]);
    expect(atoms[2].segs[0].chord).toBe('G');
  });

  it('varios espacios seguidos cuentan como uno', () => {
    const atoms = splitIntoAtoms([
      { chord: '', text: 'sentimiento       que' },
    ]);
    expect(atoms[0].segs[0].text).toBe('sentimiento ');
  });

  it('fuera los espacios del principio de la línea', () => {
    const atoms = splitIntoAtoms([{ chord: '', text: '   Ven' }]);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].segs[0].text).toBe('Ven');
  });
});

describe('buildSheet — secciones', () => {
  it('un {soc} pegado a la estrofa abre su propia sección', () => {
    // En «Fieles» no hay línea en blanco antes de {soc}: ChordSheetJS lo
    // metía en el mismo párrafo y el estribillo no se separaba.
    const m = sheet(
      '[G]Haznos fieles como eres Tú.\n{soc}\n[Em]FIELES, [Bm]FIELES\n{eoc}',
    );
    expect(m.sections.map((s) => s.kind)).toEqual(['verse', 'chorus']);
  });

  it('una línea de solo acordes es una línea de acordes, no letra', () => {
    const m = sheet('{c: INTRO}\n [G] [C] [D] x2\n\n[G]Letra');
    const intro = m.sections[0];
    expect(intro.kind).toBe('instrumental');
    expect(intro.label).toBe('INTRO');
    expect(intro.lines[0]).toMatchObject({
      kind: 'chords',
      chords: ['G', 'C', 'D'],
      note: 'x2',
    });
  });

  it('las marcas de revisión salen de la letra', () => {
    const m = sheet('{comment: ♩ REVISAR ACORDES}\n[G]Letra');
    expect(m.reviewNotes).toEqual(['REVISAR ACORDES']);
    expect(renderSheetHtml(m)).not.toContain('REVISAR');
  });

  it('{c: Estribillo} sin {soc} marca el bloque como estribillo', () => {
    const m = sheet('{c: Estribillo}\n[G]Cristo está aquí\n\n[C]Estrofa');
    expect(m.sections[0]).toMatchObject({
      kind: 'chorus',
      label: 'Estribillo',
    });
    expect(m.sections[1].kind).toBe('verse');
  });

  it('los acordes salen en la notación pedida', () => {
    const m = sheet('[Am]Hola [G7]mundo', 'ES');
    const line = m.sections[0].lines[0];
    expect(line.kind === 'lyrics' && line.atoms[0].segs[0].chord).toBe('lam');
    expect(line.kind === 'lyrics' && line.atoms[1].segs[0].chord).toBe('SOL7');
  });
});

describe('buildSheet — numeración de estrofas', () => {
  it('numera sola a partir de dos estrofas', () => {
    const m = sheet('[G]Una\n\n{soc}\n[C]Coro\n{eoc}\n\n[G]Dos');
    expect(
      m.sections.filter((s) => s.kind === 'verse').map((s) => s.number),
    ).toEqual([1, 2]);
  });

  it('con una sola estrofa no numera', () => {
    const m = sheet('[G]Una\n\n{soc}\n[C]Coro\n{eoc}');
    expect(m.sections[0].number).toBeNull();
  });

  it('el número escrito a mano se quita de la letra y se respeta', () => {
    const m = sheet('2. Porque [C]juntas somos más\n\n3. Vas no[C]tando');
    expect(m.manualNumbers).toBe(true);
    expect(m.sections.map((s) => s.number)).toEqual([2, 3]);
    expect(words(m.sections[0].lines[0])[0]).toBe('Porque ');
  });

  it('si el acorde iba sobre el número, pasa a la primera palabra', () => {
    const m = sheet('[C]1. Hay muchas formas\n\n2. Otra');
    const line = m.sections[0].lines[0];
    expect(line.kind === 'lyrics' && line.atoms[0].segs[0]).toEqual({
      chord: 'C',
      text: 'Hay ',
    });
  });
});

describe('buildSheet — estribillos repetidos', () => {
  const CHORUS =
    '{soc}\n[C]Seas quien seas y como [G]seas\n[F]esta es tu casa\n{eoc}';

  it('el mismo estribillo dos veces: la segunda es repetición exacta', () => {
    const m = sheet(`${CHORUS}\n\n[C]Estrofa uno\n\n${CHORUS}`);
    const [first, , again] = m.sections;
    expect(first.repeatOf).toBeNull();
    expect(again.repeatOf).toEqual({ index: 0, exact: true, sameChords: true });
  });

  it('misma letra en otro tono: repetición con otros acordes', () => {
    const otherKey = CHORUS.replace('[C]', '[D]');
    const m = sheet(`${CHORUS}\n\n[C]Estrofa\n\n${otherKey}`);
    expect(m.sections[2].repeatOf).toMatchObject({
      exact: true,
      sameChords: false,
    });
  });

  it('casi igual (una palabra cambia) cuenta como repetición «con cambios»', () => {
    const changed = CHORUS.replace('esta es tu casa', 'esta es nuestra casa');
    const m = sheet(`${CHORUS}\n\n[C]Estrofa\n\n${changed}`);
    expect(m.sections[2].repeatOf).toMatchObject({ index: 0, exact: false });
  });

  it('dos estribillos distintos no se pliegan uno en otro', () => {
    const m = sheet(
      '{soc}\n[D]CON TU PAZ IREMOS POR EL MUNDO\n{eoc}\n\n[A]Estrofa\n\n{soc}\n[D]ES TU PAZ UNA HUELLA EN LA HISTORIA\n{eoc}',
    );
    expect(m.sections[2].repeatOf).toBeNull();
  });

  it('{chorus} repite el último estribillo', () => {
    const m = sheet(`${CHORUS}\n\n[C]Estrofa\n\n{chorus}`);
    const ref = m.sections[2];
    expect(ref.kind).toBe('chorus');
    expect(ref.repeatOf).toMatchObject({ index: 0, exact: true });
    expect(ref.lines).toBe(m.sections[0].lines);
  });

  it('una línea que solo dice «ESTRIBILLO» es una referencia', () => {
    // Patrón de «Ruah» y otras 28 canciones del cantoral.
    const m = sheet(`${CHORUS}\n\n[C]Estrofa\n\n{soc}\nESTRIBILLO\n{eoc}`);
    expect(m.sections).toHaveLength(3);
    expect(m.sections[2].repeatOf).toMatchObject({ index: 0 });
    expect(text(renderSheetHtml(m))).not.toMatch(/ESTRIBILLO ESTRIBILLO/);
  });

  it('un bloque de estrofa que se repite idéntico es un estribillo sin marcar', () => {
    const block = '[G]Lerelerié lerelerié\n[C]lerelerié lerelé';
    const m = sheet(`${block}\n\n[C]Estrofa\n\n${block}`);
    expect(m.sections[0]).toMatchObject({ kind: 'chorus', inferred: true });
    expect(m.sections[2].repeatOf).toMatchObject({ index: 0, exact: true });
  });
});

describe('renderSheetHtml', () => {
  it('no cambia la letra que se ve', () => {
    const m = sheet('[C]Dios está a[G]quí, tan [Am]cierto');
    const lyrics = renderSheetHtml(m).replace(/<b class="c">[^<]*<\/b>/g, '');
    expect(text(lyrics)).toBe('Dios está aquí, tan cierto');
  });

  it('la repetición sale completa y plegada (la vista elige con CSS)', () => {
    const c = '{soc}\n[C]Seas quien seas\n[F]esta es tu casa\n{eoc}';
    const html = renderSheetHtml(sheet(`${c}\n\n[C]Estrofa\n\n${c}\n\n${c}`));
    expect(html).toContain('rep-full');
    // Dos repeticiones seguidas → un solo plegado «×2».
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html).toContain('×2');
    expect(html).toContain('<span class="pv">Seas quien seas</span>');
  });

  it('cada línea lleva su número de línea del ChordPro (modo admin)', () => {
    const m = sheet('{title: X}\n[C]Uno\n{arr: Suave}\n[G]Dos');
    expect(renderSheetHtml(m)).not.toContain('data-line');
    const html = renderSheetHtml(m, { lineNumbers: true });
    expect(html).toMatch(/<div class="ln ly" data-line="1">/);
    expect(html).toMatch(
      /<div class="arrangement" data-line="2">\| Suave<\/div>/,
    );
    expect(html).toMatch(/<div class="ln ly" data-line="3">/);
  });

  it('marca (Bis) y x2 como indicación, no como letra', () => {
    const html = renderSheetHtml(sheet('[G]haznos fieles como eres Tú. (Bis)'));
    expect(html).toContain('class="w bis"');
  });

  it('un acorde sobre un hueco no desaparece (espacios duros)', () => {
    const html = renderSheetHtml(sheet('BEBER [G] [G7]'));
    expect(html).toMatch(/<b class="c">G<\/b><span class="t">&#160;<\/span>/);
  });
});

describe('normalizeLyrics / lyricsSimilarity', () => {
  it('ignora mayúsculas, tildes, puntuación y (bis)', () => {
    expect(normalizeLyrics('¡Qué BONITA es tu Iglesia! (Bis)')).toBe(
      'que bonita es tu iglesia',
    );
  });

  it('mide el parecido por palabras', () => {
    expect(lyricsSimilarity('a b c d e', 'a b c d e')).toBe(1);
    expect(lyricsSimilarity('a b c d e', 'a b x d e')).toBeCloseTo(0.8);
    expect(lyricsSimilarity('a b', '')).toBe(0);
  });
});
