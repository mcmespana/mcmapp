import {
  addChord,
  buildEdition,
  chordToEnglish,
  chordsUsed,
  composeSongContent,
  moveChord,
  parseEditorLine,
  removeChord,
  replaceLyrics,
  serializeEditorLine,
  splitSongHeader,
  wrapRows,
  type SongSnapshot,
} from '@/utils/songEditor';

const lyr = (raw: string) => {
  const l = parseEditorLine(raw);
  if (l.kind !== 'lyrics') throw new Error('no es letra');
  return l;
};

describe('songEditor · líneas', () => {
  it('ida y vuelta sin perder nada', () => {
    for (const raw of [
      'Ve[C]nid, ben[F]ditos de mi [C]Padre,',
      '[G] [G7]',
      'sin acordes',
      '',
      'b[C]eber.  [G] [G7]',
    ]) {
      expect(serializeEditorLine(parseEditorLine(raw))).toBe(raw);
    }
  });

  it('las directivas no se tocan', () => {
    expect(parseEditorLine('{soc}')).toEqual({ kind: 'other', raw: '{soc}' });
  });

  it('mover, añadir y quitar', () => {
    const l = lyr('Ve[C]nid');
    expect(serializeEditorLine(moveChord(l, 0, 0))).toBe('[C]Venid');
    expect(serializeEditorLine(moveChord(l, 0, 99))).toBe('Venid[C]');
    expect(serializeEditorLine(addChord(l, 4, 'G'))).toBe('Ve[C]ni[G]d');
    expect(serializeEditorLine(removeChord(l, 0))).toBe('Venid');
  });

  it('cambiar la letra no descoloca los acordes', () => {
    const l = lyr('[C]Hola [G]mundo');
    expect(serializeEditorLine(replaceLyrics(l, 'Hola gran mundo'))).toBe(
      '[C]Hola gran [G]mundo',
    );
  });

  it('parte por palabras', () => {
    const rows = wrapRows('uno dos tres cuatro', 9);
    expect(
      rows.map((r) => 'uno dos tres cuatro'.slice(r.start, r.end)),
    ).toEqual(['uno dos ', 'tres ', 'cuatro']);
  });
});

describe('songEditor · título', () => {
  it('quita el número que pone el generador', () => {
    const { stripSongNumber } = jest.requireActual('@/utils/songUtils');
    expect(stripSongNumber('03. Parenostre')).toBe('Parenostre');
    expect(stripSongNumber('Parenostre')).toBe('Parenostre');
    expect(stripSongNumber('3 . Señor')).toBe('Señor');
    expect(stripSongNumber('1999 ya')).toBe('1999 ya');
  });
});

describe('songEditor · acordes', () => {
  it('lo que se teclea pasa a cifrado inglés', () => {
    expect(chordToEnglish('Sol7')).toBe('G7');
    expect(chordToEnglish('lam')).toBe('Am');
    expect(chordToEnglish('FA#m')).toBe('F#m');
    expect(chordToEnglish('sib')).toBe('Bb');
    expect(chordToEnglish('do/mi')).toBe('C/E');
    expect(chordToEnglish('g')).toBe('G');
    expect(chordToEnglish('Am7')).toBe('Am7');
  });

  it('acordes usados, sin repetir', () => {
    expect(chordsUsed('[C]a [G]b [C]c')).toEqual(['C', 'G']);
  });
});

describe('songEditor · cabecera y edición', () => {
  const content = '{title: Uno}\n{key: C}\n\n{soc}\n[C]la\n{eoc}';
  it('separa y recompone', () => {
    const { header, body } = splitSongHeader(content);
    expect(header).toHaveLength(2);
    expect(body).toBe('{soc}\n[C]la\n{eoc}');
    expect(
      composeSongContent(
        { title: 'Dos', author: 'Yo', key: 'D', capo: 2, info: '' },
        body,
      ),
    ).toBe(
      '{title: Dos}\n{artist: Yo}\n{key: D}\n{capo: 2}\n\n{soc}\n[C]la\n{eoc}\n',
    );
  });

  it('la edición solo lleva lo que cambia', () => {
    const base: SongSnapshot = {
      title: 'Uno',
      author: '',
      key: 'C',
      capo: 0,
      info: '',
      content,
      album: '',
      source: '',
      rhythm: '',
      liturgicalTime: '',
      videoEmbed: '',
      youtubeLinks: [],
      audioLinks: [],
      spotifyLinks: [],
      driveLinks: [],
      otherLinks: [],
      tags: [],
    };
    expect(buildEdition(base, base).changes).toEqual({});
    const out = buildEdition(base, {
      ...base,
      key: 'D',
      audioLinks: [{ label: 'x', url: 'https://a' }],
    });
    expect(out.changes).toEqual({
      keyOld: 'C',
      keyNew: 'D',
      audioLinksOld: [],
      audioLinksNew: [{ label: 'x', url: 'https://a' }],
    });
    expect(Object.keys(out.fields)).toEqual(['key', 'audioLinks']);
    expect(
      buildEdition(base, { ...base, tags: ['Adviento', 'misa joven'] }).changes,
    ).toEqual({ tagsOld: [], tagsNew: ['adviento', 'misa-joven'] });
  });
});
