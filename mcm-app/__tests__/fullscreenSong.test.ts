import { resolveFullscreenSong } from '@/utils/fullscreenSong';

const A = { filename: 'a.cho', title: 'A', content: '[G]A', capo: 2 };
const B = { filename: 'b.cho', title: 'B', content: '[C]B' };
const C = { filename: 'c.cho', title: 'C', content: '[D]C', capo: 1 };
const list = [A, B, C];

describe('resolveFullscreenSong', () => {
  it('abre con el tono y la cejilla con los que se estaba viendo', () => {
    const r = resolveFullscreenSong({
      initial: {
        ...A,
        content: '[G]A {arr: nuevo}',
        transpose: 3,
        capoOverride: 0,
      },
      list,
      index: 0,
    });
    // La letra viva del detalle, no la de la lista.
    expect(r.song.content).toBe('[G]A {arr: nuevo}');
    expect(r.transpose).toBe(3);
    expect(r.capo).toBe(0);
  });

  it('al pasar a otra canción, la de la lista con su tono original', () => {
    const r = resolveFullscreenSong({
      initial: { ...A, transpose: 3 },
      list,
      index: 2,
    });
    expect(r.song).toBe(C);
    expect(r.transpose).toBe(0);
    expect(r.capo).toBe(1);
  });

  it('en la playlist manda el tono guardado de cada canción', () => {
    const r = resolveFullscreenSong({
      initial: { ...A, transpose: 3 },
      list,
      index: 1,
      selected: { transpose: -2, capoOverride: 4 },
    });
    expect(r.song).toBe(B);
    expect(r.transpose).toBe(-2);
    expect(r.capo).toBe(4);
  });

  it('en el coro, quien escucha ve la canción del líder y su tono', () => {
    const r = resolveFullscreenSong({
      initial: A,
      list,
      index: 0,
      choirSong: {
        filename: 'z.cho',
        title: 'Z',
        content: '[E]Z',
        transpose: 2,
        songKey: 'E',
        updatedAt: 1,
      },
    });
    expect(r.following).toBe(true);
    expect(r.song.filename).toBe('z.cho');
    expect(r.song.key).toBe('E');
    expect(r.transpose).toBe(2);
  });

  it('el «mi tono» de quien escucha gana al del líder', () => {
    const r = resolveFullscreenSong({
      initial: A,
      index: null,
      choirSong: {
        filename: 'z.cho',
        content: '[E]Z',
        transpose: 2,
        updatedAt: 1,
      },
      choirOverrideTranspose: -1,
    });
    expect(r.transpose).toBe(-1);
  });

  it('sin la letra del líder (sesión vieja), sigue con la suya', () => {
    const r = resolveFullscreenSong({
      initial: A,
      index: null,
      choirSong: { filename: 'z.cho', transpose: 2, updatedAt: 1 },
    });
    expect(r.following).toBe(false);
    expect(r.song.filename).toBe('a.cho');
  });
});
