import {
  carryGratefulText,
  gratefulItemsToSave,
  padListItems,
  revisionHasContent,
  stepDotWidth,
} from '@/utils/contigoRevision';

describe('gratefulItemsToSave', () => {
  it('en lista descarta huecos y recorta espacios', () => {
    expect(gratefulItemsToSave('list', [' a ', '', '  ', 'b'], 'x')).toEqual([
      'a',
      'b',
    ]);
  });

  it('en libre guarda un solo texto, sin espacios sobrantes', () => {
    expect(gratefulItemsToSave('free', ['a'], '  hola \n')).toEqual(['hola']);
  });

  it('en libre vacío no guarda `[""]`', () => {
    expect(gratefulItemsToSave('free', [], '   ')).toEqual([]);
  });
});

describe('revisionHasContent', () => {
  const blank = {
    mode: 'list' as const,
    items: ['', '', ''],
    singleGrat: '',
    revText: '',
  };

  it('un formulario en blanco no cuenta', () => {
    expect(revisionHasContent(blank)).toBe(false);
    expect(
      revisionHasContent({ ...blank, items: [' ', '\n', ''], revText: '  ' }),
    ).toBe(false);
  });

  it('basta una casilla escrita', () => {
    expect(revisionHasContent({ ...blank, items: ['', 'a', ''] })).toBe(true);
  });

  it('basta con el paso de revisar', () => {
    expect(revisionHasContent({ ...blank, revText: 'me enfadé' })).toBe(true);
  });

  it('solo mira el agradecimiento del modo activo', () => {
    // Texto en la caja libre pero el modo activo es lista: no se guardaría.
    expect(revisionHasContent({ ...blank, singleGrat: 'hola' })).toBe(false);
    expect(
      revisionHasContent({ ...blank, mode: 'free', singleGrat: 'hola' }),
    ).toBe(true);
  });
});

describe('carryGratefulText', () => {
  it('de lista a libre junta las casillas, una por línea', () => {
    const r = carryGratefulText('free', ['a', '', 'b'], '');
    expect(r.singleGrat).toBe('a\nb');
  });

  it('de lista a libre no pisa lo que ya había escrito en libre', () => {
    const r = carryGratefulText('free', ['a'], 'ya había');
    expect(r.singleGrat).toBe('ya había');
  });

  it('de libre a lista parte por líneas y completa hasta tres casillas', () => {
    const r = carryGratefulText('list', ['', '', ''], 'uno\n\n dos ');
    expect(r.items).toEqual(['uno', 'dos', '']);
  });

  it('de libre a lista con muchas líneas no recorta ninguna', () => {
    const r = carryGratefulText('list', ['', '', ''], 'a\nb\nc\nd');
    expect(r.items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('de libre a lista no pisa casillas ya escritas', () => {
    const r = carryGratefulText('list', ['x', '', ''], 'otro');
    expect(r.items).toEqual(['x', '', '']);
  });

  it('con todo vacío deja las tres casillas de siempre', () => {
    expect(carryGratefulText('list', [], '').items).toEqual(['', '', '']);
  });
});

describe('padListItems', () => {
  it('no toca una lista que ya llega al mínimo', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(padListItems(items)).toBe(items);
  });
});

describe('stepDotWidth', () => {
  it('alarga el actual, deja mediano el pasado y pequeño el futuro', () => {
    expect(stepDotWidth(1, 1)).toBeGreaterThan(stepDotWidth(0, 1));
    expect(stepDotWidth(0, 1)).toBeGreaterThan(stepDotWidth(2, 1));
  });
});
