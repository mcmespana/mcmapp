import { isKnownChord, lintChordPro, tokenizeLine } from '@/utils/chordProLint';

describe('chordProLint · colores', () => {
  it('trocea letra, acordes y directivas', () => {
    expect(tokenizeLine('Ve[C]nid {c: suave} {soc}')).toEqual([
      { text: 'Ve', kind: 'text' },
      { text: '[C]', kind: 'chord' },
      { text: 'nid ', kind: 'text' },
      { text: '{c: suave}', kind: 'comment' },
      { text: ' ', kind: 'text' },
      { text: '{soc}', kind: 'section' },
    ]);
    expect(tokenizeLine('{title: X}')[0].kind).toBe('directive');
    expect(tokenizeLine('{arr: flauta}')[0].kind).toBe('arr');
  });

  it('lo que no cierra va en error hasta el final', () => {
    expect(tokenizeLine('la [Am la')).toEqual([
      { text: 'la ', kind: 'text' },
      { text: '[Am la', kind: 'error' },
    ]);
    expect(tokenizeLine('x]')[1]).toEqual({ text: ']', kind: 'error' });
    // Se abre otro antes de cerrar: el primero es el que falla.
    expect(tokenizeLine('[Re la [D]x')).toEqual([
      { text: '[Re la ', kind: 'error' },
      { text: '[D]', kind: 'chord' },
      { text: 'x', kind: 'text' },
    ]);
  });

  it('acordes: inglés sí, notas en español no', () => {
    for (const c of ['C', 'Am7', 'F#m', 'G/B', 'Bbmaj7', 'Dsus4'])
      expect(isKnownChord(c)).toBe(true);
    for (const c of ['Do', 'Fa#', 'la', 'x', 'C/D/E', ''])
      expect(isKnownChord(c)).toBe(false);
  });
});

describe('chordProLint · avisos', () => {
  it('nada que decir de una canción bien hecha', () => {
    expect(
      lintChordPro('{soc}\n[C]la\n{eoc}\n\n{sov}\n[G]lo\n{eov}\n{chorus}'),
    ).toEqual([]);
  });

  it('secciones sin cerrar, sin abrir o cruzadas', () => {
    expect(lintChordPro('{soc}\nla')).toEqual([
      { line: 1, message: 'El estribillo no se cierra' },
    ]);
    expect(lintChordPro('la\n{eoc}')).toEqual([
      { line: 2, message: 'Cierre de estribillo sin abrir' },
    ]);
    expect(lintChordPro('{soc}\n{sov}\n{eov}').map((i) => i.line)).toEqual([2]);
    expect(lintChordPro('{soc}\n{eov}')[0].message).toMatch(
      /Cierra un estrofa/,
    );
  });

  it('corchetes y llaves', () => {
    expect(
      lintChordPro('[C la\n{title: x\n[Do]re\nfin]').map((i) => i.message),
    ).toEqual([
      'Corchete «[» sin cerrar',
      'Llave «{» sin cerrar',
      '«[Do]» no parece un acorde',
      '«]» sin su apertura',
    ]);
  });
});
