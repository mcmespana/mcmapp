import { keywords, matchSongs, nextSundayIso, stem } from '@/utils/sundayMatch';

describe('sundayMatch', () => {
  it('quita palabras vacías, acordes y directivas', () => {
    const k = keywords('{title: X}\n[Do]El Señor es mi pas[Sol]tor, las ovejas');
    expect([...k.keys()]).toEqual(['pastor', 'oveja']);
  });

  it('el plural no separa', () => {
    expect(stem('ovejas')).toBe(stem('oveja'));
    expect(stem('pastores')).toBe('pastor');
  });

  it('ordena por coincidencias raras y enseña las palabras', () => {
    const songs = [
      { filename: 'a', title: 'El pastor', content: 'pastor rebaño cayado praderas' },
      { filename: 'b', title: 'Camino', content: 'camino pastor montaña' },
      { filename: 'c', title: 'Luz', content: 'luz camino claridad' },
    ];
    const out = matchSongs(
      [{ text: 'El pastor conduce su rebaño por verdes praderas', weight: 1 }],
      songs,
    );
    expect(out[0].filename).toBe('a');
    expect(out[0].words).toEqual(
      expect.arrayContaining(['rebaño', 'praderas']),
    );
    // Una sola palabra en común no basta.
    expect(out.find((m) => m.filename === 'b')).toBeUndefined();
  });

  it('el próximo domingo', () => {
    expect(nextSundayIso(new Date(2026, 10, 16))).toBe('2026-11-22');
    expect(nextSundayIso(new Date(2026, 10, 22))).toBe('2026-11-22');
  });
});
