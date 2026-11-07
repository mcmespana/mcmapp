/**
 * Tests de `utils/playlistSync.ts`: la firma que decide si la pantalla dice
 * «guardada» o «cambios sin guardar», el orden del histórico de un coro y las
 * fechas relativas.
 *
 * La firma es la pieza delicada: un falso «cambios sin guardar» nada más
 * importar haría que la gente subiera copias de la misma lista sin parar.
 */
import {
  formatRelativeDate,
  latestChoirPlaylist,
  playlistSignature,
  sortChoirPlaylists,
  type ChoirPlaylistEntry,
} from '@/utils/playlistSync';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';

const song = (
  filename: string,
  order: number,
  extra: Partial<SelectedSong> = {},
): SelectedSong => ({
  filename,
  transpose: 0,
  order,
  addedAt: 1000 + order,
  ...extra,
});

describe('playlistSignature', () => {
  it('no depende del orden del array, solo del campo `order`', () => {
    const a = [song('a.cho', 0), song('b.cho', 1)];
    const b = [song('b.cho', 1), song('a.cho', 0)];
    expect(playlistSignature(a)).toBe(playlistSignature(b));
  });

  it('cambia si se reordena de verdad', () => {
    const a = [song('a.cho', 0), song('b.cho', 1)];
    const b = [song('a.cho', 1), song('b.cho', 0)];
    expect(playlistSignature(a)).not.toBe(playlistSignature(b));
  });

  it('cambia al transportar una canción', () => {
    const base = [song('a.cho', 0)];
    const transposed = [song('a.cho', 0, { transpose: 2 })];
    expect(playlistSignature(base)).not.toBe(playlistSignature(transposed));
  });

  it('cambia al poner una cejilla distinta', () => {
    const base = [song('a.cho', 0)];
    const capo = [song('a.cho', 0, { capoOverride: 3 })];
    expect(playlistSignature(base)).not.toBe(playlistSignature(capo));
  });

  it('trata `capoOverride: null` y ausente como lo mismo', () => {
    expect(playlistSignature([song('a.cho', 0, { capoOverride: null })])).toBe(
      playlistSignature([song('a.cho', 0)]),
    );
  });

  it('ignora duplicados, igual que hace la selección al guardarse', () => {
    const conDuplicado = [song('a.cho', 0), song('a.cho', 1), song('b.cho', 2)];
    const sinDuplicado = [song('a.cho', 0), song('b.cho', 1)];
    expect(playlistSignature(conDuplicado)).toBe(
      playlistSignature(sinDuplicado),
    );
  });

  it('la lista vacía tiene firma estable', () => {
    expect(playlistSignature([])).toBe(playlistSignature([]));
    expect(playlistSignature([])).not.toBe(playlistSignature([song('a', 0)]));
  });
});

describe('orden del histórico del coro', () => {
  const entry = (
    code: string,
    updatedAt: number,
    name = `Playlist ${code}`,
  ): ChoirPlaylistEntry => ({
    code,
    name,
    createdAt: 0,
    updatedAt,
    songCount: 3,
  });

  it('la más reciente va primero', () => {
    const sorted = sortChoirPlaylists([
      entry('1111', 100),
      entry('2222', 300),
      entry('3333', 200),
    ]);
    expect(sorted.map((e) => e.code)).toEqual(['2222', '3333', '1111']);
  });

  it('empate de fecha → por nombre, para que el orden no baile', () => {
    const sorted = sortChoirPlaylists([
      entry('1111', 100, 'Zeta'),
      entry('2222', 100, 'Alfa'),
    ]);
    expect(sorted.map((e) => e.name)).toEqual(['Alfa', 'Zeta']);
  });

  it('«importar la última» coge la de fecha mayor', () => {
    expect(
      latestChoirPlaylist([entry('1111', 100), entry('2222', 300)])?.code,
    ).toBe('2222');
  });

  it('un coro sin playlists no tiene última', () => {
    expect(latestChoirPlaylist([])).toBeNull();
  });
});

describe('formatRelativeDate', () => {
  const now = new Date('2026-08-12T12:00:00Z').getTime();

  it.each([
    [now - 30_000, 'ahora mismo'],
    [now - 12 * 60_000, 'hace 12 min'],
    [now - 3 * 3_600_000, 'hace 3 h'],
    [now - 30 * 3_600_000, 'ayer'],
  ])('%s → %s', (ts, expected) => {
    expect(formatRelativeDate(ts, now)).toBe(expected);
  });

  it('más de dos días → fecha corta', () => {
    expect(
      formatRelativeDate(new Date('2026-08-07T10:00:00Z').getTime(), now),
    ).toBe('7 ago');
  });

  it('otro año → incluye el año', () => {
    expect(
      formatRelativeDate(new Date('2025-08-07T10:00:00Z').getTime(), now),
    ).toBe('7 ago 2025');
  });

  it('sin fecha → cadena vacía (no «NaN»)', () => {
    expect(formatRelativeDate(0, now)).toBe('');
  });
});
